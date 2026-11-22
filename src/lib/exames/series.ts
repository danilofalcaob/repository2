// Séries temporais por exame, na unidade canônica do catálogo (para gráficos,
// tendências, pontos de atenção e resumo evolutivo). Arquivo puro.

import {
  fatorConversao,
  formatarUnidade,
  getAnalito,
  normalizarNome,
  ordemAnalito,
  type Analito,
} from "./catalogo";
import { formatarNumeroBR, type Flag, type Resultado } from "./valores";

export type Ponto = {
  t: number; // epoch ms
  iso: string;
  valor: number; // unidade canônica
  casas: number; // casas decimais para exibição
  refMin: number | null;
  refMax: number | null;
  flag: Flag;
  original: Resultado;
};

export type Serie = {
  chave: string; // código do catálogo ou "outro:<nome>"
  analito?: Analito;
  rotulo: string;
  nome: string;
  unidade: string;
  casas: number;
  pontos: Ponto[]; // ordem cronológica
};

export function chaveSerie(r: Pick<Resultado, "analito" | "nome">): string {
  return getAnalito(r.analito) ? r.analito : `outro:${normalizarNome(r.nome)}`;
}

const arred = (v: number) => Math.round(v * 1e6) / 1e6;

export function montarSeries(resultados: Resultado[]): Serie[] {
  const mapa = new Map<string, Serie>();
  for (const r of resultados) {
    if (r.valor == null || !Number.isFinite(r.valor)) continue;
    const analito = getAnalito(r.analito);
    const chave = chaveSerie(r);
    let fator = 1;
    let unidade = r.unidade ?? "";
    if (analito) {
      const f = fatorConversao(analito, r.unidade);
      if (f == null) continue; // unidade desconhecida: não mistura na série
      fator = f;
      unidade = analito.unidade;
    }
    let serie = mapa.get(chave);
    if (!serie) {
      serie = {
        chave,
        analito,
        rotulo: analito?.rotulo ?? r.nome,
        nome: analito?.nome ?? r.nome,
        unidade,
        casas: analito?.casas ?? r.casas ?? 1,
        pontos: [],
      };
      mapa.set(chave, serie);
    } else if (!analito && serie.unidade !== unidade) {
      continue; // exame livre com unidades diferentes: mantém a primeira
    }
    const t = new Date(r.coletadoEm).getTime();
    const ponto: Ponto = {
      t,
      iso: r.coletadoEm,
      valor: arred(r.valor * fator),
      casas: fator === 1 ? (r.casas ?? serie.casas) : serie.casas,
      refMin: r.refMin != null ? arred(r.refMin * fator) : null,
      refMax: r.refMax != null ? arred(r.refMax * fator) : null,
      flag: r.flag,
      original: r,
    };
    // Mesmo horário de coleta: o último registro prevalece.
    const idx = serie.pontos.findIndex((p) => p.t === t);
    if (idx >= 0) serie.pontos[idx] = ponto;
    else serie.pontos.push(ponto);
  }
  const series = [...mapa.values()];
  for (const s of series) s.pontos.sort((a, b) => a.t - b.t);
  return series.sort((a, b) => ordemAnalito(a.chave) - ordemAnalito(b.chave) || a.nome.localeCompare(b.nome));
}

// "6.520/mm³", "4,5 mEq/L", "44,0%", "7,21" (pH sem unidade).
export function valorComUnidade(valor: number, casas: number, unidade: string | null | undefined): string {
  return formatarNumeroBR(valor, casas) + formatarUnidade(unidade);
}

// Faixa de referência mais recente da série (para o gráfico).
export function refAtual(s: Serie): { min: number | null; max: number | null } {
  for (let i = s.pontos.length - 1; i >= 0; i--) {
    const p = s.pontos[i];
    if (p.refMin != null || p.refMax != null) return { min: p.refMin, max: p.refMax };
  }
  return { min: null, max: null };
}
