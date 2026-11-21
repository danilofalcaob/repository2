"use client";
import { useMemo, useState, useTransition } from "react";
import { ANALITOS, GRUPO_LABEL, ORDEM_GRUPOS, getAnalito } from "@/lib/exames/catalogo";
import { dataLocalParaISO } from "@/lib/exames/parser";
import { completarResultado, ehAlterado, ehCritico, FLAG_LABEL, parseNumeroBR, type Resultado } from "@/lib/exames/valores";
import { confirmarDocumento, excluirDocumento, lancarManual, type ItemRevisao } from "../../actions";

const TZ = "America/Sao_Paulo";

function partesLocais(iso: string): { data: string; hora: string } {
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: TZ,
  }).formatToParts(d);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { data: `${v("year")}-${v("month")}-${v("day")}`, hora: `${v("hour")}:${v("minute")}` };
}

function isoDe(data: string, hora: string): string | null {
  const d = data.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!d) return null;
  const h = hora.match(/^(\d{1,2}):(\d{2})$/);
  return dataLocalParaISO(+d[1], +d[2], +d[3], h ? +h[1] : 6, h ? +h[2] : 0);
}

const numOuNull = (s: string) => (s.trim() ? (parseNumeroBR(s)?.valor ?? null) : null);
const numTexto = (v: number | null) => (v == null ? "" : String(v).replace(".", ","));

type Linha = {
  uid: number;
  incluir: boolean;
  analito: string;
  nome: string;
  valorTexto: string;
  unidade: string;
  refMin: string;
  refMax: string;
  observacao: string;
  data: string;
  hora: string;
  alterado: boolean;
};

let contador = 0;

function linhaDe(r: Resultado, existentes: Map<string, string>): Linha {
  const { data, hora } = partesLocais(r.coletadoEm);
  const duplicado = existentes.get(`${r.analito}|${new Date(r.coletadoEm).toISOString()}`) === r.valorTexto;
  return {
    uid: ++contador,
    incluir: !duplicado,
    analito: r.analito,
    nome: r.nome,
    valorTexto: r.valorTexto,
    unidade: r.unidade ?? "",
    refMin: numTexto(r.refMin),
    refMax: numTexto(r.refMax),
    observacao: r.observacao ?? "",
    data,
    hora,
    alterado: r.flag === "alterado",
  };
}

