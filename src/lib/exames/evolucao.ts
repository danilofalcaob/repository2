// Resumo evolutivo laboratorial para o item "Evolução" do prontuário
// (evoluções diurna e noturna da UTI). Exemplos de saída:
//
//   "Evoluiu com leucocitose progressiva (Leucócitos 12.300 → 18.900/mm³) e
//    piora da função renal (Cr 0,90 → 2,10 mg/dL; KDIGO 2 pelo critério de
//    creatinina). Evoluiu com hipercalemia (pico de K 6,1 mEq/L em 01/06), com
//    melhora e normalização nos últimos 2 dias (K 4,5 mEq/L). Mantém anemia
//    estável (Hb 8,1 a 8,6 g/dL)."
//
// Regras determinísticas e auditáveis (sem IA): cada frase nasce de uma série
// temporal de um exame, comparando valores com a referência do laudo e com
// limiares de variação relevante definidos no catálogo. Arquivo puro.

import { getAnalito, GRUPO_LABEL, ordemAnalito, type Analito, type Sindrome } from "./catalogo";
import { chaveDia } from "./parser";
import { montarSeries, valorComUnidade, type Ponto, type Serie } from "./series";
import { direcaoFlag, type Resultado } from "./valores";

export type TipoFrase = "atual" | "nova" | "piora" | "melhora" | "normalizou" | "estavel";

export const TIPO_FRASE_LABEL: Record<TipoFrase, string> = {
  atual: "Alteração atual",
  nova: "Nova alteração",
  piora: "Piora",
  melhora: "Em melhora",
  normalizou: "Normalizou",
  estavel: "Estável",
};

export type FraseEvolucao = {
  chave: string;
  tipo: TipoFrase;
  grupo: string;
  nucleo: string; // ex.: "leucocitose progressiva"
  detalhe: string; // ex.: "(Leucócitos 12.300 → 18.900/mm³)"
  texto: string; // frase completa, com valores
  textoSemValores: string;
  agrupavel: boolean; // pode ser combinada com outras na mesma oração
  ordem: number;
};

export type OpcoesEvolucao = {
  agora?: Date;
  janelaDias?: number | null; // null = toda a internação
  incluirValores?: boolean;
  incluirDiscretas?: boolean; // inclui alterações discretas (pouco além da referência)
};

export type ResultadoEvolucao = {
  frases: FraseEvolucao[];
  texto: string;
  semExames: boolean;
  ultimaColeta: string | null;
  inicioJanela: string | null;
};

type Dir = "alto" | "baixo";

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const TZ = "America/Sao_Paulo";
const ddmm = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TZ }).format(new Date(iso));
const ddmmaaaa = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ }).format(
    new Date(iso),
  );

function relevante(a: number, b: number, an?: Analito): boolean {
  const d = Math.abs(a - b);
  if (an?.delta != null) return d >= an.delta - 1e-9;
  const rel = an?.deltaRel ?? 0.15;
  return d >= rel * Math.max(Math.abs(a), Math.abs(b)) - 1e-9;
}

const gravidade = (v: number, dir: Dir) => (dir === "alto" ? v : -v);
const ehAnormal = (p: Ponto, dir: Dir) => direcaoFlag(p.flag) === dir;
const progressivo = (s: Sindrome) => (s.genero === "f" ? "progressiva" : "progressivo");

// Coloca o adjetivo antes do complemento: "alargamento progressivo do INR",
// "elevação progressiva de PCR", "desvio progressivo à esquerda".
function comAdjetivo(nome: string, adj: string): string {
  const m = nome.match(/^(\S+)( (?:de|do|da|dos|das|à) .+)$/);
  return m ? `${m[1]} ${adj}${m[2]}` : `${nome} ${adj}`;
}

