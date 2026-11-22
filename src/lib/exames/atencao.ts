// Pontos de atenção: exames alterados no resultado mais recente de cada
// analito, com valor crítico, tendência em relação ao exame anterior e
// alterações que acabaram de normalizar. Arquivo puro.

import { GRUPO_LABEL, ordemAnalito } from "./catalogo";
import { rotuloExame, valorExibido } from "./linha";
import { montarSeries, type Serie } from "./series";
import { direcaoFlag, ehAlterado, ehCritico, textoReferencia, type Flag, type Resultado } from "./valores";
import { formatarUnidade } from "./catalogo";

export type Tendencia = "novo" | "piorando" | "melhorando" | "persistente";

export const TENDENCIA_LABEL: Record<Tendencia, string> = {
  novo: "Novo",
  piorando: "Piorando",
  melhorando: "Melhorando",
  persistente: "Persistente",
};

export type PontoAtencao = {
  chave: string;
  rotulo: string;
  nome: string;
  grupo: string;
  valor: string; // "6,1 mEq/L"
  flag: Flag;
  critico: boolean;
  tendencia: Tendencia;
  referencia: string;
  coletadoEm: string;
  anterior: { valor: string; coletadoEm: string; flag: Flag } | null;
  ordem: number;
};

export type Normalizado = {
  chave: string;
  rotulo: string;
  valor: string;
  coletadoEm: string;
  anterior: { valor: string; coletadoEm: string };
};

export type PainelAtencao = {
  alterados: PontoAtencao[];
  normalizados: Normalizado[];
  ultimaColeta: string | null;
  criticos: number;
};

const PESO_TENDENCIA: Record<Tendencia, number> = { piorando: 0, novo: 1, persistente: 2, melhorando: 3 };

function valorTexto(r: Resultado): string {
  return `${valorExibido(r)}${formatarUnidade(r.unidade)}`;
}

function relevante(s: Serie, a: number, b: number): boolean {
  const an = s.analito;
  const d = Math.abs(a - b);
  if (an?.delta != null) return d >= an.delta - 1e-9;
  return d >= (an?.deltaRel ?? 0.15) * Math.max(Math.abs(a), Math.abs(b)) - 1e-9;
}

// Compara com o exame anterior; se a variação não for relevante, compara com o
// exame mais antigo das 72 h anteriores (pega tendências lentas, como a
// creatinina subindo um pouco a cada dia).
function tendencia(s: Serie, indice: number): Tendencia {
  const atual = s.pontos[indice];
  const anterior = s.pontos[indice - 1];
  const dir = direcaoFlag(atual.flag);
  if (!anterior || !ehAlterado(anterior.flag) || direcaoFlag(anterior.flag) !== dir) return "novo";
  if (!dir) return "persistente";
  const janela = s.pontos.slice(0, indice).filter((p) => atual.t - p.t <= 72 * 3600_000);
  for (const ref of [anterior, janela[0]]) {
    if (!ref || !relevante(s, ref.valor, atual.valor)) continue;
    const piorou = dir === "alto" ? atual.valor > ref.valor : atual.valor < ref.valor;
    return piorou ? "piorando" : "melhorando";
  }
  return "persistente";
}

export function pontosDeAtencao(resultados: Resultado[]): PainelAtencao {
  const series = montarSeries(resultados);
  const alterados: PontoAtencao[] = [];
  const normalizados: Normalizado[] = [];
  let ultimaColeta: string | null = null;

  for (const s of series) {
    const n = s.pontos.length;
    const atual = s.pontos[n - 1];
    const anterior = n > 1 ? s.pontos[n - 2] : undefined;
    if (!ultimaColeta || atual.iso > ultimaColeta) ultimaColeta = atual.iso;
    const r = atual.original;
    if (ehAlterado(atual.flag)) {
      alterados.push({
        chave: s.chave,
        rotulo: rotuloExame(r),
        nome: s.nome,
        grupo: GRUPO_LABEL[s.analito?.grupo ?? "outros"],
        valor: valorTexto(r),
        flag: atual.flag,
        critico: ehCritico(atual.flag),
        tendencia: tendencia(s, n - 1),
        referencia: textoReferencia(r.refMin, r.refMax),
        coletadoEm: atual.iso,
        anterior: anterior
          ? { valor: valorTexto(anterior.original), coletadoEm: anterior.iso, flag: anterior.flag }
          : null,
        ordem: ordemAnalito(s.chave),
      });
    } else if (anterior && ehAlterado(anterior.flag) && atual.flag === "normal") {
      normalizados.push({
        chave: s.chave,
        rotulo: rotuloExame(r),
        valor: valorTexto(r),
        coletadoEm: atual.iso,
        anterior: { valor: valorTexto(anterior.original), coletadoEm: anterior.iso },
      });
    }
  }

  // Resultados qualitativos alterados (sem valor numérico), último de cada exame.
  const qualitativos = new Map<string, Resultado>();
  for (const r of resultados) {
    if (r.valor != null || r.flag !== "alterado") continue;
    const atual = qualitativos.get(r.nome);
    if (!atual || r.coletadoEm > atual.coletadoEm) qualitativos.set(r.nome, r);
  }
  for (const r of qualitativos.values()) {
    alterados.push({
      chave: `quali:${r.nome}`,
      rotulo: r.nome,
      nome: r.nome,
      grupo: GRUPO_LABEL.outros,
      valor: r.valorTexto,
      flag: "alterado",
      critico: false,
      tendencia: "persistente",
      referencia: r.refTexto ?? "—",
      coletadoEm: r.coletadoEm,
      anterior: null,
      ordem: 99_000,
    });
  }

  alterados.sort(
    (a, b) =>
      Number(b.critico) - Number(a.critico) ||
      PESO_TENDENCIA[a.tendencia] - PESO_TENDENCIA[b.tendencia] ||
      a.ordem - b.ordem,
  );
  return { alterados, normalizados, ultimaColeta, criticos: alterados.filter((a) => a.critico).length };
}
