// Máquina de estados da ciranda — funções puras usadas pelas server actions e
// pelos testes. Uma ciranda é tudo ou nada: se um elo cai, ela é cancelada e
// os demais participantes voltam ao pool para o motor tentar de novo.
//
//   proposta ──todos aceitam──▶ aguardando_loja ──loja assume──▶ em_avaliacao
//   em_avaliacao ──todos os carros aprovados──▶ confirmacao_final
//   confirmacao_final ──todos confirmam──▶ em_liquidacao ──tudo pago e transferido──▶ concluida
//   (qualquer recusa, reprovação, prazo vencido ou cancelamento) ──▶ cancelada

import type { StatusCiranda } from "./constants";

type EloAceite = { aceite: string };
type EloAvaliacao = { veiculoEntregueId: string | null; avaliacao: string };
type EloConfirmacao = { confirmacao: string };
type EloLiquidacao = { veiculoEntregueId: string | null; pagamentoOk: boolean; transferenciaOk: boolean };

export function statusAposAceites(elos: EloAceite[]): StatusCiranda {
  if (elos.some((e) => e.aceite === "recusado")) return "cancelada";
  if (elos.every((e) => e.aceite === "aceito")) return "aguardando_loja";
  return "proposta";
}

// Só quem entrega carro passa por avaliação (quem só compra não tem carro).
export function statusAposAvaliacoes(elos: EloAvaliacao[]): StatusCiranda {
  const comCarro = elos.filter((e) => e.veiculoEntregueId);
  if (comCarro.some((e) => e.avaliacao === "reprovado")) return "cancelada";
  if (comCarro.every((e) => e.avaliacao === "aprovado")) return "confirmacao_final";
  return "em_avaliacao";
}

export function statusAposConfirmacoes(elos: EloConfirmacao[]): StatusCiranda {
  if (elos.some((e) => e.confirmacao === "recusado")) return "cancelada";
  if (elos.every((e) => e.confirmacao === "confirmado")) return "em_liquidacao";
  return "confirmacao_final";
}

export function podeConcluir(elos: EloLiquidacao[]): boolean {
  return elos.every((e) => e.pagamentoOk && (!e.veiculoEntregueId || e.transferenciaOk));
}

// A aprovação exige o checklist completo e um valor validado pela loja.
export function avaliacaoCompleta(a: {
  docOk: boolean;
  gravameOk: boolean;
  cautelarOk: boolean;
  estadoOk: boolean;
  valorAvaliado: number | null;
}): boolean {
  return a.docOk && a.gravameOk && a.cautelarOk && a.estadoOk && a.valorAvaliado != null && a.valorAvaliado > 0;
}

export function prazoVencido(prazo: Date, agora: Date = new Date()): boolean {
  return prazo.getTime() < agora.getTime();
}

// Etapas em que o participante precisa responder dentro do prazo.
export function aguardaRespostaDosParticipantes(status: string): boolean {
  return status === "proposta" || status === "confirmacao_final";
}