// Alteração discreta: o pior valor ultrapassa o limite da referência por menos
// que a variação relevante do exame (ex.: Cl 109 com referência até 107).
// Valores críticos nunca são discretos.
function apenasDiscreta(s: Serie, dir: Dir): boolean {
  const an = s.analito;
  for (const p of s.pontos) {
    if (!ehAnormal(p, dir)) continue;
    if (p.flag === "critico_alto" || p.flag === "critico_baixo") return false;
    const limite = dir === "alto" ? p.refMax : p.refMin;
    if (limite == null) return false;
    const desvio = dir === "alto" ? p.valor - limite : limite - p.valor;
    const minimo = an?.delta ?? (an?.deltaRel ?? 0.15) * Math.abs(limite);
    if (desvio >= minimo - 1e-9) return false;
  }
  return true;
}

function fmt(s: Serie, p: Ponto): string {
  return valorComUnidade(p.valor, p.casas, s.unidade);
}

function fmtSemUnidade(s: Serie, p: Ponto): string {
  return valorComUnidade(p.valor, p.casas, "");
}

// Quantos dias distintos (calendário de São Paulo) há numa lista de pontos.
function diasDistintos(pontos: Ponto[]): number {
  return new Set(pontos.map((p) => chaveDia(p.iso))).size;
}

function quandoNormalizou(pontos: Ponto[]): string {
  const dias = diasDistintos(pontos);
  if (dias >= 2) return `nos últimos ${dias} dias`;
  return pontos.length > 1 ? "nas últimas 24 horas" : "no último exame";
}

function extremo(pontos: Ponto[], dir: Dir): Ponto {
  return pontos.reduce((a, b) => (gravidade(b.valor, dir) > gravidade(a.valor, dir) ? b : a));
}

function semPioraRelevante(pontos: Ponto[], dir: Dir, an?: Analito): boolean {
  for (let i = 1; i < pontos.length; i++) {
    const a = pontos[i - 1].valor;
    const b = pontos[i].valor;
    if (gravidade(b, dir) < gravidade(a, dir) && relevante(a, b, an)) return false;
  }
  return true;
}

type Parcial = Omit<FraseEvolucao, "texto" | "textoSemValores" | "ordem" | "grupo" | "chave"> & {
  textoBase: string; // frase sem o detalhe
  textoComDetalhe: string;
};

function frase(
  tipo: TipoFrase,
  nucleo: string,
  detalhe: string,
  textoComDetalhe: string,
  textoBase: string,
  agrupavel: boolean,
): Parcial {
  return { tipo, nucleo, detalhe, textoComDetalhe, textoBase, agrupavel };
}

// ---------------------------------------------------------------------------
// Descrição genérica de uma série numa direção (alto/baixo)
// ---------------------------------------------------------------------------

