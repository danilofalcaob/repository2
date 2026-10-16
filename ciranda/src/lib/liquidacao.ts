// Liquidação financeira de uma ciranda.
//
// Cada carro é "vendido" uma vez dentro da ciranda. Regras:
//  - diferença (troco) = valor do carro recebido − valor do carro entregue;
//  - quem entrega um carro paga as taxas sobre ele, como numa venda
//    consignada: comissão da plataforma (5% do valor bruto) + taxa da loja;
//  - saldo = diferença + taxas. Saldo > 0: o cliente paga à loja. Saldo < 0:
//    a loja paga ao cliente.
// A loja concentra o caixa: recebe os saldos positivos, paga os negativos,
// fica com a taxa dela e repassa a comissão da plataforma. A soma dos saldos
// é sempre exatamente a receita da plataforma + a da loja.

export type ItemLiquidacao = {
  valorEntregue: number; // 0 para quem só compra
  valorRecebido: number; // 0 para quem só vende
};

export type LinhaLiquidacao = {
  diferenca: number;
  taxaPlataforma: number;
  taxaLoja: number;
  saldo: number;
};

export type Liquidacao = {
  linhas: LinhaLiquidacao[];
  valorBruto: number; // soma do valor de todos os carros negociados
  receitaPlataforma: number;
  receitaLoja: number;
  entradas: number; // total que os clientes pagam à loja
  saidas: number; // total que a loja paga aos clientes
  trocoMovimentado: number; // soma das diferenças positivas (dinheiro entre clientes)
};

export function calcularLiquidacao(
  itens: ItemLiquidacao[],
  taxas: { plataforma: number; loja: number },
): Liquidacao {
  const linhas = itens.map((it) => {
    const diferenca = it.valorRecebido - it.valorEntregue;
    const taxaPlataforma = Math.round(it.valorEntregue * taxas.plataforma);
    const taxaLoja = Math.round(it.valorEntregue * taxas.loja);
    return { diferenca, taxaPlataforma, taxaLoja, saldo: diferenca + taxaPlataforma + taxaLoja };
  });
  const soma = (f: (l: LinhaLiquidacao) => number) => linhas.reduce((s, l) => s + f(l), 0);
  return {
    linhas,
    valorBruto: itens.reduce((s, it) => s + it.valorEntregue, 0),
    receitaPlataforma: soma((l) => l.taxaPlataforma),
    receitaLoja: soma((l) => l.taxaLoja),
    entradas: soma((l) => Math.max(0, l.saldo)),
    saidas: soma((l) => Math.max(0, -l.saldo)),
    trocoMovimentado: soma((l) => Math.max(0, l.diferenca)),
  };
}

// Comparação com o caminho tradicional: vender o carro para uma loja com
// deságio e comprar outro pelo preço de vitrine.
export function compararComLojaTradicional(params: {
  valorCarro: number;
  desagioLoja: number; // ex.: 0.15 = loja paga 15% abaixo do valor de mercado
  taxaPlataforma: number;
  taxaLoja: number;
}) {
  const perdaTradicional = Math.round(params.valorCarro * params.desagioLoja);
  const custoCiranda =
    Math.round(params.valorCarro * params.taxaPlataforma) + Math.round(params.valorCarro * params.taxaLoja);
  return { perdaTradicional, custoCiranda, economia: perdaTradicional - custoCiranda };
}
