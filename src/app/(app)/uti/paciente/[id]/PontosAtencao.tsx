"use client";
import { useMemo } from "react";
import CopiarBotao from "@/components/CopiarBotao";
import { pontosDeAtencao, TENDENCIA_LABEL, type PontoAtencao, type Tendencia } from "@/lib/exames/atencao";
import { FLAG_LABEL, type Resultado } from "@/lib/exames/valores";

const TZ = "America/Sao_Paulo";
const dataHora = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(
    new Date(iso),
  );
const dia = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TZ }).format(new Date(iso));

const ESTILO_TENDENCIA: Record<Tendencia, string> = {
  piorando: "bg-instavel/15 text-instavel",
  novo: "bg-cuidado/15 text-cuidado",
  persistente: "bg-clinic-bg text-clinic-muted",
  melhorando: "bg-estavel/15 text-estavel",
};
const ICONE_TENDENCIA: Record<Tendencia, string> = { piorando: "↗", novo: "●", persistente: "→", melhorando: "↘" };

function textoParaCopiar(alterados: PontoAtencao[]): string {
  if (!alterados.length) return "";
  return (
    "Pontos de atenção: " +
    alterados
      .map((a) => {
        const marcas = [a.critico ? "crítico" : null, a.tendencia !== "persistente" ? TENDENCIA_LABEL[a.tendencia].toLowerCase() : null]
          .filter(Boolean)
          .join(", ");
        const ant = a.anterior ? `; anterior ${a.anterior.valor} em ${dia(a.anterior.coletadoEm)}` : "";
        return `${a.rotulo} ${a.valor}${marcas || ant ? ` (${[marcas, ant.replace(/^; /, "")].filter(Boolean).join("; ")})` : ""}`;
      })
      .join(" / ") +
    "."
  );
}

export default function PontosAtencao({ resultados }: { resultados: Resultado[] }) {
  const painel = useMemo(() => pontosDeAtencao(resultados), [resultados]);
  const criticos = painel.alterados.filter((a) => a.critico);
  const demais = painel.alterados.filter((a) => !a.critico);

  if (!resultados.length) {
    return <p className="card p-6 text-center text-sm text-clinic-muted">Nenhum exame registrado ainda.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-clinic-muted">
          Último resultado de cada exame
          {painel.ultimaColeta && <> · coleta mais recente em {dataHora(painel.ultimaColeta)}</>}
        </p>
        <CopiarBotao texto={textoParaCopiar(painel.alterados)} rotulo="Copiar pontos de atenção" />
      </div>

      {criticos.length > 0 && (
        <section className="card border-instavel/50 bg-instavel/5 p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-instavel">🚨 Valores críticos ({criticos.length})</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {criticos.map((a) => (
              <li key={a.chave} className="rounded-lg border border-instavel/30 bg-clinic-surface p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">{a.rotulo}</span>
                  <span className="text-lg font-bold text-instavel">{a.valor}</span>
                </div>
                <p className="mt-1 text-xs text-clinic-muted">
                  {FLAG_LABEL[a.flag]} · ref. {a.referencia} · {dataHora(a.coletadoEm)}
                  {a.anterior && <> · anterior {a.anterior.valor}</>}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="border-b border-clinic-border px-4 py-3">
          <h2 className="font-semibold">Exames alterados ({demais.length})</h2>
        </div>
        {demais.length === 0 ? (
          <p className="p-4 text-sm text-clinic-muted">
            {criticos.length ? "Sem outras alterações." : "Nenhum exame alterado no último resultado. 🎉"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-clinic-bg text-left text-xs uppercase text-clinic-muted">
                <tr>
                  <th className="p-3">Exame</th>
                  <th className="p-3">Resultado</th>
                  <th className="p-3">Tendência</th>
                  <th className="hidden p-3 sm:table-cell">Anterior</th>
                  <th className="hidden p-3 md:table-cell">Referência</th>
                  <th className="p-3">Coleta</th>
                </tr>
              </thead>
              <tbody>
                {demais.map((a) => (
                  <tr key={a.chave} className="border-t border-clinic-border">
                    <td className="p-3">
                      <span className="font-medium">{a.rotulo}</span>
                      <span className="block text-[11px] text-clinic-muted">{a.grupo}</span>
                    </td>
                    <td className="p-3">
                      <span className="font-semibold">{a.valor}</span>
                      <span className="block text-[11px] text-cuidado">
                        {a.flag === "alto" ? "▲ " : a.flag === "baixo" ? "▼ " : ""}
                        {FLAG_LABEL[a.flag]}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`badge ${ESTILO_TENDENCIA[a.tendencia]}`}>
                        {ICONE_TENDENCIA[a.tendencia]} {TENDENCIA_LABEL[a.tendencia]}
                      </span>
                    </td>
                    <td className="hidden p-3 text-clinic-muted sm:table-cell">
                      {a.anterior ? (
                        <>
                          {a.anterior.valor}
                          <span className="block text-[11px]">{dia(a.anterior.coletadoEm)}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="hidden p-3 text-clinic-muted md:table-cell">{a.referencia}</td>
                    <td className="p-3 text-xs text-clinic-muted">{dataHora(a.coletadoEm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {painel.normalizados.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 font-semibold text-estavel">✓ Normalizados no último exame</h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {painel.normalizados.map((n) => (
              <li key={n.chave} className="rounded-lg bg-estavel/10 px-3 py-1.5">
                <span className="font-medium">{n.rotulo}</span> {n.anterior.valor} → <span className="font-semibold">{n.valor}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
