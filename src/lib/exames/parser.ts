// Leitura LOCAL (sem IA) de laudos laboratoriais em texto: texto extraído de
// PDF, OCR de printscreen ou texto colado — inclusive o próprio formato de
// "linha de exames" (Lab 01/06/2026 - Hb 14,1 g/dL / K 4,5 mEq/L / ...).
//
// É heurístico por natureza (cada laboratório tem um layout): o resultado vai
// SEMPRE para a tela de revisão antes de ser gravado. Arquivo puro.

import {
  ANALITOS,
  ANALITO_POR_CODIGO,
  chaveUnidade,
  getAnalito,
  normalizarNome,
  refPadrao,
  type Analito,
} from "./catalogo";
import { completarResultado, parseNumeroBR, type Resultado } from "./valores";

// ---------------------------------------------------------------------------
// Datas (fuso de referência: America/Sao_Paulo, UTC-3 sem horário de verão)
// ---------------------------------------------------------------------------

const OFFSET_SP_HORAS = 3;

export function dataLocalParaISO(ano: number, mes: number, dia: number, hora = 6, minuto = 0): string {
  return new Date(Date.UTC(ano, mes - 1, dia, hora + OFFSET_SP_HORAS, minuto)).toISOString();
}

// Chave de dia (AAAA-MM-DD) no fuso de São Paulo.
export function chaveDia(iso: string | Date): string {
  const t = typeof iso === "string" ? new Date(iso).getTime() : iso.getTime();
  return new Date(t - OFFSET_SP_HORAS * 3600_000).toISOString().slice(0, 10);
}

function anoCompleto(a: string | undefined, padrao: number): number {
  if (!a) return padrao;
  const n = parseInt(a, 10);
  return a.length <= 2 ? 2000 + n : n;
}

function dataValida(ano: number, mes: number, dia: number): boolean {
  return ano > 1990 && ano < 2100 && mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31;
}

export type DataDetectada = { iso: string; temHora: boolean; confiavel: boolean };

