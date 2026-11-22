"use client";
import { useEffect, useMemo, useState } from "react";
import CopiarBotao from "@/components/CopiarBotao";
import { gerarEvolucao, TIPO_FRASE_LABEL, type TipoFrase } from "@/lib/exames/evolucao";
import { linhasDeExames } from "@/lib/exames/linha";
import type { Resultado } from "@/lib/exames/valores";

const JANELAS = [
  { dias: 1, rotulo: "Últimas 24h" },
  { dias: 2, rotulo: "Últimas 48h" },
  { dias: 3, rotulo: "Últimas 72h" },
  { dias: 7, rotulo: "Últimos 7 dias" },
  { dias: 14, rotulo: "Últimos 14 dias" },
  { dias: 0, rotulo: "Toda a internação" },
];

const ESTILO_TIPO: Record<TipoFrase, string> = {
  atual: "bg-cuidado/15 text-cuidado",
  nova: "bg-cuidado/15 text-cuidado",
  piora: "bg-instavel/15 text-instavel",
  melhora: "bg-estavel/15 text-estavel",
  normalizou: "bg-estavel/15 text-estavel",
  estavel: "bg-clinic-bg text-clinic-muted",
};

export default function ResumoEvolutivo({ resultados }: { resultados: Resultado[] }) {
  const [janela, setJanela] = useState(7);
  const [valores, setValores] = useState(true);
  const [discretas, setDiscretas] = useState(false);
  const [incluirLab, setIncluirLab] = useState(true);
  const [turno, setTurno] = useState<"diurna" | "noturna">(() => {
    const h = new Date().getHours();
    return h >= 7 && h < 19 ? "diurna" : "noturna";
  });

  const ev = useMemo(
    () => gerarEvolucao(resultados, { janelaDias: janela || null, incluirValores: valores, incluirDiscretas: discretas }),
    [resultados, janela, valores, discretas],
  );
  const ultimaLinha = useMemo(() => linhasDeExames(resultados, { ordem: "recente" })[0]?.texto ?? "", [resultados]);

  const textoGerado = `${ev.texto}${incluirLab && ultimaLinha ? `\n${ultimaLinha}` : ""}`;
  const [texto, setTexto] = useState(textoGerado);
  const [editado, setEditado] = useState(false);
  useEffect(() => {
    if (!editado) setTexto(textoGerado);
  }, [textoGerado, editado]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input !w-auto !py-1.5 text-xs" value={janela} onChange={(e) => setJanela(Number(e.target.value))} aria-label="Período analisado">
          {JANELAS.map((j) => (
            <option key={j.dias} value={j.dias}>
              {j.rotulo}
            </option>
          ))}
        </select>
        <div className="inline-flex rounded-lg border border-clinic-border bg-clinic-surface p-0.5 text-xs">
          {(["diurna", "noturna"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTurno(t)}
              className={`rounded-md px-3 py-1.5 font-medium ${
                turno === t ? "bg-clinic-primary text-clinic-primaryfg" : "text-clinic-muted hover:text-clinic-text"
              }`}
            >
              {t === "diurna" ? "☀️ Evolução diurna" : "🌙 Evolução noturna"}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={valores} onChange={(e) => setValores(e.target.checked)} /> Incluir valores
        </label>
        <label className="flex items-center gap-1.5 text-xs" title="Alterações que ultrapassam a referência por menos que a variação relevante do exame">
          <input type="checkbox" checked={discretas} onChange={(e) => setDiscretas(e.target.checked)} /> Incluir alterações discretas
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={incluirLab} onChange={(e) => setIncluirLab(e.target.checked)} /> Anexar último laboratório em linha
        </label>
      </div>

      <div className="card p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Evolução {turno === "diurna" ? "diurna" : "noturna"} · laboratório</h2>
          <div className="flex gap-2">
            {editado && (
              <button type="button" className="btn-secondary !py-1.5 text-xs" onClick={() => setEditado(false)}>
                ↺ Regenerar
              </button>
            )}
            <CopiarBotao texto={texto} rotulo="Copiar para o prontuário" className="btn-primary !py-1.5 text-xs" />
          </div>
        </div>
        <textarea
          className="input min-h-[130px] text-sm leading-relaxed"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setEditado(true);
          }}
          aria-label="Texto da evolução"
        />
        <p className="mt-2 text-[11px] text-clinic-muted">
          Gerado por regras a partir dos exames registrados (referências do laudo; variações relevantes definidas por
          exame; função renal pelo critério de creatinina KDIGO). Revise e complemente com o contexto clínico antes de
          registrar.
        </p>
      </div>

      {ev.frases.length > 0 && (
        <div className="card p-4">
          <h3 className="mb-2 text-sm font-semibold">Achados que compõem o resumo</h3>
          <ul className="space-y-2">
            {ev.frases.map((f) => (
              <li key={`${f.chave}-${f.ordem}`} className="flex flex-wrap items-start gap-2 text-sm">
                <span className={`badge shrink-0 ${ESTILO_TIPO[f.tipo]}`}>{TIPO_FRASE_LABEL[f.tipo]}</span>
                <span className="flex-1">{valores ? f.texto : f.textoSemValores}</span>
                <CopiarBotao texto={valores ? f.texto : f.textoSemValores} rotulo="" className="rounded-md px-2 py-1 text-xs text-clinic-muted hover:bg-clinic-bg" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