export default function RevisaoLaudo({
  documentoId,
  pacienteId,
  titulo,
  metodo,
  avisos,
  resultados,
  sexo,
  existentes,
  onConcluido,
}: {
  documentoId: string | null; // null = lançamento manual
  pacienteId: string;
  titulo: string;
  metodo?: string;
  avisos: string[];
  resultados: Resultado[];
  sexo: string | null;
  existentes: Map<string, string>; // "analito|iso" -> valorTexto já gravado
  onConcluido: (mensagem: string) => void;
}) {
  const agora = partesLocais(new Date().toISOString());
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    resultados.length
      ? resultados.map((r) => linhaDe(r, existentes))
      : [novaLinha(agora.data, "06:00")],
  );
  const [erro, setErro] = useState("");
  const [pendente, startTransition] = useTransition();

  function novaLinha(data: string, hora: string): Linha {
    return {
      uid: ++contador,
      incluir: true,
      analito: "k",
      nome: "",
      valorTexto: "",
      unidade: getAnalito("k")!.unidade,
      refMin: "",
      refMax: "",
      observacao: "",
      data,
      hora,
      alterado: false,
    };
  }

  const atualizar = (uid: number, patch: Partial<Linha>) =>
    setLinhas((ls) => ls.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));

  const datas = useMemo(() => [...new Set(linhas.map((l) => `${l.data} ${l.hora}`))], [linhas]);
  const [dataGeral, horaGeral] = (datas[0] ?? `${agora.data} 06:00`).split(" ");

  function aplicarDataATodas(data: string, hora: string) {
    setLinhas((ls) => ls.map((l) => ({ ...l, data, hora })));
  }

  const previa = (l: Linha) => {
    const iso = isoDe(l.data, l.hora) ?? new Date().toISOString();
    const semComp = l.valorTexto.replace(/^\s*(<=|>=|≤|≥|<|>)\s*/, "");
    const num = parseNumeroBR(semComp);
    return completarResultado(
      {
        analito: l.analito,
        nome: l.nome,
        valor: num?.valor ?? null,
        valorTexto: l.valorTexto,
        casas: num?.casas ?? 0,
        unidade: l.unidade || null,
        refMin: numOuNull(l.refMin),
        refMax: numOuNull(l.refMax),
        coletadoEm: iso,
        qualitativoAlterado: num == null && l.alterado,
      },
      sexo,
    );
  };

  const incluidas = linhas.filter((l) => l.incluir);

  function confirmar() {
    setErro("");
    const itens: ItemRevisao[] = [];
    for (const l of incluidas) {
      const iso = isoDe(l.data, l.hora);
      if (!iso) return setErro("Há linha com data inválida.");
      if (!l.valorTexto.trim()) return setErro("Há linha marcada sem valor.");
      itens.push({
        analito: l.analito,
        nome: l.nome.trim() || getAnalito(l.analito)?.rotulo || "Exame",
        valorTexto: l.valorTexto.trim(),
        unidade: l.unidade.trim() || null,
        refMin: numOuNull(l.refMin),
        refMax: numOuNull(l.refMax),
        observacao: l.observacao.trim() || null,
        coletadoEm: iso,
        alterado: l.alterado,
      });
    }
    startTransition(async () => {
      const r = documentoId ? await confirmarDocumento(documentoId, itens) : await lancarManual(pacienteId, itens);
      if (!r.ok) setErro(r.erro);
      else onConcluido(r.mensagem ?? "Resultados salvos.");
    });
  }

  function descartar() {
    if (!documentoId) return onConcluido("");
    if (!window.confirm("Descartar este laudo? O arquivo e os valores extraídos serão apagados.")) return;
    startTransition(async () => {
      const r = await excluirDocumento(documentoId);
      if (!r.ok) setErro(r.erro);
      else onConcluido("Laudo descartado.");
    });
  }

  return (
    <div className="card border-clinic-primary/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">Revisar: {titulo}</h3>
          <p className="text-xs text-clinic-muted">
            {metodo === "ia" && "Lido por IA. "}
            {metodo === "pdf_texto" && "Lido do texto do PDF. "}
            {metodo === "ocr" && "Lido por OCR da imagem. "}
            Confira cada valor com o laudo original antes de confirmar — nada é gravado sem a sua revisão.
          </p>
        </div>
        {documentoId && (
          <a href={`/api/uti/documento/${documentoId}`} target="_blank" rel="noreferrer" className="btn-secondary !py-1.5 text-xs">
            📄 Abrir laudo original
          </a>
        )}
      </div>

      {avisos.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-lg bg-cuidado/10 p-3 text-xs text-cuidado">
          {avisos.map((a, i) => (
            <li key={i}>⚠️ {a}</li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-2 text-sm">
        <div>
          <label className="label !text-xs">Data da coleta</label>
          <input
            type="date"
            className="input !py-1.5"
            value={dataGeral}
            onChange={(e) => aplicarDataATodas(e.target.value, horaGeral)}
          />
        </div>
        <div>
          <label className="label !text-xs">Hora</label>
          <input
            type="time"
            className="input !py-1.5"
            value={horaGeral}
            onChange={(e) => aplicarDataATodas(dataGeral, e.target.value)}
          />
        </div>
        {datas.length > 1 && (
          <p className="pb-2 text-xs text-clinic-muted">
            Este laudo tem {datas.length} coletas diferentes; alterar aqui aplica a mesma data a todas as linhas.
          </p>
        )}
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[860px] text-xs">
          <thead className="text-left uppercase text-clinic-muted">
            <tr>
              <th className="p-1.5">✓</th>
              <th className="p-1.5">Exame</th>
              <th className="p-1.5">Valor</th>
              <th className="p-1.5">Unidade</th>
              <th className="p-1.5">Ref. mín</th>
              <th className="p-1.5">Ref. máx</th>
              <th className="p-1.5">Situação</th>
              <th className="p-1.5">Observação</th>
              {datas.length > 1 && <th className="p-1.5">Coleta</th>}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const r = previa(l);
              const chave = `${l.analito}|${isoDe(l.data, l.hora) ?? ""}`;
              const ja = existentes.get(chave);
              return (
                <tr key={l.uid} className={`border-t border-clinic-border ${l.incluir ? "" : "opacity-45"}`}>
                  <td className="p-1.5">
                    <input
                      type="checkbox"
                      checked={l.incluir}
                      onChange={(e) => atualizar(l.uid, { incluir: e.target.checked })}
                      aria-label="Incluir"
                    />
                  </td>
                  <td className="p-1.5">
                    <select
                      className="input !py-1 !text-xs"
                      value={l.analito}
                      onChange={(e) => {
                        const a = getAnalito(e.target.value);
                        atualizar(l.uid, { analito: e.target.value, unidade: l.unidade || a?.unidade || "" });
                      }}
                    >
                      {ORDEM_GRUPOS.map((g) => {
                        const doGrupo = ANALITOS.filter((a) => a.grupo === g);
                        if (!doGrupo.length) return null;
                        return (
                          <optgroup key={g} label={GRUPO_LABEL[g]}>
                            {doGrupo.map((a) => (
                              <option key={a.codigo} value={a.codigo}>
                                {a.rotulo === a.nome ? a.nome : `${a.rotulo} — ${a.nome}`}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                      <option value="outro">Outro (nome livre)</option>
                    </select>
                    {l.analito === "outro" ? (
                      <input
                        className="input mt-1 !py-1 !text-xs"
                        placeholder="Nome do exame"
                        value={l.nome}
                        onChange={(e) => atualizar(l.uid, { nome: e.target.value })}
                      />
                    ) : (
                      l.nome &&
                      l.nome.toLowerCase() !== getAnalito(l.analito)?.rotulo.toLowerCase() && (
                        <span className="mt-0.5 block truncate text-[10px] text-clinic-muted">no laudo: {l.nome}</span>
                      )
                    )}
                  </td>
                  <td className="p-1.5">
                    <input
                      className="input !w-24 !py-1 !text-xs font-semibold"
                      value={l.valorTexto}
                      inputMode="decimal"
                      onChange={(e) => atualizar(l.uid, { valorTexto: e.target.value })}
                    />
                    {ja != null && (
                      <span className="mt-0.5 block text-[10px] text-clinic-muted">
                        {ja === l.valorTexto ? "já registrado" : `substitui ${ja}`}
                      </span>
                    )}
                  </td>
                  <td className="p-1.5">
                    <input
                      className="input !w-24 !py-1 !text-xs"
                      value={l.unidade}
                      onChange={(e) => atualizar(l.uid, { unidade: e.target.value })}
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      className="input !w-20 !py-1 !text-xs"
                      value={l.refMin}
                      inputMode="decimal"
                      onChange={(e) => atualizar(l.uid, { refMin: e.target.value })}
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      className="input !w-20 !py-1 !text-xs"
                      value={l.refMax}
                      inputMode="decimal"
                      onChange={(e) => atualizar(l.uid, { refMax: e.target.value })}
                    />
                  </td>
                  <td className="p-1.5">
                    {r.valor == null ? (
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={l.alterado}
                          onChange={(e) => atualizar(l.uid, { alterado: e.target.checked })}
                        />
                        alterado
                      </label>
                    ) : (
                      <span
                        className={`badge !px-2 !py-0.5 ${
                          ehCritico(r.flag)
                            ? "bg-instavel/15 text-instavel"
                            : ehAlterado(r.flag)
                              ? "bg-cuidado/15 text-cuidado"
                              : r.flag === "normal"
                                ? "bg-estavel/15 text-estavel"
                                : "bg-clinic-bg text-clinic-muted"
                        }`}
                      >
                        {FLAG_LABEL[r.flag]}
                      </span>
                    )}
                  </td>
                  <td className="p-1.5">
                    <input
                      className="input !w-36 !py-1 !text-xs"
                      value={l.observacao}
                      placeholder="ex.: colhido às 11:15"
                      onChange={(e) => atualizar(l.uid, { observacao: e.target.value })}
                    />
                  </td>
                  {datas.length > 1 && (
                    <td className="p-1.5">
                      <div className="flex gap-1">
                        <input
                          type="date"
                          className="input !w-32 !py-1 !text-xs"
                          value={l.data}
                          onChange={(e) => atualizar(l.uid, { data: e.target.value })}
                        />
                        <input
                          type="time"
                          className="input !w-24 !py-1 !text-xs"
                          value={l.hora}
                          onChange={(e) => atualizar(l.uid, { hora: e.target.value })}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-secondary !py-1.5 text-xs"
          onClick={() => setLinhas((ls) => [...ls, novaLinha(dataGeral, horaGeral)])}
        >
          ＋ Adicionar linha
        </button>
        <span className="text-xs text-clinic-muted">
          {incluidas.length} de {linhas.length} linha(s) selecionada(s)
        </span>
        <div className="ml-auto flex gap-2">
          <button type="button" className="btn-secondary" onClick={descartar} disabled={pendente}>
            {documentoId ? "Descartar laudo" : "Cancelar"}
          </button>
          <button type="button" className="btn-primary" onClick={confirmar} disabled={pendente || !incluidas.length}>
            {pendente ? "Salvando…" : `Confirmar ${incluidas.length} resultado(s)`}
          </button>
        </div>
      </div>
      {erro && <p className="mt-2 text-sm text-instavel">{erro}</p>}
    </div>
  );
}
