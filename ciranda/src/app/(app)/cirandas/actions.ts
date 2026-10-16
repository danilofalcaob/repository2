"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { exigirUsuario, type UsuarioSessao } from "@/lib/auth";
import { cancelarCiranda, prazoResposta, rodarCasamento } from "@/lib/motor";
import { INCLUDE_CIRANDA, liquidacaoDaCiranda } from "@/lib/ciranda-view";
import {
  avaliacaoCompleta,
  podeConcluir,
  prazoVencido,
  statusAposAceites,
  statusAposAvaliacoes,
  statusAposConfirmacoes,
} from "@/lib/fluxo";
import { lerReais, nomeCarro, primeiroNome, reais } from "@/lib/format";
import { normalizar } from "@/lib/normalizar";

async function carregar(id: string) {
  const c = await prisma.ciranda.findUnique({ where: { id }, include: INCLUDE_CIRANDA });
  if (!c) throw new Error("Ciranda não encontrada.");
  return c;
}

function meuElo(c: Awaited<ReturnType<typeof carregar>>, u: UsuarioSessao) {
  const elo = c.elos.find((e) => e.intencao.usuarioId === u.id);
  if (!elo) throw new Error("Você não participa desta ciranda.");
  return elo;
}

function exigirLojaDaCiranda(c: { lojaId: string | null }, u: UsuarioSessao) {
  if (u.perfil !== "loja" || !u.lojaId || c.lojaId !== u.lojaId) {
    throw new Error("Só a loja que assumiu esta ciranda pode fazer isto.");
  }
}

function atualizar(id: string) {
  revalidatePath(`/cirandas/${id}`);
  revalidatePath("/painel");
  revalidatePath("/loja");
  revalidatePath("/admin");
}

async function evento(cirandaId: string, usuarioId: string | null, tipo: string, descricao: string) {
  await prisma.eventoCiranda.create({ data: { cirandaId, usuarioId, tipo, descricao } });
}

// Avança a etapa relendo os elos do banco (respostas simultâneas não se perdem)
// e só se a ciranda ainda estiver na etapa de origem (o evento sai uma vez só).
async function avancarSe(
  cirandaId: string,
  de: string,
  calcular: (elos: Awaited<ReturnType<typeof prisma.elo.findMany>>) => string,
  dados: { status: string; prazo?: Date },
  descricao: string,
) {
  const elos = await prisma.elo.findMany({ where: { cirandaId } });
  if (calcular(elos) !== dados.status) return;
  const r = await prisma.ciranda.updateMany({ where: { id: cirandaId, status: de }, data: dados });
  if (r.count > 0) await evento(cirandaId, null, dados.status, descricao);
}

// --------------------------------------------------------------------------
// 1) Participante aceita ou recusa a proposta
// --------------------------------------------------------------------------

export async function responderProposta(cirandaId: string, aceitar: boolean, fd: FormData) {
  const u = await exigirUsuario(["cliente"]);
  const c = await carregar(cirandaId);
  const elo = meuElo(c, u);
  if (c.status !== "proposta" || elo.aceite !== "pendente") throw new Error("Esta proposta não está aguardando a sua resposta.");
  if (prazoVencido(c.prazo)) throw new Error("O prazo desta proposta venceu.");

  if (!aceitar) {
    const motivo = String(fd.get("motivo") ?? "").trim();
    await prisma.$transaction(async (tx) => {
      await tx.elo.update({
        where: { id: elo.id },
        data: { aceite: "recusado", aceiteEm: new Date(), motivoRecusa: motivo || null },
      });
      await cancelarCiranda(tx, c.id, {
        usuarioId: u.id,
        motivo: `${primeiroNome(u.nome)} recusou a proposta.`,
        bloquear: elo.veiculoRecebidoId ? [{ intencaoId: elo.intencaoId, veiculoId: elo.veiculoRecebidoId }] : [],
      });
    });
    await rodarCasamento();
    atualizar(c.id);
    return;
  }

  await prisma.elo.update({ where: { id: elo.id }, data: { aceite: "aceito", aceiteEm: new Date() } });
  await evento(c.id, u.id, "aceite", `${primeiroNome(u.nome)} aceitou a proposta.`);
  await avancarSe(
    c.id,
    "proposta",
    statusAposAceites,
    { status: "aguardando_loja" },
    "Todos aceitaram. A ciranda está disponível para as lojas parceiras da cidade.",
  );
  atualizar(c.id);
}

// --------------------------------------------------------------------------
// 2) Loja parceira assume a ciranda
// --------------------------------------------------------------------------