function descreverSerie(
  s: Serie,
  dir: Dir,
  sindrome: Sindrome,
  incluirDiscretas: boolean,
  nomeSindrome = sindrome.nome,
): Parcial | null {
  const pts = s.pontos;
  const an = s.analito;
  if (!pts.some((p) => ehAnormal(p, dir))) return null;
  if (!incluirDiscretas && apenasDiscreta(s, dir)) return null;
  const n = pts.length;
  const ultimo = pts[n - 1];
  const rot = s.rotulo;

  // Normalizou: o(s) último(s) exame(s) normais depois de alteração.
  if (!ehAnormal(ultimo, dir)) {
    let k = n - 1;
    while (k > 0 && !ehAnormal(pts[k - 1], dir)) k--;
    const antes = pts.slice(0, k).filter((p) => ehAnormal(p, dir));
    if (!antes.length) return null;
    const pico = extremo(antes, dir);
    const palavraPico = dir === "alto" ? "pico" : "nadir";
    // Saiu desta alteração para a oposta (ex.: hipercalemia → hipocalemia após
    // correção): não é "normalização"; a nova alteração tem frase própria.
    if (direcaoFlag(ultimo.flag) != null) {
      return frase(
        "normalizou",
        nomeSindrome,
        "",
        `Evoluiu com ${nomeSindrome} (${palavraPico} de ${rot} ${fmt(s, pico)} em ${ddmm(pico.iso)}), já resolvida`,
        `Evoluiu com ${nomeSindrome}, já resolvida`,
        false,
      );
    }
    const quando = quandoNormalizou(pts.slice(k));
    const base = `Evoluiu com ${nomeSindrome}, com melhora e normalização ${quando}`;
    const comDetalhe = `Evoluiu com ${nomeSindrome} (${palavraPico} de ${rot} ${fmt(s, pico)} em ${ddmm(pico.iso)}), com melhora e normalização ${quando} (${rot} ${fmt(s, ultimo)})`;
    return frase("normalizou", nomeSindrome, "", comDetalhe, base, false);
  }

  // Último exame alterado.
  if (n === 1) {
    const detalhe = `(${rot} ${fmt(s, ultimo)})`;
    return frase("atual", nomeSindrome, detalhe, `Apresenta ${nomeSindrome} ${detalhe}`, `Apresenta ${nomeSindrome}`, true);
  }

  let j = n - 1;
  while (j > 0 && ehAnormal(pts[j - 1], dir)) j--;
  const sequencia = pts.slice(j);
  const pico = extremo(sequencia, dir);
  const emMelhoraDoPico =
    pico !== ultimo &&
    gravidade(ultimo.valor, dir) < gravidade(pico.valor, dir) &&
    relevante(pico.valor, ultimo.valor, an);

  if (j > 0) {
    // Alteração nova dentro do período (havia exame normal antes).
    const base = pts[j - 1];
    if (emMelhoraDoPico) {
      const detalhe = `(${rot} ${fmtSemUnidade(s, base)} → ${fmtSemUnidade(s, pico)} → ${fmt(s, ultimo)})`;
      return frase(
        "nova",
        nomeSindrome,
        detalhe,
        `Evoluiu com ${nomeSindrome}, já em melhora ${detalhe}`,
        `Evoluiu com ${nomeSindrome}, já em melhora`,
        false,
      );
    }
    const progressiva =
      sequencia.length >= 2 &&
      semPioraRelevante(sequencia, dir, an) &&
      gravidade(ultimo.valor, dir) > gravidade(sequencia[0].valor, dir);
    const nucleo = progressiva ? comAdjetivo(nomeSindrome, progressivo(sindrome)) : nomeSindrome;
    const detalhe = `(${rot} ${fmtSemUnidade(s, base)} → ${fmt(s, ultimo)})`;
    return frase("nova", nucleo, detalhe, `Evoluiu com ${nucleo} ${detalhe}`, `Evoluiu com ${nucleo}`, true);
  }

  // Alterado durante todo o período.
  const primeiro = pts[0];
  const piorou =
    gravidade(ultimo.valor, dir) > gravidade(primeiro.valor, dir) && relevante(primeiro.valor, ultimo.valor, an);
  if (piorou && !emMelhoraDoPico) {
    const nucleo = comAdjetivo(nomeSindrome, progressivo(sindrome));
    const detalhe = `(${rot} ${fmtSemUnidade(s, primeiro)} → ${fmt(s, ultimo)})`;
    return frase("piora", nucleo, detalhe, `Evoluiu com ${nucleo} ${detalhe}`, `Evoluiu com ${nucleo}`, true);
  }
  if (emMelhoraDoPico) {
    const detalhe =
      pico === primeiro
        ? `(${rot} ${fmtSemUnidade(s, primeiro)} → ${fmt(s, ultimo)})`
        : `(${rot} ${fmtSemUnidade(s, primeiro)} → ${fmtSemUnidade(s, pico)} → ${fmt(s, ultimo)})`;
    return frase(
      "melhora",
      nomeSindrome,
      detalhe,
      `Mantém ${nomeSindrome}, porém em melhora ${detalhe}`,
      `Mantém ${nomeSindrome}, porém em melhora`,
      false,
    );
  }
  const min = sequencia.reduce((a, b) => (b.valor < a.valor ? b : a));
  const max = sequencia.reduce((a, b) => (b.valor > a.valor ? b : a));
  const detalhe =
    min.valor === max.valor ? `(${rot} ${fmt(s, min)})` : `(${rot} ${fmtSemUnidade(s, min)} a ${fmt(s, max)})`;
  return frase(
    "estavel",
    nomeSindrome,
    detalhe,
    `Mantém ${comAdjetivo(nomeSindrome, "estável")} ${detalhe}`,
    `Mantém ${comAdjetivo(nomeSindrome, "estável")}`,
    true,
  );
}

