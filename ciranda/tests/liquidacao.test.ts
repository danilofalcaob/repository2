import { describe, it, expect } from "vitest";
import { calcularLiquidacao, compararComLojaTradicional } from "@/lib/liquidacao";
import {
  statusAposAceites,
  statusAposAvaliacoes,
  statusAposConfirmacoes,
  podeConcluir,
  avaliacaoCompleta,
} from "@/lib/fluxo";

const TAXAS = { plataforma: 0.05, loja: 0.03 };

describe("liquidação", () => {
  // João (A3 152k → Compass 139k), Maria (Compass → Nivus 124k),
  // Guilherme (Nivus → X1 168k), Pedro (X1 → A3).
  const itens = [
    { valorEntregue: 152000, valorRecebido: 139000 },
    { valorEntregue: 139000, valorRecebido: 124000 },
    { valorEntregue: 124000, valorRecebido: 168000 },
    { valorEntregue: 168000, valorRecebido: 152000 },
  ];

  it("plataforma recebe 5% do valor bruto de todos os carros", () => {
    const l = calcularLiquidacao(itens, TAXAS);
    expect(l.valorBruto).toBe(583000);
    expect(l.receitaPlataforma).toBe(29150);
    expect(l.receitaLoja).toBe(17490);
  });

  it("a soma dos saldos é exatamente a receita da plataforma + a da loja", () => {
    const l = calcularLiquidacao(itens, TAXAS);
    const somaSaldos = l.linhas.reduce((s, x) => s + x.saldo, 0);
    expect(somaSaldos).toBe(l.receitaPlataforma + l.receitaLoja);
    expect(l.entradas - l.saidas).toBe(l.receitaPlataforma + l.receitaLoja);
  });

  it("saldo = troco + taxas sobre o carro entregue", () => {
    const [joao, , guilherme] = calcularLiquidacao(itens, TAXAS).linhas;
    expect(joao.diferenca).toBe(-13000);
    expect(joao.taxaPlataforma).toBe(7600);
    expect(joao.taxaLoja).toBe(4560);
    expect(joao.saldo).toBe(-840); // ainda recebe R$ 840
    expect(guilherme.saldo).toBe(44000 + 6200 + 3720);
  });

  it("quem só compra não paga taxa; quem só vende paga sobre o carro vendido", () => {
    const l = calcularLiquidacao(
      [
        { valorEntregue: 0, valorRecebido: 100000 },
        { valorEntregue: 100000, valorRecebido: 0 },
      ],
      TAXAS,
    );
    expect(l.linhas[0].saldo).toBe(100000);
    expect(l.linhas[1].saldo).toBe(-92000);
  });

  it("compara com a venda para loja tradicional", () => {
    const c = compararComLojaTradicional({ valorCarro: 100000, desagioLoja: 0.15, taxaPlataforma: 0.05, taxaLoja: 0.03 });
    expect(c).toEqual({ perdaTradicional: 15000, custoCiranda: 8000, economia: 7000 });
  });
});

describe("fluxo da ciranda", () => {
  it("aceites", () => {
    expect(statusAposAceites([{ aceite: "aceito" }, { aceite: "pendente" }])).toBe("proposta");
    expect(statusAposAceites([{ aceite: "aceito" }, { aceite: "aceito" }])).toBe("aguardando_loja");
    expect(statusAposAceites([{ aceite: "aceito" }, { aceite: "recusado" }])).toBe("cancelada");
  });

  it("avaliação ignora quem só compra (sem carro)", () => {
    expect(
      statusAposAvaliacoes([
        { veiculoEntregueId: "v1", avaliacao: "aprovado" },
        { veiculoEntregueId: null, avaliacao: "pendente" },
      ]),
    ).toBe("confirmacao_final");
    expect(statusAposAvaliacoes([{ veiculoEntregueId: "v1", avaliacao: "reprovado" }])).toBe("cancelada");
    expect(statusAposAvaliacoes([{ veiculoEntregueId: "v1", avaliacao: "pendente" }])).toBe("em_avaliacao");
  });

  it("confirmação final", () => {
    expect(statusAposConfirmacoes([{ confirmacao: "confirmado" }, { confirmacao: "confirmado" }])).toBe("em_liquidacao");
    expect(statusAposConfirmacoes([{ confirmacao: "confirmado" }, { confirmacao: "recusado" }])).toBe("cancelada");
  });

  it("só conclui com tudo pago e transferido", () => {
    expect(podeConcluir([{ veiculoEntregueId: "v1", pagamentoOk: true, transferenciaOk: false }])).toBe(false);
    expect(podeConcluir([{ veiculoEntregueId: null, pagamentoOk: true, transferenciaOk: false }])).toBe(true);
  });

  it("aprovação exige checklist completo e valor", () => {
    const ok = { docOk: true, gravameOk: true, cautelarOk: true, estadoOk: true, valorAvaliado: 100000 };
    expect(avaliacaoCompleta(ok)).toBe(true);
    expect(avaliacaoCompleta({ ...ok, cautelarOk: false })).toBe(false);
    expect(avaliacaoCompleta({ ...ok, valorAvaliado: null })).toBe(false);
  });
});
