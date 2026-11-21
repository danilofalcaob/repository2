"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarLeitos } from "../actions";

export function gerarSequencia(qtd: number, inicio: number, digitos: number, prefixo: string, sufixo = ""): string[] {
  const n = Math.max(0, Math.min(300, Math.floor(qtd || 0)));
  return Array.from({ length: n }, (_, i) => `${prefixo}${String(inicio + i).padStart(digitos, "0")}${sufixo}`);
}

export default function ConfigurarLeitos({
  setorId,
  nomeInicial,
  leitosIniciais,
  ocupados,
}: {
  setorId: string | null;
  nomeInicial: string;
  leitosIniciais: string[];
  ocupados: string[];
}) {
  const router = useRouter();
  const [nome, setNome] = useState(nomeInicial);
  const [modo, setModo] = useState<"sequencia" | "lista">(leitosIniciais.length ? "lista" : "sequencia");
  const [qtd, setQtd] = useState(10);
  const [inicio, setInicio] = useState(1);
  const [digitos, setDigitos] = useState(2);
  const [prefixo, setPrefixo] = useState("");
  const [lista, setLista] = useState(leitosIniciais.join("\n"));
  const [erro, setErro] = useState("");
  const [pendente, startTransition] = useTransition();

  const leitos = useMemo(
    () =>
      modo === "sequencia"
        ? gerarSequencia(qtd, inicio, digitos, prefixo)
        : lista
            .split(/[\n,;]+/)
            .map((s) => s.trim())
            .filter(Boolean),
    [modo, qtd, inicio, digitos, prefixo, lista],
  );
  const removidosOcupados = ocupados.filter((o) => !leitos.some((l) => l.toLowerCase() === o.toLowerCase()));

  function salvar() {
    setErro("");
    startTransition(async () => {
      const r = await salvarLeitos({ setorId, nomeUnidade: nome, leitos });
      if (!r.ok) setErro(r.erro);
      else {
        router.push(`/uti?setor=${r.id}`);
        router.refresh();
      }
    });
  }

  return (
    <div className="card space-y-5 p-5">
      <div>
        <label className="label">Nome da unidade</label>
        <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: UTI Adulto 2º andar" />
      </div>

      <div>
        <span className="label">Como os leitos são numerados?</span>
        <div className="inline-flex rounded-lg border border-clinic-border bg-clinic-bg p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setModo("sequencia")}
            className={`rounded-md px-3 py-1.5 font-medium ${modo === "sequencia" ? "bg-clinic-surface shadow-sm" : "text-clinic-muted"}`}
          >
            Sequência numérica
          </button>
          <button
            type="button"
            onClick={() => {
              if (modo === "sequencia") setLista(leitos.join("\n"));
              setModo("lista");
            }}
            className={`rounded-md px-3 py-1.5 font-medium ${modo === "lista" ? "bg-clinic-surface shadow-sm" : "text-clinic-muted"}`}
          >
            Lista personalizada
          </button>
        </div>
      </div>

      {modo === "sequencia" ? (
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label">Quantidade de leitos</label>
            <input type="number" min={1} max={300} className="input" value={qtd} onChange={(e) => setQtd(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Primeiro número</label>
            <input type="number" min={0} className="input" value={inicio} onChange={(e) => setInicio(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Dígitos</label>
            <select className="input" value={digitos} onChange={(e) => setDigitos(Number(e.target.value))}>
              <option value={1}>1 (1, 2, 3…)</option>
              <option value={2}>2 (01, 02…)</option>
              <option value={3}>3 (001…)</option>
            </select>
          </div>
          <div>
            <label className="label">Prefixo (opcional)</label>
            <input className="input" value={prefixo} onChange={(e) => setPrefixo(e.target.value)} placeholder="Ex.: UTI-" maxLength={10} />
          </div>
          <p className="text-xs text-clinic-muted sm:col-span-4">
            Ex.: 10 leitos começando em 201 → 201 a 210. Para numeração salteada (ex.: sem o leito 13) ou com letras
            (10A, 10B), use a lista personalizada.
          </p>
        </div>
      ) : (
        <div>
          <label className="label">Leitos (um por linha ou separados por vírgula)</label>
          <textarea
            className="input min-h-[140px] font-mono text-sm"
            value={lista}
            onChange={(e) => setLista(e.target.value)}
            placeholder={"01\n02\n03\nIsolamento 1"}
          />
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium">
          Prévia: {leitos.length} leito{leitos.length === 1 ? "" : "s"}
        </p>
        <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
          {leitos.map((l, i) => (
            <span
              key={`${l}-${i}`}
              className={`rounded-md px-2 py-1 text-xs font-semibold ${
                ocupados.some((o) => o.toLowerCase() === l.toLowerCase())
                  ? "bg-clinic-primary/20 text-clinic-primary"
                  : "bg-clinic-bg text-clinic-text"
              }`}
            >
              {l}
            </span>
          ))}
        </div>
        {ocupados.length > 0 && <p className="mt-2 text-xs text-clinic-muted">Em destaque: leitos ocupados atualmente.</p>}
        {removidosOcupados.length > 0 && (
          <p className="mt-2 text-xs text-instavel">
            Atenção: os leitos ocupados {removidosOcupados.join(", ")} não estão na nova lista — libere-os antes de removê-los.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary" onClick={salvar} disabled={pendente || !leitos.length || !nome.trim()}>
          {pendente ? "Salvando…" : "Salvar configuração"}
        </button>
        {erro && <span className="text-sm text-instavel">{erro}</span>}
      </div>
    </div>
  );
}