// ---------------------------------------------------------------------------
// Regras específicas
// ---------------------------------------------------------------------------

// Função renal pela creatinina, com estadiamento KDIGO (critério de creatinina).
function descreverFuncaoRenal(s: Serie, incluirDiscretas: boolean): Parcial | null {
  const pts = s.pontos;
  if (!pts.length) return null;
  const an = s.analito;
  const ultimo = pts[pts.length - 1];
  const ultimoAlterado = ehAnormal(ultimo, "alto");

  // Maior elevação em relação ao menor valor anterior (basal do período).
  let melhor = { inc: 0, razao: 1, iBase: 0, iPico: 0 };
  let iMin = 0;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i - 1].valor < pts[iMin].valor) iMin = i - 1;
    const inc = pts[i].valor - pts[iMin].valor;
    if (inc > melhor.inc) melhor = { inc, razao: pts[i].valor / pts[iMin].valor, iBase: iMin, iPico: i };
  }
  const lesao = melhor.inc >= 0.3 - 1e-9 || melhor.razao >= 1.5;
  const rot = s.rotulo;

  if (lesao) {
    const base = pts[melhor.iBase];
    const pico = pts[melhor.iPico];
    const estagio =
      melhor.razao >= 3 || (pico.valor >= 4 && melhor.inc >= 0.3) ? 3 : melhor.razao >= 2 ? 2 : 1;
    const kdigo = `KDIGO ${estagio} pelo critério de creatinina`;
    const recuperou = ultimo !== pico && pico.valor - ultimo.valor >= (an?.delta ?? 0.3) - 1e-9;
    if (!recuperou) {
      const detalhe = `(${rot} ${fmtSemUnidade(s, base)} → ${fmt(s, ultimo)}; ${kdigo})`;
      return frase(
        "piora",
        "piora da função renal",
        detalhe,
        `Evoluiu com piora da função renal ${detalhe}`,
        "Evoluiu com piora da função renal",
        true,
      );
    }
    const posPico = pts.slice(melhor.iPico + 1);
    if (!ultimoAlterado) {
      const normais: Ponto[] = [];
      for (let i = posPico.length - 1; i >= 0 && !ehAnormal(posPico[i], "alto"); i--) normais.unshift(posPico[i]);
      const quando = quandoNormalizou(normais.length ? normais : [ultimo]);
      return frase(
        "normalizou",
        "piora da função renal",
        "",
        `Evoluiu com piora da função renal (${rot} ${fmtSemUnidade(s, base)} → pico de ${fmt(s, pico)} em ${ddmm(pico.iso)}; ${kdigo}), com melhora e normalização ${quando} (${rot} ${fmt(s, ultimo)})`,
        `Evoluiu com piora da função renal, com melhora e normalização ${quando}`,
        false,
      );
    }
    return frase(
      "melhora",
      "piora da função renal",
      "",
      `Evoluiu com piora da função renal (${rot} ${fmtSemUnidade(s, base)} → pico de ${fmt(s, pico)} em ${ddmm(pico.iso)}; ${kdigo}), já em melhora (${rot} ${fmt(s, ultimo)})`,
      "Evoluiu com piora da função renal, já em melhora",
      false,
    );
  }

  // Sem critério de lesão aguda no período.
  if (!pts.some((p) => ehAnormal(p, "alto"))) return null;
  const primeiro = pts[0];
  if (primeiro.valor - ultimo.valor >= (an?.delta ?? 0.3) - 1e-9) {
    const detalhe = `(${rot} ${fmtSemUnidade(s, primeiro)} → ${fmt(s, ultimo)})`;
    if (!ultimoAlterado) {
      return frase(
        "normalizou",
        "melhora da função renal",
        detalhe,
        `Evoluiu com melhora e normalização da função renal ${detalhe}`,
        "Evoluiu com melhora e normalização da função renal",
        false,
      );
    }
    return frase(
      "melhora",
      "melhora da função renal",
      detalhe,
      `Evoluiu com melhora da função renal, ainda alterada ${detalhe}`,
      "Evoluiu com melhora da função renal, ainda alterada",
      false,
    );
  }
  return descreverSerie(s, "alto", { nome: "disfunção renal", genero: "f" }, incluirDiscretas);
}

