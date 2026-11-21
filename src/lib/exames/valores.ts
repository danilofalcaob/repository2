// Números em pt-BR, classificação de resultados (normal/alto/baixo/crítico) e
// tipos compartilhados do módulo de exames. Arquivo puro.

import { fatorConversao, getAnalito, refPadrao, type Analito } from "./catalogo";

export type Flag =
  | "normal"
  | "alto"
  | "baixo"
  | "critico_alto"
  | "critico_baixo"
  | "alterado" // resultado qualitativo marcado como alterado
  | "sem_ref";

export const FLAG_LABEL: Record<Flag, string> = {
  normal: "Normal",
  alto: "Aumentado",
  baixo: "Diminuído",
  critico_alto: "Crítico (alto)",
  critico_baixo: "Crítico (baixo)",
  alterado: "Alterado",
  sem_ref: "Sem referência",
};

// Resultado como circula entre servidor, navegador e motores de análise.
export type Resultado = {
  id?: string;
  analito: string; // código do catálogo ou "outro"
  nome: string; // nome no laudo (ou rótulo livre)
  valor: number | null;
  valorTexto: string;
  casas: number;
  comparador?: string | null; // "<", ">", "<=", ">="
  unidade: string | null;
  refMin: number | null;
  refMax: number | null;
  refTexto?: string | null;
  flag: Flag;
  observacao?: string | null;
  coletadoEm: string; // ISO 8601
  documentoId?: string | null;
};

export function ehAlterado(flag: Flag | string): boolean {
  return flag !== "normal" && flag !== "sem_ref";
}

export function ehCritico(flag: Flag | string): boolean {
  return flag === "critico_alto" || flag === "critico_baixo";
}

export function direcaoFlag(flag: Flag | string): "alto" | "baixo" | null {
  if (flag === "alto" || flag === "critico_alto") return "alto";
  if (flag === "baixo" || flag === "critico_baixo") return "baixo";
  return null;
}

// Texto usado entre parênteses na linha de exames.
export function textoFlag(flag: Flag | string): string {
  const d = direcaoFlag(flag);
  if (d === "alto") return "aumentado";
  if (d === "baixo") return "diminuído";
  if (flag === "alterado") return "alterado";
  return "";
}

// ---------------------------------------------------------------------------
// Números pt-BR
// ---------------------------------------------------------------------------

// Converte "6.520", "0,62", "14.1", "323.000", "1.234,5", "-2,3" em número,
// guardando as casas decimais informadas (para reexibir com a mesma precisão).
export function parseNumeroBR(entrada: string): { valor: number; casas: number } | null {
  let s = entrada.trim().replace(/\s/g, "").replace(/−/g, "-");
  if (!/^[+-]?\d/.test(s)) return null;
  const sinal = s.startsWith("-") ? -1 : 1;
  s = s.replace(/^[+-]/, "");
  if (!/^\d[\d.,]*$/.test(s)) return null;
  s = s.replace(/[.,]$/, "");

  let inteiro = s;
  let decimal = "";
  const temPonto = s.includes(".");
  const temVirgula = s.includes(",");

  if (temPonto && temVirgula) {
    // O último separador é o decimal.
    const ultimo = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
    inteiro = s.slice(0, ultimo).replace(/[.,]/g, "");
    decimal = s.slice(ultimo + 1);
  } else if (temVirgula) {
    const partes = s.split(",");
    if (partes.length > 2) {
      // "1,234,567" (milhar em inglês) — raro, mas trate como milhar.
      inteiro = partes.join("");
    } else {
      inteiro = partes[0];
      decimal = partes[1] ?? "";
    }
  } else if (temPonto) {
    const partes = s.split(".");
    const pareceMilhar =
      partes.length > 1 &&
      partes[0] !== "0" &&
      partes[0].length <= 3 &&
      partes.slice(1).every((p) => p.length === 3);
    if (pareceMilhar) {
      inteiro = partes.join("");
    } else if (partes.length === 2) {
      inteiro = partes[0];
      decimal = partes[1];
    } else {
      return null;
    }
  }

  if (!/^\d+$/.test(inteiro) || (decimal && !/^\d+$/.test(decimal))) return null;
  const valor = sinal * Number(`${inteiro}${decimal ? "." + decimal : ""}`);
  if (!Number.isFinite(valor)) return null;
  return { valor, casas: decimal.length };
}