// Procura a data da coleta no laudo. Prioriza rótulos explícitos ("Data da
// coleta", "Coletado em"); na falta deles, usa a primeira data que não seja de
// nascimento/emissão (marcada como não confiável, para conferência).
export function detectarDataColeta(texto: string, anoPadrao = new Date().getFullYear()): DataDetectada | null {
  const linhas = texto.split(/\r?\n/);
  const reRotulo =
    /(data\s*(?:\/\s*hora\s*)?(?:da|de)?\s*colet\w*|colet(?:ad[oa]|a)\s*(?:em)?|dt\.?\s*colet\w*|data\s+do\s+exame|data\s+da\s+amostra)\s*[:\-]?\s*(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})(?:\s*(?:as|às|a|-|,)?\s*(\d{1,2})\s*[:h]\s*(\d{2}))?/i;
  for (const linha of linhas) {
    const m = linha.match(reRotulo);
    if (m) {
      const [dia, mes, ano] = [parseInt(m[2], 10), parseInt(m[3], 10), anoCompleto(m[4], anoPadrao)];
      if (!dataValida(ano, mes, dia)) continue;
      const temHora = m[5] != null;
      return {
        iso: dataLocalParaISO(ano, mes, dia, temHora ? parseInt(m[5], 10) : 6, temHora ? parseInt(m[6], 10) : 0),
        temHora,
        confiavel: true,
      };
    }
  }
  // Formato "Lab 01/06/2026 - ..."
  const lab = texto.match(/\blab(?:orat[oó]rio)?\.?\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);
  if (lab) {
    const [dia, mes, ano] = [parseInt(lab[1], 10), parseInt(lab[2], 10), anoCompleto(lab[3], anoPadrao)];
    if (dataValida(ano, mes, dia)) return { iso: dataLocalParaISO(ano, mes, dia), temHora: false, confiavel: true };
  }
  // Primeira data "comum" (ignora nascimento, emissão, impressão, liberação).
  const reData = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s*(?:as|às|-)?\s*(\d{1,2}):(\d{2}))?/;
  for (const linha of linhas) {
    if (/nasc|emiss|impress|liberad|assinad|validad|cadastr/i.test(linha)) continue;
    const m = linha.match(reData);
    if (!m) continue;
    const [dia, mes, ano] = [parseInt(m[1], 10), parseInt(m[2], 10), anoCompleto(m[3], anoPadrao)];
    if (!dataValida(ano, mes, dia)) continue;
    const temHora = m[4] != null;
    return {
      iso: dataLocalParaISO(ano, mes, dia, temHora ? parseInt(m[4], 10) : 6, temHora ? parseInt(m[5], 10) : 0),
      temHora,
      confiavel: false,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Reconhecimento do nome do exame
// ---------------------------------------------------------------------------

type Padrao = { codigo: string; texto: string; re: RegExp; estrito: boolean };

function escapar(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

const PADROES: Padrao[] = (() => {
  const lista: Padrao[] = [];
  const vistos = new Set<string>();
  for (const a of ANALITOS) {
    const nomes = [
      ...a.sinonimos.map((s) => ({ s, estrito: s.replace(/\s/g, "").length <= 3 })),
      ...(a.curtos ?? []).map((s) => ({ s, estrito: true })),
    ];
    for (const { s, estrito } of nomes) {
      const texto = normalizarNome(s) || s;
      const chave = `${a.codigo}|${texto}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      const corpo = texto.split(" ").map(escapar).join("\\s+");
      lista.push({
        codigo: a.codigo,
        texto,
        re: new RegExp(`(?<![a-z0-9])${corpo}(?![a-z0-9])`, "g"),
        estrito,
      });
    }
  }
  // Mais longos primeiro (ex.: "colesterol nao hdl" antes de "hdl").
  return lista.sort((x, y) => y.texto.length - x.texto.length);
})();

// Normalização caractere a caractere (mesmo comprimento do original), para
// mapear posições do texto normalizado de volta ao texto original.
export function normalizarMesmoTamanho(s: string): string {
  let out = "";
  for (const ch of s) {
    let c = ch;
    if (c === "₂") c = "2";
    else if (c === "₃") c = "3";
    else {
      const base = c.normalize("NFD")[0] ?? c;
      c = base.toLowerCase();
      if (c.length !== 1) c = " ";
    }
    if (/[-_–—.:;,()[\]{}*|]/.test(c)) c = " ";
    // Mantém o mesmo número de unidades UTF-16 do caractere original.
    out += ch.length === 2 ? c + " " : c;
  }
  return out;
}

// Identifica o código do catálogo a partir de um nome livre ("Potássio sérico",
// "TGO/AST", "Hb"). Retorna null se não reconhecer.
export function identificarAnalito(nome: string): string | null {
  const n = normalizarNome(nome);
  if (!n) return null;
  for (const a of ANALITOS) {
    if (normalizarNome(a.rotulo) === n || normalizarNome(a.nome) === n) return a.codigo;
  }
  for (const p of PADROES) if (p.texto === n) return p.codigo;
  for (const p of PADROES) {
    if (p.estrito) continue;
    p.re.lastIndex = 0;
    if (p.re.test(n)) return p.codigo;
  }
  // Siglas no início do nome ("K sérico", "Na+ (sódio)").
  for (const p of PADROES) {
    if (!p.estrito) continue;
    p.re.lastIndex = 0;
    const m = p.re.exec(n);
    if (m && m.index === 0) return p.codigo;
  }
  return null;
}

type Achado = { codigo: string; inicio: number; fim: number };

// Encontra os exames citados numa linha (sem sobreposição).
function achadosNaLinha(norm: string): Achado[] {
  const achados: Achado[] = [];
  const ocupado = (i: number, f: number) => achados.some((a) => i < a.fim && f > a.inicio);
  const inicioUtil = norm.search(/[a-z0-9]/);
  for (const p of PADROES) {
    p.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.re.exec(norm))) {
      const ini = m.index;
      const fim = ini + m[0].length;
      if (p.estrito && ini !== inicioUtil) continue;
      if (ocupado(ini, fim)) continue;
      achados.push({ codigo: p.codigo, inicio: ini, fim });
    }
  }
  return achados.sort((a, b) => a.inicio - b.inicio);
}

// ---------------------------------------------------------------------------
// Valor, unidade e referência
// ---------------------------------------------------------------------------

const RE_NUM = /(?<![A-Za-zÀ-ÿ0-9.,/])(<=|>=|≤|≥|<|>)?\s*([+-]?\d[\d.,]*)(?![.,]?\d)(?!\s*-\s*oh)(?![A-Za-zÀ-ÿ]*-?oh\b)(?!-[A-Za-zÀ-ÿ])/gi;
const RE_UNIDADE =
  /^\s*((?:x\s*10\s*\^?\s*[0-9³⁶⁹]+\s*\/\s*[a-zµμ]+)|(?:10\s*\^?\s*[0-9³⁶⁹]+\s*\/\s*[a-zµμ]+)|(?:milh[õo]es\s*\/\s*(?:mm[³3]?|[uµμ]l))|(?:mil\s*\/\s*(?:mm[³3]?|[uµμ]l))|(?:m[lL]\s*\/\s*min(?:\s*\/\s*1[,.]73\s*m[²2]?)?)|(?:\/\s*(?:mm[³3]?|[uµμ]l))|(?:%)|(?:[a-zµμ]+(?:\/[a-zµμ0-9³²,.]+)*(?:\s*FEU)?))/i;

const UNIDADES_CONHECIDAS = new Set<string>(
  ANALITOS.flatMap((a) => [chaveUnidade(a.unidade), ...Object.keys(a.conversoes ?? {})]).filter(Boolean),
);

function unidadePlausivel(u: string): boolean {
  const k = chaveUnidade(u);
  if (!k) return false;
  if (UNIDADES_CONHECIDAS.has(k)) return true;
  return /^(m?g|ug|ng|pg|u|ui|mui|uui|meq|mmol|umol|nmol|pmol|fl|mmhg|kpa|seg|s)(\/|$)/.test(k);
}

// Mascara datas e horas (para não confundir com valores) preservando posições.
function mascararDatas(s: string): string {
  return s
    .replace(/\d{1,2}\/\d{1,2}\/\d{2,4}/g, (x) => " ".repeat(x.length))
    .replace(/\b\d{1,2}[:h]\d{2}(?::\d{2})?\b/g, (x) => " ".repeat(x.length));
}

type Faixa = { min: number | null; max: number | null; pos: number; sexo?: "F" | "M" };

function extrairFaixas(texto: string): Faixa[] {
  const s = mascararDatas(texto);
  const faixas: Faixa[] = [];
  const sexoEm = (pos: number): "F" | "M" | undefined => {
    const antes = s.slice(Math.max(0, pos - 25), pos).toLowerCase();
    if (/(mulher|feminino|\bf\s*[:=])/.test(antes)) return "F";
    if (/(homem|homens|masculino|\bm\s*[:=])/.test(antes)) return "M";
    return undefined;
  };
  const num = (x: string) => parseNumeroBR(x.replace(/^\+/, ""))?.valor ?? null;
  const usados: [number, number][] = [];
  const reFaixa = /([+-]?\d[\d.,]*)\s*(?:a|à|-|–|até|ate)\s*([+-]?\d[\d.,]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = reFaixa.exec(s))) {
    const a = num(m[1]);
    const b = num(m[2]);
    if (a == null || b == null || b < a) continue;
    faixas.push({ min: a, max: b, pos: m.index, sexo: sexoEm(m.index) });
    usados.push([m.index, m.index + m[0].length]);
  }
  const livre = (i: number) => !usados.some(([x, y]) => i >= x && i < y);
  const reMax = /(?:at[ée]|inferior\s+a|menor\s+(?:que|ou\s+igual\s+a)|<=|≤|<)\s*(\d[\d.,]*)/gi;
  while ((m = reMax.exec(s))) {
    if (!livre(m.index)) continue;
    const b = num(m[1]);
    if (b != null) faixas.push({ min: null, max: b, pos: m.index, sexo: sexoEm(m.index) });
  }
  const reMin = /(?:superior\s+a|maior\s+(?:que|ou\s+igual\s+a)|acima\s+de|>=|≥|>)\s*(\d[\d.,]*)/gi;
  while ((m = reMin.exec(s))) {
    if (!livre(m.index)) continue;
    const a = num(m[1]);
    if (a != null) faixas.push({ min: a, max: null, pos: m.index, sexo: sexoEm(m.index) });
  }
  return faixas.sort((x, y) => x.pos - y.pos);
}

// Escolhe a faixa compatível com o sexo e com a ordem de grandeza do valor
// (resolve, p. ex., "45 a 70 %" vs "1.800 a 7.700/mm³" no leucograma).
function escolherFaixa(faixas: Faixa[], valor: number, sexo?: string | null): Faixa | null {
  if (faixas.length === 0) return null;
  let candidatas = faixas;
  if (sexo === "F" || sexo === "M") {
    const doSexo = faixas.filter((f) => f.sexo === sexo);
    if (doSexo.length) candidatas = doSexo;
    else candidatas = faixas.filter((f) => !f.sexo || f.sexo === sexo);
    if (!candidatas.length) candidatas = faixas;
  }
  const mag = (x: number) => Math.log10(Math.max(Math.abs(x), 1e-6));
  const dist = (f: Faixa) => {
    const ref = f.min != null && f.max != null ? (Math.abs(f.min) + Math.abs(f.max)) / 2 : (f.max ?? f.min ?? 0);
    return Math.abs(mag(valor) - mag(ref || 1));
  };
  let melhor = candidatas[0];
  for (const f of candidatas) if (dist(f) < dist(melhor) - 0.5) melhor = f;
  // Rejeita faixas absurdamente distantes (outro número qualquer na linha).
  return dist(melhor) > 1.6 ? null : melhor;
}

type ValorLido = {
  valor: number;
  casas: number;
  valorTexto: string;
  comparador: string | null;
  unidade: string | null;
  fim: number; // posição após valor/unidade
};

// Marcação de alterado escrita no próprio texto ("(aumentado)", "↑", "H").
function flagNoTexto(resto: string): "alto" | "baixo" | null {
  const r = resto.slice(0, 40);
  if (/\(\s*(aumentad|elevad|alto|alta)\w*\s*\)|↑|\s\*?H\*?(\s|$)/i.test(r)) return "alto";
  if (/\(\s*(diminu[ií]d|baix|reduzid)\w*\s*\)|↓|\s\*?L\*?(\s|$)/i.test(r)) return "baixo";
  return null;
}

// Observações entre parênteses depois do valor ("(colhido às 11:15)"),
// ignorando marcações de alterado e faixas de referência.
function observacaoNoTexto(resto: string): string | null {
  const obs = [...resto.slice(0, 120).matchAll(/\(([^()]{2,80})\)/g)]
    .map((m) => m[1].trim())
    .filter((t) => !/^(aumentad|diminu|normal|alterad|alto|alta|baixo|baixa|elevad|reduzid|cr[ií]tico)/i.test(t))
    .filter((t) => !/\d\s*(a|-|–|até)\s*\d|refer|homens|mulheres|masculino|feminino/i.test(t));
  return obs.length ? obs.join("; ") : null;
}

// Lê o valor (e a unidade) de um trecho de texto.
function lerValor(trecho: string, analito: Analito): ValorLido | null {
  const s = mascararDatas(trecho.replace(/\*/g, " "));
  RE_NUM.lastIndex = 0;
  const tokens: { m: RegExpExecArray; fim: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = RE_NUM.exec(s))) tokens.push({ m, fim: m.index + m[0].length });
  if (!tokens.length) return null;

  const contagem = chaveUnidade(analito.unidade) === "/mm3";
  for (let i = 0; i < tokens.length; i++) {
    const { m: t, fim } = tokens[i];
    const depois = s.slice(fim);
    // Número que inicia uma faixa ("3,5 a 5,1"): é referência, não resultado.
    if (/^\s*(?:a|à|até|ate|-|–)\s*[+-]?\d/i.test(depois) && !/^\s*-\s*\d{1,2}[:h]/.test(depois)) {
      i++; // pula também o segundo número da faixa
      continue;
    }
    const num = parseNumeroBR(t[2]);
    if (!num) continue;
    const um = depois.match(RE_UNIDADE);
    const bruta = um ? um[1].replace(/[.,;:]+$/, "") : "";
    const unidade = bruta && unidadePlausivel(bruta) ? bruta.replace(/\s+/g, " ").trim().replace(/\/\s*mm3?$/, "/mm³") : null;
    // Leucograma: prefere o valor absoluto ao percentual.
    if (contagem && unidade === "%" && tokens.slice(i + 1).some((x) => !/^\s*%/.test(s.slice(x.fim)))) {
      continue;
    }
    const fimTotal = fim + (unidade && um ? um[0].indexOf(bruta) + bruta.length : 0);
    return {
      valor: num.valor,
      casas: num.casas,
      valorTexto: t[2],
      comparador: t[1] ?? null,
      unidade,
      fim: fimTotal,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Extração principal
// ---------------------------------------------------------------------------

const RE_SECAO_IGNORAR =
  /^(?:\s*)(urina|eas\b|urinalise|sumario\s+de\s+urina|urina\s+tipo|parcial\s+de\s+urina|elementos\s+anormais|sedimento|urocultura|liquor|liquido\s+(?:pleural|ascitico|cefalo|sinovial|peritoneal)|fezes|parasitologico|cultura|antibiograma)/;

// Exames que também existem na urina/líquidos: não reabrem o contexto "sangue".
const COMUNS_URINA = new Set(["leucocitos", "eritrocitos", "hb", "ph", "glicose", "proteinas", "bt", "bd", "bi", "albumina", "cr", "na", "k", "cl", "ureia", "amilase"]);
const RE_SECAO_SANGUE =
  /^(?:\s*)(hemograma|eritrograma|leucograma|plaquetograma|bioquimica|eletrolitos|gasometria|coagulograma|coagulacao|funcao\s+renal|funcao\s+hepatica|hepatograma|perfil\s+lipidico|lipidograma|hormonios|marcadores|sorologia|imunologia|bioquimica\s+sanguinea|exames\s+de\s+sangue)/;
const RE_LINHA_IGNORAR =
  /^\s*(valor(?:es)?\s+de\s+refer|refer[eê]ncia|ref\.?\s*:|metodo|material|nota|obs\b|observ|interpreta|resultado(?:s)?\s+anterior|liberad|assinad|responsavel|coment|amostra|recebid|exame\s+realizado|crm|conselho)/i;

export type Extracao = {
  dataColeta: DataDetectada | null;
  resultados: Resultado[];
  avisos: string[];
};

// Divide o formato "linha de exames" (itens separados por " / ") em pseudo-linhas.
function expandirLinhas(texto: string): string[] {
  const linhas: string[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    const l = bruta.replace(/ /g, " ").trim();
    if (!l) continue;
    const separadores = l.split(/\s\/\s/).length - 1;
    if (separadores >= 2) {
      // Mantém o prefixo de data ("Lab 01/06/2026 - ") na primeira parte.
      for (const parte of l.split(/\s\/\s/)) linhas.push(parte.trim());
    } else {
      linhas.push(l);
    }
  }
  return linhas;
}

const RE_PREFIXO_DATA =
  /^\s*(?:lab(?:orat[oó]rio)?\.?\s*)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*(?:\(?\s*(\d{1,2})[:h](\d{2})\s*\)?)?\s*[-–:]\s*/i;

// OCR costuma perder a vírgula decimal ("27,8" → "278"). Para exames com casas
// decimais, se o número lido sem separador estiver muito fora da referência e
// a divisão por 10 ou 100 o trouxer para perto dela, corrige e avisa.
function corrigirVirgulaOcr(
  b: { analito: string; valor: number | null; valorTexto: string; casas: number; refMin: number | null; refMax: number | null; unidade: string | null },
  sexo?: string | null,
): string | null {
  const a = getAnalito(b.analito);
  if (!a || a.casas === 0 || b.valor == null || /[.,]/.test(b.valorTexto)) return null;
  const faixa = b.refMin != null || b.refMax != null ? { min: b.refMin ?? undefined, max: b.refMax ?? undefined } : refPadrao(a, sexo);
  if (!faixa || faixa.max == null) return null;
  const min = (faixa.min ?? 0) * 0.3;
  const max = faixa.max * 3;
  if (b.valor <= max) return null;
  for (let k = 1; k <= a.casas; k++) {
    const v = b.valor / 10 ** k;
    if (v >= min && v <= max) {
      const antes = b.valorTexto;
      b.valor = v;
      b.casas = k;
      b.valorTexto = v.toFixed(k).replace(".", ",");
      return `${a.rotulo} ${antes} → ${b.valorTexto}`;
    }
  }
  return null;
}

export function extrairDeTexto(
  texto: string,
  opts: { sexo?: string | null; dataPadraoISO?: string; ocr?: boolean } = {},
): Extracao {
  const avisos: string[] = [];
  const anoPadrao = opts.dataPadraoISO ? new Date(opts.dataPadraoISO).getUTCFullYear() : new Date().getFullYear();
  const dataColeta = detectarDataColeta(texto, anoPadrao);
  let dataAtual = dataColeta?.iso ?? opts.dataPadraoISO ?? new Date().toISOString();
  if (!dataColeta) avisos.push("Data da coleta não encontrada no laudo — confira a data antes de confirmar.");
  else if (!dataColeta.confiavel) avisos.push("Data da coleta estimada pela primeira data do laudo — confira.");

  const linhas = expandirLinhas(texto);
  const brutos: (Omit<Resultado, "flag"> & { ordem: number; flagTexto?: "alto" | "baixo" | null })[] = [];
  const vistos = new Set<string>();
  let contexto: "sangue" | "ignorar" | "venosa" = "sangue";

  for (let i = 0; i < linhas.length; i++) {
    let linha = linhas[i];

    // Prefixo de data no formato de linha de exames: muda a data corrente.
    const pd = linha.match(RE_PREFIXO_DATA);
    if (pd && (pd[3] || /^\s*lab/i.test(linha))) {
      const ano = anoCompleto(pd[3], new Date(dataAtual).getUTCFullYear());
      const [dia, mes] = [parseInt(pd[1], 10), parseInt(pd[2], 10)];
      if (dataValida(ano, mes, dia)) {
        dataAtual = dataLocalParaISO(ano, mes, dia, pd[4] ? parseInt(pd[4], 10) : 6, pd[5] ? parseInt(pd[5], 10) : 0);
        linha = linha.slice(pd[0].length);
      }
    }

    const norm = normalizarMesmoTamanho(linha);
    const normTrim = norm.trim();

    // Seções: ignora urina, líquidos e culturas; marca gasometria venosa.
    if (RE_SECAO_IGNORAR.test(normTrim) && !/\d/.test(normTrim.slice(0, 40))) {
      contexto = "ignorar";
      continue;
    }
    if (/^gasometria\s+venosa/.test(normTrim)) {
      contexto = "venosa";
      continue;
    }
    if (RE_SECAO_SANGUE.test(normTrim)) {
      contexto = "sangue";
      if (!/\d/.test(normTrim)) continue;
    }
    if (RE_LINHA_IGNORAR.test(normTrim)) continue;

    const achados = achadosNaLinha(norm);
    if (!achados.length) continue;
    // Título de exame em maiúsculas (ex.: "PROTEÍNA C REATIVA") depois de uma
    // seção de urina: volta ao contexto de sangue.
    if (contexto === "ignorar") {
      const ehTitulo = linha === linha.toUpperCase() && /[A-ZÀ-Ú]{3}/.test(linha);
      if (ehTitulo && !COMUNS_URINA.has(achados[0].codigo)) contexto = "sangue";
      else continue;
    }

    for (let k = 0; k < achados.length; k++) {
      const ach = achados[k];
      let codigo = ach.codigo;
      // Gasometria venosa: pO₂ não tem referência útil; SatO₂ vira SvO₂.
      if (contexto === "venosa") {
        if (codigo === "po2") continue;
        if (codigo === "sato2") codigo = "svo2";
      }
      const analito = ANALITO_POR_CODIGO[codigo];
      const fimTrecho = k + 1 < achados.length ? achados[k + 1].inicio : linha.length;
      const trecho = linha.slice(ach.fim, fimTrecho);
      // O nome do exame deve estar perto do valor (evita frases de notas).
      let lido = lerValor(trecho, analito);
      let textoRef = lido ? trecho.slice(lido.fim) : "";
      let linhasConsumidas = 0;

      if (!lido && k === achados.length - 1) {
        // Formato em blocos: "POTÁSSIO" / "Resultado: 4,5 mEq/L" / "Referência: ...".
        for (let j = i + 1; j <= Math.min(i + 3, linhas.length - 1); j++) {
          const prox = linhas[j];
          const proxNorm = normalizarMesmoTamanho(prox);
          if (achadosNaLinha(proxNorm).length) break;
          if (RE_LINHA_IGNORAR.test(proxNorm.trim())) continue;
          const semRotulo = prox.replace(/^\s*resultado\s*[:\-]?\s*/i, "");
          lido = lerValor(semRotulo, analito);
          if (lido) {
            textoRef = semRotulo.slice(lido.fim);
            linhasConsumidas = j - i;
            break;
          }
        }
      }
      if (!lido) continue;
      if (lido.valor == null) continue;

      // Referência: resto do trecho + até 3 linhas seguintes sem outro exame.
      if (k === achados.length - 1) {
        for (let j = i + 1 + linhasConsumidas; j <= Math.min(i + 3 + linhasConsumidas, linhas.length - 1); j++) {
          const prox = linhas[j];
          if (achadosNaLinha(normalizarMesmoTamanho(prox)).length) break;
          textoRef += "\n" + prox;
        }
      }

      let unidade = lido.unidade;
      // Contagens sem unidade, em milhares (ex.: "Leucócitos 12,3").
      if (!unidade && chaveUnidade(analito.unidade) === "/mm3") {
        if (codigo === "plaquetas" && lido.valor < 2000) unidade = "mil/mm³";
        else if (codigo !== "plaquetas" && lido.valor < 300 && lido.casas > 0) unidade = "mil/mm³";
      }

      const faixa = escolherFaixa(extrairFaixas(textoRef), lido.valor, opts.sexo);
      const restoLinha = trecho.slice(lido.fim);
      const flagTexto = flagNoTexto(restoLinha);
      const chave = `${codigo}|${dataAtual}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);

      brutos.push({
        ordem: brutos.length,
        analito: codigo,
        nome: linha.slice(ach.inicio, ach.fim).trim() || analito.rotulo,
        valor: lido.valor,
        valorTexto: (lido.comparador ? lido.comparador : "") + lido.valorTexto,
        casas: lido.casas,
        comparador: lido.comparador,
        unidade: unidade ?? analito.unidade ?? null,
        refMin: faixa?.min ?? null,
        refMax: faixa?.max ?? null,
        refTexto: null,
        observacao:
          contexto === "venosa" && ["ph", "pco2", "hco3", "be"].includes(codigo) ? "venosa" : observacaoNoTexto(restoLinha),
        coletadoEm: dataAtual,
        flagTexto: faixa ? null : flagTexto,
      });
    }
  }

  // Diferencial só em % + leucócitos totais: calcula o valor absoluto.
  for (const b of brutos) {
    if (b.unidade !== "%") continue;
    const a = getAnalito(b.analito);
    if (!a || chaveUnidade(a.unidade) !== "/mm3" || b.analito === "leucocitos") continue;
    const leuco = brutos.find((x) => x.analito === "leucocitos" && x.coletadoEm === b.coletadoEm && x.valor != null);
    if (!leuco || leuco.valor == null || b.valor == null) continue;
    const fatorLeuco = chaveUnidade(leuco.unidade) === "mil/mm3" || (leuco.valor < 300 && leuco.casas > 0) ? 1000 : 1;
    const abs = Math.round((leuco.valor * fatorLeuco * b.valor) / 100);
    b.observacao = `${b.valorTexto}%`;
    b.valor = abs;
    b.valorTexto = String(abs);
    b.casas = 0;
    b.unidade = "/mm³";
    b.refMin = null;
    b.refMax = null;
  }

  if (opts.ocr) {
    const corrigidos = brutos.map((b) => corrigirVirgulaOcr(b, opts.sexo)).filter(Boolean);
    if (corrigidos.length) {
      avisos.push(`Vírgula decimal possivelmente perdida no OCR — corrigido, confira: ${corrigidos.join("; ")}.`);
    }
  }

  const resultados = brutos.map(({ ordem: _o, flagTexto, ...r }) => {
    // Sem referência no texto, mas com "(aumentado)/(diminuído)" escrito: vale
    // a marcação do laudo (a referência padrão do catálogo pode ser outra).
    if (flagTexto) return { ...r, refMin: null, refMax: null, flag: flagTexto };
    return completarResultado(r, opts.sexo);
  });
  if (!resultados.length) {
    avisos.push("Nenhum exame reconhecido automaticamente. Adicione os valores manualmente ou tente outro arquivo.");
  }
  return { dataColeta, resultados, avisos };
}
