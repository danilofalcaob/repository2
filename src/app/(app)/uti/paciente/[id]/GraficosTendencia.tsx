"use client";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GRUPO_LABEL, ORDEM_GRUPOS, type Grupo } from "@/lib/exames/catalogo";
import { montarSeries, refAtual, valorComUnidade, type Ponto, type Serie } from "@/lib/exames/series";
import { direcaoFlag, ehAlterado, ehCritico, FLAG_LABEL, textoReferencia, type Resultado } from "@/lib/exames/valores";

// Cores semânticas do app (mesmas do I-PASS): série no tom primário, valores
// alterados em âmbar e críticos em vermelho — sempre acompanhados de rótulo no
// tooltip e de marcador maior (a cor nunca carrega o significado sozinha).
const COR_SERIE = "rgb(var(--clinic-primary))";
const COR_ALTERADO = "#d97706";
const COR_CRITICO = "#dc2626";
const COR_FAIXA = "#16a34a";

const TZ = "America/Sao_Paulo";
const fmtDia = (t: number) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TZ }).format(new Date(t));
const fmtDataHora = (t: number) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(new Date(t));

const PERIODOS = [
  { dias: 3, rotulo: "72h" },
  { dias: 7, rotulo: "7 dias" },
  { dias: 14, rotulo: "14 dias" },
  { dias: 30, rotulo: "30 dias" },
  { dias: 0, rotulo: "Tudo" },
];

// Eixo Y com marcas "redondas" (1, 2, 2,5 ou 5 × 10ⁿ) que incluem valores e referência.
function escalaBonita(min: number, max: number, alvo = 4) {
  if (min === max) {
    const d = Math.abs(min) * 0.1 || 1;
    min -= d;
    max += d;
  }
  const bruto = (max - min) / alvo;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const norm = bruto / mag;
  const passo = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  let ini = Math.floor(min / passo) * passo;
  const fim = Math.ceil(max / passo) * passo;
  if (min >= 0 && ini < 0) ini = 0;
  const ticks: number[] = [];
  for (let v = ini; v <= fim + passo / 2; v += passo) ticks.push(Math.round(v / passo) * passo);
  const casasEixo = Math.max(0, Math.min(3, -Math.floor(Math.log10(passo) + 1e-9) + (norm > 2 && norm <= 2.5 ? 1 : 0)));
  return { dominio: [ini, fim] as [number, number], ticks, casasEixo };
}

function corPonto(p: Ponto) {
  if (ehCritico(p.flag)) return COR_CRITICO;
  if (ehAlterado(p.flag)) return COR_ALTERADO;
  return COR_SERIE;
}

function Marcador(props: { cx?: number; cy?: number; payload?: Ponto; ativo?: boolean }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;
  const alterado = ehAlterado(payload.flag);
  const r = (alterado ? 5 : 4) + (props.ativo ? 1.5 : 0);
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={corPonto(payload)}
      stroke="rgb(var(--clinic-surface))"
      strokeWidth={2}
    />
  );
}

function DicaGrafico({ active, payload, serie }: { active?: boolean; payload?: { payload: Ponto }[]; serie: Serie }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-clinic-border bg-clinic-surface px-3 py-2 text-xs shadow-lg">
      <p className="text-clinic-muted">{fmtDataHora(p.t)}</p>
      <p className="mt-0.5 text-sm font-semibold text-clinic-text">
        {serie.rotulo} {valorComUnidade(p.valor, p.casas, serie.unidade)}
      </p>
      <p className="mt-0.5 flex items-center gap-1.5 text-clinic-text">
        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: corPonto(p) }} />
        {FLAG_LABEL[p.flag]}
      </p>
      {(p.refMin != null || p.refMax != null) && (
        <p className="text-clinic-muted">Ref.: {textoReferencia(p.refMin, p.refMax)}</p>
      )}
    </div>
  );
}

