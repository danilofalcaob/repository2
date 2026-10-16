import type { Prisma } from "@prisma/client";
import { calcularLiquidacao } from "./liquidacao";
import { TAXA_LOJA_PADRAO } from "./constants";

export const INCLUDE_CIRANDA = {
  loja: true,
  elos: {
    orderBy: { posicao: "asc" },
    include: {
      intencao: { include: { usuario: true } },
      veiculoEntregue: true,
      veiculoRecebido: true,
    },
  },
  eventos: { orderBy: { criadoEm: "asc" }, include: { usuario: true } },
} satisfies Prisma.CirandaInclude;

export type CirandaCompleta = Prisma.CirandaGetPayload<{ include: typeof INCLUDE_CIRANDA }>;
type EloValores = { veiculoEntregueId: string | null; valorProposta: number; valorAvaliado: number | null };

// Vale o valor validado pela loja; até lá, o valor da proposta.
export function valorAtual(elo: EloValores): number {
  return elo.veiculoEntregueId ? elo.valorAvaliado ?? elo.valorProposta : 0;
}

// Antes de uma loja assumir, a taxa dela ainda não é conhecida: usa-se uma
// estimativa (a maior taxa entre as lojas da cidade) para não subestimar custos.
export function liquidacaoDaCiranda(
  c: {
    taxaPlataforma: number;
    taxaLoja: number | null;
    elos: (EloValores & { veiculoRecebidoId: string | null })[];
  },
  taxaLojaEstimada: number = TAXA_LOJA_PADRAO,
) {
  const valorPorVeiculo = new Map(
    c.elos.filter((e) => e.veiculoEntregueId).map((e) => [e.veiculoEntregueId as string, valorAtual(e)]),
  );
  const itens = c.elos.map((e) => ({
    valorEntregue: valorAtual(e),
    valorRecebido: e.veiculoRecebidoId ? valorPorVeiculo.get(e.veiculoRecebidoId) ?? 0 : 0,
  }));
  const taxaLoja = c.taxaLoja ?? taxaLojaEstimada;
  return {
    ...calcularLiquidacao(itens, { plataforma: c.taxaPlataforma, loja: taxaLoja }),
    itens,
    taxaLoja,
    taxaLojaEhEstimativa: c.taxaLoja == null,
  };
}

// Para cada posição: de quem recebe e para quem entrega o carro.
// elos[i] recebe de elos[i+1] (a ordem gravada pelo motor).
export function vizinhos<T>(elos: T[], i: number): { recebeDe: T; entregaPara: T } {
  const k = elos.length;
  return { recebeDe: elos[(i + 1) % k], entregaPara: elos[(i - 1 + k) % k] };
}