export async function assumirCiranda(cirandaId: string) {
  const u = await exigirUsuario(["loja"]);
  const loja = u.lojaId ? await prisma.loja.findUnique({ where: { id: u.lojaId } }) : null;
  if (!loja || !loja.ativa) throw new Error("Sua loja não está ativa na plataforma.");
  const c = await carregar(cirandaId);
  if (normalizar(loja.cidade) !== normalizar(c.cidade)) throw new Error("Esta ciranda é de outra cidade.");

  // updateMany com filtro de status: se outra loja assumiu antes, nada muda.
  const r = await prisma.ciranda.updateMany({
    where: { id: c.id, status: "aguardando_loja", lojaId: null },
    data: { status: "em_avaliacao", lojaId: loja.id, taxaLoja: loja.taxaServico },
  });
  if (r.count === 0) throw new Error("Outra loja já assumiu esta ciranda.");
  await evento(c.id, u.id, "loja_assumiu", `${loja.nome} assumiu a ciranda e vai agendar a vistoria dos carros.`);
  atualizar(c.id);
}

// --------------------------------------------------------------------------
// 3) Loja avalia cada carro (documentação, gravame, cautelar, estado, valor)
// --------------------------------------------------------------------------

export async function avaliarVeiculo(eloId: string, fd: FormData) {
  const u = await exigirUsuario(["loja"]);
  const eloBase = await prisma.elo.findUnique({ where: { id: eloId } });
  if (!eloBase) throw new Error("Participante não encontrado.");
  const c = await carregar(eloBase.cirandaId);
  exigirLojaDaCiranda(c, u);
  if (c.status !== "em_avaliacao") throw new Error("A ciranda não está em avaliação.");
  const elo = c.elos.find((e) => e.id === eloId)!;
  if (!elo.veiculoEntregue) throw new Error("Este participante não entrega carro.");

  const aprovar = fd.get("decisao") === "aprovar";
  const dados = {
    docOk: fd.get("docOk") === "on",
    gravameOk: fd.get("gravameOk") === "on",
    cautelarOk: fd.get("cautelarOk") === "on",
    estadoOk: fd.get("estadoOk") === "on",
    valorAvaliado: lerReais(String(fd.get("valorAvaliado") ?? "")),
  };
  const obs = String(fd.get("obsAvaliacao") ?? "").trim();
  if (aprovar && !avaliacaoCompleta(dados)) {
    throw new Error("Para aprovar, marque todos os itens do checklist e informe o valor avaliado.");
  }
  if (!aprovar && !obs) throw new Error("Explique o motivo da reprovação para o cliente.");

  await prisma.elo.update({
    where: { id: elo.id },
    data: { ...dados, obsAvaliacao: obs || null, avaliacao: aprovar ? "aprovado" : "reprovado", avaliadoEm: new Date() },
  });
  const carro = nomeCarro(elo.veiculoEntregue);
  const dono = primeiroNome(elo.intencao.usuario.nome);

  if (!aprovar) {
    await prisma.$transaction((tx) =>
      cancelarCiranda(tx, c.id, {
        usuarioId: u.id,
        motivo: `O ${carro} de ${dono} foi reprovado na avaliação (${obs}).`,
        pausar: { [elo.intencaoId]: `Seu ${carro} foi reprovado na avaliação da loja: ${obs}. Regularize e reative o cadastro.` },
      }),
    );
    await rodarCasamento();
    atualizar(c.id);
    return;
  }

  const ajuste =
    dados.valorAvaliado !== elo.valorProposta
      ? ` Valor validado: ${reais(dados.valorAvaliado!)} (proposta: ${reais(elo.valorProposta)}).`
      : ` Valor confirmado: ${reais(dados.valorAvaliado!)}.`;
  await evento(c.id, u.id, "avaliacao", `O ${carro} de ${dono} foi aprovado na vistoria.${ajuste}`);

  await avancarSe(
    c.id,
    "em_avaliacao",
    statusAposAvaliacoes,
    { status: "confirmacao_final", prazo: prazoResposta() },
    "Todos os carros aprovados. Os participantes devem confirmar os valores finais.",
  );
  atualizar(c.id);
}

// --------------------------------------------------------------------------
// 4) Participante confirma com os valores validados (ou desiste)
// --------------------------------------------------------------------------