function GraficoSerie({ serie }: { serie: Serie }) {
  const [tabela, setTabela] = useState(false);
  const pontos = serie.pontos;
  const ultimo = pontos[pontos.length - 1];
  const ref = refAtual(serie);
  const dir = direcaoFlag(ultimo.flag);

  const { dominio, ticks, casasEixo } = useMemo(() => {
    const valores = pontos.map((p) => p.valor);
    if (ref.min != null) valores.push(ref.min);
    if (ref.max != null) valores.push(ref.max);
    return escalaBonita(Math.min(...valores), Math.max(...valores));
  }, [pontos, ref.min, ref.max]);

  const xDominio: [number, number] =
    pontos.length > 1 ? [pontos[0].t, ultimo.t] : [ultimo.t - 43_200_000, ultimo.t + 43_200_000];
  // Um único estilo por eixo: compacto ("20 mil") quando o eixo chega a 10.000.
  const compacto = Math.max(Math.abs(dominio[0]), Math.abs(dominio[1])) >= 10000;
  const fmtEixo = (v: number) =>
    new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: compacto ? 0 : casasEixo,
      maximumFractionDigits: compacto ? 1 : casasEixo,
      notation: compacto ? "compact" : "standard",
    }).format(v);

  return (
    <div className="card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold" title={serie.nome}>
            {serie.rotulo}
            {serie.rotulo !== serie.nome && <span className="font-normal text-clinic-muted"> · {serie.nome}</span>}
          </h3>
          <p className="text-xs text-clinic-muted">
            Último: <span className="font-semibold text-clinic-text">{valorComUnidade(ultimo.valor, ultimo.casas, serie.unidade)}</span>
            {dir && (
              <span className={`ml-1 font-semibold ${ehCritico(ultimo.flag) ? "text-instavel" : "text-cuidado"}`}>
                {dir === "alto" ? "▲" : "▼"} {FLAG_LABEL[ultimo.flag].toLowerCase()}
              </span>
            )}
            {(ref.min != null || ref.max != null) && <> · ref. {textoReferencia(ref.min, ref.max)}</>}
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md px-2 py-1 text-[11px] text-clinic-muted hover:bg-clinic-bg"
          onClick={() => setTabela((v) => !v)}
          aria-pressed={tabela}
        >
          {tabela ? "Gráfico" : "Tabela"}
        </button>
      </div>

      {tabela ? (
        <div className="mt-2 max-h-[150px] overflow-y-auto text-xs">
          <table className="w-full">
            <tbody>
              {[...pontos].reverse().map((p) => (
                <tr key={p.t} className="border-t border-clinic-border">
                  <td className="py-1 text-clinic-muted">{fmtDataHora(p.t)}</td>
                  <td className="py-1 text-right font-medium">{valorComUnidade(p.valor, p.casas, serie.unidade)}</td>
                  <td className="py-1 pl-2 text-right text-clinic-muted">{ehAlterado(p.flag) ? FLAG_LABEL[p.flag] : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-2 h-[150px]" role="img" aria-label={`Tendência de ${serie.nome}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pontos} margin={{ top: 8, right: 14, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="rgb(var(--clinic-border))" strokeWidth={1} />
              {(ref.min != null || ref.max != null) && (
                <ReferenceArea
                  y1={ref.min ?? dominio[0]}
                  y2={ref.max ?? dominio[1]}
                  fill={COR_FAIXA}
                  fillOpacity={0.1}
                  stroke="none"
                  ifOverflow="hidden"
                />
              )}
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={xDominio}
                tickFormatter={fmtDia}
                tick={{ fontSize: 10, fill: "rgb(var(--clinic-muted))" }}
                tickLine={false}
                axisLine={{ stroke: "rgb(var(--clinic-border))" }}
                minTickGap={24}
              />
              <YAxis
                domain={dominio}
                tickFormatter={fmtEixo}
                tick={{ fontSize: 10, fill: "rgb(var(--clinic-muted))" }}
                tickLine={false}
                axisLine={false}
                width={44}
                ticks={ticks}
              />
              <Tooltip
                content={<DicaGrafico serie={serie} />}
                cursor={{ stroke: "rgb(var(--clinic-muted))", strokeWidth: 1 }}
                isAnimationActive={false}
              />
              <Line
                type="linear"
                dataKey="valor"
                stroke={COR_SERIE}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                dot={({ key: _k, ...p }: any) => <Marcador key={`d${p.index}`} {...p} />}
                activeDot={({ key: _k, ...p }: any) => <Marcador key={`a${p.index}`} {...p} ativo />}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function GraficosTendencia({ resultados }: { resultados: Resultado[] }) {
  const [somenteAlterados, setSomenteAlterados] = useState(true);
  const [periodo, setPeriodo] = useState(0);
  const [grupo, setGrupo] = useState<Grupo | "todos">("todos");

  const series = useMemo(() => {
    const inicio = periodo ? Date.now() - periodo * 86_400_000 : null;
    return montarSeries(resultados)
      .map((s) => (inicio ? { ...s, pontos: s.pontos.filter((p) => p.t >= inicio) } : s))
      .filter((s) => s.pontos.length > 0);
  }, [resultados, periodo]);

  const visiveis = series.filter(
    (s) =>
      (!somenteAlterados || s.pontos.some((p) => ehAlterado(p.flag))) &&
      (grupo === "todos" || (s.analito?.grupo ?? "outros") === grupo),
  );
  const gruposPresentes = ORDEM_GRUPOS.filter((g) => series.some((s) => (s.analito?.grupo ?? "outros") === g));
  const porGrupo = ORDEM_GRUPOS.map((g) => ({
    grupo: g,
    series: visiveis.filter((s) => (s.analito?.grupo ?? "outros") === g),
  })).filter((x) => x.series.length);

  if (!resultados.length) {
    return <p className="card p-6 text-center text-sm text-clinic-muted">Nenhum exame registrado ainda.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Filtros numa única linha acima dos gráficos */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-clinic-border bg-clinic-surface p-0.5 text-xs">
          {[
            { v: true, r: "Somente alterados" },
            { v: false, r: "Todos os exames" },
          ].map((o) => (
            <button
              key={o.r}
              type="button"
              onClick={() => setSomenteAlterados(o.v)}
              className={`rounded-md px-3 py-1.5 font-medium ${
                somenteAlterados === o.v ? "bg-clinic-primary text-clinic-primaryfg" : "text-clinic-muted hover:text-clinic-text"
              }`}
            >
              {o.r}
            </button>
          ))}
        </div>
        <select
          className="input !w-auto !py-1.5 text-xs"
          value={periodo}
          onChange={(e) => setPeriodo(Number(e.target.value))}
          aria-label="Período"
        >
          {PERIODOS.map((p) => (
            <option key={p.dias} value={p.dias}>
              {p.rotulo}
            </option>
          ))}
        </select>
        <select
          className="input !w-auto !py-1.5 text-xs"
          value={grupo}
          onChange={(e) => setGrupo(e.target.value as Grupo | "todos")}
          aria-label="Grupo de exames"
        >
          <option value="todos">Todos os grupos</option>
          {gruposPresentes.map((g) => (
            <option key={g} value={g}>
              {GRUPO_LABEL[g]}
            </option>
          ))}
        </select>
        <span className="ml-auto flex items-center gap-3 text-[11px] text-clinic-muted">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-4 rounded-sm" style={{ backgroundColor: COR_FAIXA, opacity: 0.25 }} />
            Faixa de referência
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COR_ALTERADO }} /> Alterado
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COR_CRITICO }} /> Crítico
          </span>
        </span>
      </div>

      {porGrupo.length === 0 && (
        <p className="card p-6 text-center text-sm text-clinic-muted">
          {somenteAlterados ? "Nenhum exame alterado no período. 🎉" : "Nenhum exame no período."}
        </p>
      )}
      {porGrupo.map(({ grupo: g, series: lista }) => (
        <section key={g}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-clinic-muted">{GRUPO_LABEL[g]}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {lista.map((s) => (
              <GraficoSerie key={s.chave} serie={s} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
