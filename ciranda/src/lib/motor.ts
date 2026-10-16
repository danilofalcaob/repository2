import "server-only";
import { randomInt } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { casar, type Participante } from "./casamento";
import { listaCores } from "./normalizar";
import { PRAZO_RESPOSTA_HORAS, TAXA_PLATAFORMA, type TipoIntencao } from "./constants";
import { aguardaRespostaDosParticipantes } from "./fluxo";

type Tx = Prisma.TransactionClient;

export function prazoResposta(): Date {
  return new Date(Date.now() + PRAZO_RESPOSTA_HORAS * 60 * 60 * 1000);
}

// Código curto e legível para falar ao telefone com a loja: "CR-7KQ4".
const ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
async function gerarCodigo(tx: Tx): Promise<string> {
  for (;;) {
    const codigo = "CR-" + Array.from({ length: 4 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
    if (!(await tx.ciranda.findUnique({ where: { codigo } }))) return codigo;
  }
}

class ConflitoDeCasamento extends Error {}

// Lê o pool de intenções ativas, roda o motor e grava cada ciclo como uma
// ciranda "proposta". Idempotente: pode rodar a cada novo cadastro.
export async function rodarCasamento() {
  await expirarPrazos();

  const intencoes = await prisma.intencao.findMany({
    where: { status: "ativa" },
    include: { veiculo: true, desejos: true, bloqueios: true },
    orderBy: { criadoEm: "asc" },
  });

  const participantes: Participante[] = intencoes.map((i) => ({
    id: i.id,
    tipo: i.tipo as TipoIntencao,
    cidade: i.cidade,
    maxPagar: i.maxPagar,
    veiculo: i.veiculo
      ? {
          id: i.veiculo.id,
          marca: i.veiculo.marca,
          modelo: i.veiculo.modelo,
          ano: i.veiculo.anoModelo,
          cor: i.veiculo.cor,
          km: i.veiculo.km,
          cambio: i.veiculo.cambio,
          valor: i.veiculo.valorPretendido,
        }
      : null,
    desejos: i.desejos.map((d) => ({
      ordem: d.ordem,
      marca: d.marca,
      modelo: d.modelo,
      cores: listaCores(d.cores),
      anoMin: d.anoMin,
      kmMax: d.kmMax,
      cambio: d.cambio,
    })),
  }));
  const bloqueios = intencoes.flatMap((i) =>
    i.bloqueios.map((b) => ({ participanteId: i.id, veiculoId: b.veiculoId })),
  );

  const resultado = casar(participantes, { bloqueios });
  const formadas: { id: string; codigo: string; participantes: number }[] = [];

  for (const ciclo of resultado.ciclos) {
    const ids = ciclo.elos.map((e) => e.participanteId);
    try {
      const ciranda = await prisma.$transaction(async (tx) => {
        // Trava as intenções; se alguma mudou desde a leitura, desiste do ciclo.
        const trava = await tx.intencao.updateMany({
          where: { id: { in: ids }, status: "ativa" },
          data: { status: "em_ciranda", motivoStatus: null },
        });
        if (trava.count !== ids.length) throw new ConflitoDeCasamento();
        return tx.ciranda.create({
          data: {
            codigo: await gerarCodigo(tx),
            cidade: ciclo.cidade,
            taxaPlataforma: TAXA_PLATAFORMA,
            prazo: prazoResposta(),
            pontuacao: ciclo.pontuacao,
            elos: {
              create: ciclo.elos.map((e, posicao) => ({
                posicao,
                intencaoId: e.participanteId,
                veiculoEntregueId: e.veiculoEntregueId,
                veiculoRecebidoId: e.veiculoRecebidoId,
                desejoAtendido: e.desejoAtendido,
                valorProposta: e.valorEntregue,
              })),
            },
            eventos: {
              create: {
                tipo: "formada",
                descricao: `Ciranda formada pelo motor de casamento com ${ids.length} participantes. Prazo de ${PRAZO_RESPOSTA_HORAS}h para os aceites.`,
              },
            },
          },
        });
      });
      formadas.push({ id: ciranda.id, codigo: ciranda.codigo, participantes: ids.length });
    } catch (e) {
      if (!(e instanceof ConflitoDeCasamento)) throw e;
    }
  }

  return { formadas, naoAtendidos: resultado.naoAtendidos.length, estatisticas: resultado.estatisticas };
}

// Cancela a ciranda e devolve os participantes ao pool. Quem causou a queda
// pode ser pausado (com o motivo) e quem recusou um carro não o recebe de novo.
export async function cancelarCiranda(
  tx: Tx,
  cirandaId: string,
  opcoes: {
    motivo: string;
    usuarioId?: string;
    pausar?: Record<string, string>; // intencaoId → motivo
    bloquear?: { intencaoId: string; veiculoId: string }[];
  },
) {
  const ciranda = await tx.ciranda.update({
    where: { id: cirandaId },
    data: { status: "cancelada", motivoCancelamento: opcoes.motivo },
    include: { elos: true },
  });
  for (const elo of ciranda.elos) {
    const motivoPausa = opcoes.pausar?.[elo.intencaoId];
    await tx.intencao.updateMany({
      where: { id: elo.intencaoId, status: "em_ciranda" },
      data: motivoPausa
        ? { status: "pausada", motivoStatus: motivoPausa }
        : { status: "ativa", motivoStatus: null },
    });
  }
  for (const b of opcoes.bloquear ?? []) {
    await tx.bloqueio.upsert({
      where: { intencaoId_veiculoId: { intencaoId: b.intencaoId, veiculoId: b.veiculoId } },
      create: b,
      update: {},
    });
  }
  await tx.eventoCiranda.create({
    data: {
      cirandaId,
      usuarioId: opcoes.usuarioId,
      tipo: "cancelada",
      descricao: `Ciranda cancelada: ${opcoes.motivo} Os demais participantes voltaram para a fila de casamento.`,
    },
  });
}

// Cirandas cujo prazo de resposta venceu: quem não respondeu é pausado (para
// não travar novas cirandas) e os demais voltam ao pool.
export async function expirarPrazos() {
  const vencidas = await prisma.ciranda.findMany({
    where: { status: { in: ["proposta", "confirmacao_final"] }, prazo: { lt: new Date() } },
    include: { elos: true },
  });
  for (const c of vencidas) {
    if (!aguardaRespostaDosParticipantes(c.status)) continue;
    const pendentes = c.elos.filter((e) =>
      c.status === "proposta" ? e.aceite === "pendente" : e.confirmacao === "pendente",
    );
    await prisma.$transaction((tx) =>
      cancelarCiranda(tx, c.id, {
        motivo: `${pendentes.length} participante(s) não responderam no prazo.`,
        pausar: Object.fromEntries(
          pendentes.map((e) => [e.intencaoId, "Você não respondeu a uma ciranda dentro do prazo. Reative quando quiser voltar à fila."]),
        ),
      }),
    );
  }
  return vencidas.length;
}

// Sem um agendador, os prazos são conferidos sempre que alguém abre um painel
// ou uma ciranda; se algo venceu, quem voltou para a fila já entra no motor.
export async function verificarPrazos() {
  if ((await expirarPrazos()) > 0) await rodarCasamento();
}