// Distúrbio ácido-base a partir de pH, pCO₂ e HCO₃ da mesma coleta.
function classificarGasometria(ph: number, pco2?: number, hco3?: number): string {
  if (ph < 7.35) {
    const met = hco3 != null && hco3 < 22;
    const resp = pco2 != null && pco2 > 45;
    if (met && resp) return "acidose mista";
    if (met) return "acidose metabólica";
    if (resp) return "acidose respiratória";
    return "acidemia";
  }
  if (ph > 7.45) {
    const met = hco3 != null && hco3 > 26;
    const resp = pco2 != null && pco2 < 35;
    if (met && resp) return "alcalose mista";
    if (met) return "alcalose metabólica";
    if (resp) return "alcalose respiratória";
    return "alcalemia";
  }
  return "";
}

function descreverAcidoBase(ph: Serie, incluirDiscretas: boolean, pco2?: Serie, hco3?: Serie): Parcial[] {
  const proximo = (s: Serie | undefined, t: number) =>
    s?.pontos.find((p) => Math.abs(p.t - t) <= 30 * 60_000)?.valor;
  const frases: Parcial[] = [];
  for (const dir of ["baixo", "alto"] as Dir[]) {
    const anormais = ph.pontos.filter((p) => ehAnormal(p, dir));
    if (!anormais.length) continue;
    const ref = anormais[anormais.length - 1];
    const rotulo =
      classificarGasometria(ref.valor, proximo(pco2, ref.t), proximo(hco3, ref.t)) ||
      (dir === "baixo" ? "acidemia" : "alcalemia");
    const p = descreverSerie(ph, dir, { nome: rotulo, genero: "f" }, incluirDiscretas);
    if (p) frases.push(p);
  }
  return frases;
}

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

function recortar(s: Serie, inicio: number | null): Serie {
  if (inicio == null) return s;
  const dentro = s.pontos.filter((p) => p.t >= inicio);
  if (!dentro.length) return { ...s, pontos: [] };
  // Inclui o último exame anterior ao período como referência de comparação.
  const antes = s.pontos.filter((p) => p.t < inicio);
  return { ...s, pontos: antes.length ? [antes[antes.length - 1], ...dentro] : dentro };
}

