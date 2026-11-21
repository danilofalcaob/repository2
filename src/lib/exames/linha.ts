// "Exames em linha" no formato usado na evolução do prontuário:
//
//   Lab 01/06/2026 - Eritrócitos **5,19 milhões/mm³ (aumentado)** / Hb 14,1 g/dL / ...
//
// Arquivo puro.

import { formatarUnidade, getAnalito, ordemAnalito } from "./catalogo";
import { chaveDia } from "./parser";
import { ehAlterado, formatarNumeroBR, textoFlag, type Resultado } from "./valores";

export type Marcacao = "asteriscos" | "maiusculas" | "nenhuma";

export type OpcoesLinha = {
  marcacao?: Marcacao;
  prefixo?: string; // "Lab"
  ordem?: "recente" | "cronologica";
};

export type LinhaExames = {
  chave: string;
  iso: string;
  rotuloData: string;
  texto: string;
  total: number;
  alterados: number;
};

const TZ = "America/Sao_Paulo";

function dataBR(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ }).format(
    new Date(iso),
  );
}

function horaBR(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso));
}

export function rotuloExame(r: Pick<Resultado, "analito" | "nome">): string {
  return getAnalito(r.analito)?.rotulo ?? r.nome;
}

export function valorExibido(r: Pick<Resultado, "valor" | "valorTexto" | "casas" | "comparador">): string {
  if (r.valor == null) return r.valorTexto;
  const num = formatarNumeroBR(Math.abs(r.valor), r.casas ?? 0);
  const sinal = r.valor < 0 ? "-" : "";
  return `${r.comparador ?? ""}${sinal}${num}`;
}

// Um item da linha: "Hb 14,1 g/dL" ou "HCM **27,2 pg (diminuído)**".
export function itemLinha(r: Resultado, marcacao: Marcacao = "asteriscos"): string {
  const rotulo = rotuloExame(r);
  const valor = `${valorExibido(r)}${formatarUnidade(r.unidade)}`;
  const obs = r.observacao ? ` (${r.observacao})` : "";
  if (!ehAlterado(r.flag)) return `${rotulo} ${valor}${obs}`;
  const flag = textoFlag(r.flag);
  if (marcacao === "asteriscos") return `${rotulo} **${valor} (${flag})**${obs}`;
  if (marcacao === "maiusculas") return `${rotulo} ${valor} (${flag.toUpperCase()})${obs}`;
  return `${rotulo} ${valor} (${flag})${obs}`;
}

export function linhasDeExames(resultados: Resultado[], opts: OpcoesLinha = {}): LinhaExames[] {
  const marcacao = opts.marcacao ?? "asteriscos";
  const prefixo = opts.prefixo ?? "Lab";
  const grupos = new Map<string, Resultado[]>();
  for (const r of resultados) {
    const iso = new Date(r.coletadoEm).toISOString();
    const lista = grupos.get(iso) ?? [];
    lista.push(r);
    grupos.set(iso, lista);
  }
  // Quando há mais de uma coleta no mesmo dia, a hora entra no rótulo.
  const porDia = new Map<string, number>();
  for (const iso of grupos.keys()) porDia.set(chaveDia(iso), (porDia.get(chaveDia(iso)) ?? 0) + 1);

  const linhas: LinhaExames[] = [];
  for (const [iso, lista] of grupos) {
    const ordenados = [...lista].sort(
      (a, b) => ordemAnalito(a.analito) - ordemAnalito(b.analito) || rotuloExame(a).localeCompare(rotuloExame(b)),
    );
    const rotuloData = (porDia.get(chaveDia(iso)) ?? 0) > 1 ? `${dataBR(iso)} ${horaBR(iso)}` : dataBR(iso);
    const corpo = ordenados.map((r) => itemLinha(r, marcacao)).join(" / ");
    linhas.push({
      chave: iso,
      iso,
      rotuloData,
      texto: `${prefixo} ${rotuloData} - ${corpo}.`,
      total: ordenados.length,
      alterados: ordenados.filter((r) => ehAlterado(r.flag)).length,
    });
  }
  linhas.sort((a, b) => (opts.ordem === "cronologica" ? a.iso.localeCompare(b.iso) : b.iso.localeCompare(a.iso)));
  return linhas;
}