// Formata com milhar "." e decimal "," (ex.: 6520 → "6.520"; 0.62 → "0,62").
export function formatarNumeroBR(valor: number, casas = 0): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
    useGrouping: true,
  }).format(valor);
}

// Casas decimais "naturais" de um número (máx. 3), para valores sem precisão informada.
export function casasDe(valor: number): number {
  for (let c = 0; c <= 3; c++) {
    if (Math.abs(Math.round(valor * 10 ** c) - valor * 10 ** c) < 1e-9) return c;
  }
  return 3;
}

// ---------------------------------------------------------------------------
// Classificação
// ---------------------------------------------------------------------------

export function classificar(params: {
  valor: number | null;
  refMin: number | null;
  refMax: number | null;
  analito?: Analito;
  unidade?: string | null;
  qualitativoAlterado?: boolean;
}): Flag {
  const { valor, refMin, refMax, analito, unidade } = params;
  if (valor == null || !Number.isFinite(valor)) {
    return params.qualitativoAlterado ? "alterado" : "sem_ref";
  }
  // Valores críticos (definidos na unidade canônica do catálogo).
  if (analito?.critico) {
    const fator = fatorConversao(analito, unidade);
    if (fator != null) {
      const canon = valor * fator;
      if (analito.critico.max != null && canon >= analito.critico.max) return "critico_alto";
      if (analito.critico.min != null && canon <= analito.critico.min) return "critico_baixo";
    }
  }
  if (refMin == null && refMax == null) return "sem_ref";
  if (refMax != null && valor > refMax) return "alto";
  if (refMin != null && valor < refMin) return "baixo";
  return "normal";
}

// Preenche a referência padrão (quando o laudo não trouxe) e calcula a flag.
// A referência padrão do catálogo está na unidade canônica: é convertida para a
// unidade informada quando há fator conhecido.
export function completarResultado(
  r: Omit<Resultado, "flag"> & { flag?: Flag; qualitativoAlterado?: boolean },
  sexo?: string | null,
): Resultado {
  const analito = getAnalito(r.analito);
  let { refMin, refMax } = r;
  if (analito && refMin == null && refMax == null) {
    const faixa = refPadrao(analito, sexo);
    const fator = fatorConversao(analito, r.unidade);
    if (faixa && fator) {
      refMin = faixa.min != null ? arredondar(faixa.min / fator) : null;
      refMax = faixa.max != null ? arredondar(faixa.max / fator) : null;
    }
  }
  const flag =
    r.valor == null && r.flag && r.flag !== "sem_ref"
      ? r.flag
      : classificar({
          valor: r.valor,
          refMin,
          refMax,
          analito,
          unidade: r.unidade,
          qualitativoAlterado: r.qualitativoAlterado,
        });
  const { qualitativoAlterado: _q, ...resto } = r;
  return { ...resto, refMin: refMin ?? null, refMax: refMax ?? null, flag };
}

function arredondar(v: number): number {
  return Math.round(v * 10000) / 10000;
}

// "3,5 a 5,1" / "< 5,0" / "> 60" a partir dos limites.
export function textoReferencia(refMin: number | null, refMax: number | null): string {
  const c = (v: number) => formatarNumeroBR(v, casasDe(v));
  if (refMin != null && refMax != null) return `${c(refMin)} a ${c(refMax)}`;
  if (refMax != null) return `até ${c(refMax)}`;
  if (refMin != null) return `≥ ${c(refMin)}`;
  return "—";
}