function listar(itens: string[]): string {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

export function gerarEvolucao(resultados: Resultado[], opts: OpcoesEvolucao = {}): ResultadoEvolucao {
  const agora = opts.agora ?? new Date();
  const incluirValores = opts.incluirValores ?? true;
  const discretas = opts.incluirDiscretas ?? false;
  const inicio = opts.janelaDias ? agora.getTime() - opts.janelaDias * 86_400_000 : null;

  const todas = montarSeries(resultados);
  const ultimaColeta = todas.reduce<string | null>((acc, s) => {
    const u = s.pontos[s.pontos.length - 1]?.iso;
    return u && (!acc || u > acc) ? u : acc;
  }, null);
  const series = todas.map((s) => recortar(s, inicio)).filter((s) => s.pontos.length > 0);
  const por = (c: string) => series.find((s) => s.chave === c);
  const semExames = !series.some((s) => inicio == null || s.pontos.some((p) => p.t >= inicio));

  const parciais: (Parcial & { chave: string; ordemBase: number })[] = [];
  const add = (chave: string, p: Parcial | null) => {
    if (p) parciais.push({ ...p, chave, ordemBase: ordemAnalito(chave) });
  };

  // Regras específicas.
  const cr = por("cr");
  if (cr) add("cr", descreverFuncaoRenal(cr, discretas));
  const ph = por("ph");
  if (ph) for (const p of descreverAcidoBase(ph, discretas, por("pco2"), por("hco3"))) add("ph", p);

  // Transaminases: descreve pela que mais se elevou (em múltiplos do limite superior).
  const razaoPico = (s?: Serie) =>
    s ? Math.max(0, ...s.pontos.map((p) => (p.refMax ? p.valor / p.refMax : 0))) : 0;
  const tgo = por("tgo");
  const tgp = por("tgp");
  const transaminaseIgnorada = razaoPico(tgo) >= razaoPico(tgp) ? "tgp" : "tgo";

  const temCaIonico = !!por("cai");
  const temFraseRenal = parciais.some((p) => p.chave === "cr");

  for (const s of series) {
    const an = s.analito;
    if (!an || an.resumo === false) continue;
    if (["cr", "ph", "pco2", "hco3"].includes(an.codigo)) continue;
    if (an.codigo === transaminaseIgnorada) continue;
    if (an.codigo === "ca" && temCaIonico) continue;
    if (an.codigo === "ureia" && temFraseRenal) continue;
    if (an.baixo) add(an.codigo, descreverSerie(s, "baixo", an.baixo, discretas));
    if (an.alto) add(an.codigo, descreverSerie(s, "alto", an.alto, discretas));
  }

  const frases: FraseEvolucao[] = parciais
    .sort((a, b) => a.ordemBase - b.ordemBase)
    .map((p, i) => ({
      chave: p.chave,
      tipo: p.tipo,
      grupo: GRUPO_LABEL[getAnalito(p.chave)?.grupo ?? "outros"],
      nucleo: p.nucleo,
      detalhe: p.detalhe,
      texto: `${p.textoComDetalhe}.`,
      textoSemValores: `${p.textoBase}.`,
      agrupavel: p.agrupavel,
      ordem: i,
    }));

  return {
    frases,
    texto: montarParagrafo(frases, incluirValores, semExames, ultimaColeta),
    semExames,
    ultimaColeta,
    inicioJanela: inicio != null ? new Date(inicio).toISOString() : null,
  };
}

function montarParagrafo(
  frases: FraseEvolucao[],
  incluirValores: boolean,
  semExames: boolean,
  ultimaColeta: string | null,
): string {
  if (semExames) {
    return ultimaColeta
      ? `Sem exames laboratoriais no período (último em ${ddmmaaaa(ultimaColeta)}).`
      : "Sem exames laboratoriais registrados.";
  }
  if (!frases.length) return "Sem alterações laboratoriais relevantes no período.";

  const item = (f: FraseEvolucao) => (incluirValores && f.detalhe ? `${f.nucleo} ${f.detalhe}` : f.nucleo);
  const partes: string[] = [];

  const atuais = frases.filter((f) => f.tipo === "atual");
  if (atuais.length) partes.push(`Apresenta ${listar(atuais.map(item))}.`);

  const evoluiu = frases.filter((f) => f.agrupavel && (f.tipo === "nova" || f.tipo === "piora"));
  if (evoluiu.length) partes.push(`Evoluiu com ${listar(evoluiu.map(item))}.`);

  for (const f of frases) {
    if (f.agrupavel) continue;
    partes.push(incluirValores ? f.texto : f.textoSemValores);
  }

  const estaveis = frases.filter((f) => f.tipo === "estavel");
  if (estaveis.length === 1) {
    partes.push(incluirValores ? estaveis[0].texto : estaveis[0].textoSemValores);
  } else if (estaveis.length > 1) {
    partes.push(`Mantém, de forma estável, ${listar(estaveis.map(item))}.`);
  }
  return partes.join(" ");
}