export async function confirmarFinal(cirandaId: string, confirmar: boolean) {
  const u = await exigirUsuario(["cliente"]);
  const c = await carregar(cirandaId);
  const elo = meuElo(c, u);
  if (c.status !== "confirmacao_final" || elo.confirmacao !== "pendente") throw new Error("Nada a confirmar nesta ciranda.");
  if (prazoVencido(c.prazo)) throw new Error("O prazo de confirmação venceu.");

  if (!confirmar) {
    await prisma.$transaction(async (tx) => {
      await tx.elo.update({ where: { id: elo.id }, data: { confirmacao: "recusado", confirmadoEm: new Date() } });
      await cancelarCiranda(tx, c.id, {
        usuarioId: u.id,
        motivo: `${primeiroNome(u.nome)} desistiu com os valores finais.`,
        bloquear: elo.veiculoRecebidoId ? [{ intencaoId: elo.intencaoId, veiculoId: elo.veiculoRecebidoId }] : [],
      });
    });
    await rodarCasamento();
    atualizar(c.id);
    return;
  }

  await prisma.elo.update({ where: { id: elo.id }, data: { confirmacao: "confirmado", confirmadoEm: new Date() } });
  await evento(c.id, u.id, "confirmacao", `${primeiroNome(u.nome)} confirmou os valores finais.`);
  await avancarSe(
    c.id,
    "confirmacao_final",
    statusAposConfirmacoes,
    { status: "em_liquidacao" },
    "Todos confirmaram. A loja vai acertar os pagamentos e transferir os carros.",
  );
  atualizar(c.id);
}

// --------------------------------------------------------------------------
// 5) Loja registra pagamentos e transferências e conclui
// --------------------------------------------------------------------------

export async function marcarLiquidacao(eloId: string, campo: "pagamentoOk" | "transferenciaOk") {
  const u = await exigirUsuario(["loja"]);
  const elo = await prisma.elo.findUnique({ where: { id: eloId }, include: { ciranda: true } });
  if (!elo) throw new Error("Participante não encontrado.");
  exigirLojaDaCiranda(elo.ciranda, u);
  if (elo.ciranda.status !== "em_liquidacao") throw new Error("A ciranda não está em liquidação.");
  if (campo === "transferenciaOk" && !elo.veiculoEntregueId) throw new Error("Este participante não entrega carro.");
  await prisma.elo.update({ where: { id: eloId }, data: { [campo]: !elo[campo] } });
  atualizar(elo.cirandaId);
}

export async function concluirCiranda(cirandaId: string) {
  const u = await exigirUsuario(["loja"]);
  const c = await carregar(cirandaId);
  exigirLojaDaCiranda(c, u);
  if (c.status !== "em_liquidacao") throw new Error("A ciranda não está em liquidação.");
  if (!podeConcluir(c.elos)) throw new Error("Ainda há pagamentos ou transferências pendentes.");
  const liq = liquidacaoDaCiranda(c);

  await prisma.$transaction(async (tx) => {
    await tx.ciranda.update({ where: { id: c.id }, data: { status: "concluida", concluidaEm: new Date() } });
    for (const e of c.elos) {
      await tx.intencao.update({ where: { id: e.intencaoId }, data: { status: "concluida", motivoStatus: null } });
      // O carro recebido passa a ser do participante (pode virar um novo cadastro no futuro).
      if (e.veiculoRecebidoId) {
        await tx.veiculo.update({ where: { id: e.veiculoRecebidoId }, data: { donoId: e.intencao.usuarioId } });
      }
    }
    await tx.eventoCiranda.create({
      data: {
        cirandaId: c.id,
        usuarioId: u.id,
        tipo: "concluida",
        descricao: `Ciranda concluída: ${c.elos.length} participantes, ${reais(liq.valorBruto)} em carros. Comissão da plataforma: ${reais(liq.receitaPlataforma)}. Taxa da loja: ${reais(liq.receitaLoja)}.`,
      },
    });
  });
  atualizar(c.id);
}

// --------------------------------------------------------------------------
// Cancelamento pela loja responsável ou pela plataforma
// --------------------------------------------------------------------------

export async function cancelarPelaOperacao(cirandaId: string, fd: FormData) {
  const u = await exigirUsuario(["loja", "admin"]);
  const c = await carregar(cirandaId);
  if (u.perfil === "loja") exigirLojaDaCiranda(c, u);
  if (c.status === "concluida" || c.status === "cancelada") throw new Error("Esta ciranda já foi encerrada.");
  const motivo = String(fd.get("motivo") ?? "").trim();
  if (!motivo) throw new Error("Informe o motivo do cancelamento.");
  await prisma.$transaction((tx) => cancelarCiranda(tx, c.id, { usuarioId: u.id, motivo: `${motivo}.` }));
  await rodarCasamento();
  atualizar(c.id);
}
