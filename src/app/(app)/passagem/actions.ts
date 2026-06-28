"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { exigirUsuario } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { getUltimoSnapshotConcluido } from "@/lib/queries";

// Inicia uma nova passagem: cria o evento (rascunho) e um snapshot por paciente
// ativo do setor, pré-preenchido com o estado da última passagem concluída e
// com o resumo automático de "o que mudou".
export async function iniciarPassagem(fd: FormData) {
  const u = await exigirUsuario();
  const setorId = String(fd.get("setorId") ?? "");
  const medicoRecebeId = String(fd.get("medicoRecebeId") ?? "") || null;
  if (!setorId || !u.setoresIds.includes(setorId)) throw new Error("Setor inválido.");

  const passagem = await prisma.passagemEvento.create({
    data: {
      setorId,
      medicoPassaId: u.id,
      medicoRecebeId,
      status: "rascunho",
    },
  });

  const pacientes = await prisma.paciente.findMany({
    where: { setorId, status: "ativo" },
    orderBy: { criadoEm: "asc" },
  });

  for (const p of pacientes) {
    const anterior = await getUltimoSnapshotConcluido(p.id);
    const resumoMudancas = anterior
      ? "" // preenchido pelo plantonista; abaixo geramos dica automática
      : "Primeira passagem registrada para este paciente.";

    await prisma.snapshotPaciente.create({
      data: {
        passagemId: passagem.id,
        pacienteId: p.id,
        gravidade: anterior?.gravidade ?? "estavel",
        resumoPaciente: anterior?.resumoPaciente ?? "",
        nivelPreocupacao: anterior?.nivelPreocupacao ?? "baixo",
        oQueMePreocupa: anterior?.oQueMePreocupa ?? null,
        resumoMudancas,
      },
    });
  }

  await registrarAuditoria({
    usuarioId: u.id,
    acao: "passagem.iniciar",
    entidade: "PassagemEvento",
    entidadeId: passagem.id,
    valorNovo: { setorId, pacientes: pacientes.length },
  });

  redirect(`/passagem/${passagem.id}`);
}

// Atualiza os campos I-PASS de um snapshot durante o rascunho.
// Se a passagem já estiver concluída, gera uma NOVA versão (append-only).
export async function salvarSnapshot(fd: FormData) {
  const u = await exigirUsuario();
  const snapshotId = String(fd.get("snapshotId") ?? "");
  const snap = await prisma.snapshotPaciente.findUnique({
    where: { id: snapshotId },
    include: { passagem: true },
  });
  if (!snap) throw new Error("Snapshot não encontrado.");

  const dados = {
    gravidade: String(fd.get("gravidade") ?? snap.gravidade),
    resumoPaciente: String(fd.get("resumoPaciente") ?? ""),
    nivelPreocupacao: String(fd.get("nivelPreocupacao") ?? snap.nivelPreocupacao),
    oQueMePreocupa: (String(fd.get("oQueMePreocupa") ?? "").trim() || null) as string | null,
    resumoMudancas: (String(fd.get("resumoMudancas") ?? "").trim() || null) as string | null,
    sinteseReceptor: (String(fd.get("sinteseReceptor") ?? "").trim() || null) as string | null,
  };

  const jaConcluida = snap.imutavel || snap.passagem.status === "concluida";
  const novaVersao = jaConcluida ? snap.versao + 1 : snap.versao;

  await prisma.snapshotPaciente.update({
    where: { id: snapshotId },
    data: { ...dados, versao: novaVersao },
  });

  // Append-only: registra versão a cada edição pós-conclusão (defensibilidade).
  if (jaConcluida) {
    await prisma.snapshotVersao.create({
      data: {
        snapshotId,
        versao: novaVersao,
        dadosJson: JSON.stringify({ ...dados, editadoPor: u.nome, em: new Date().toISOString() }),
      },
    });
    await registrarAuditoria({
      usuarioId: u.id,
      acao: "snapshot.editar-pos-conclusao",
      entidade: "SnapshotPaciente",
      entidadeId: snapshotId,
      valorNovo: dados,
      detalhe: `Nova versão ${novaVersao} em passagem já concluída.`,
    });
  }

  revalidatePath(`/passagem/${snap.passagemId}`);
}

// Read-back: o receptor reconhece um snapshot.
export async function reconhecerSnapshot(snapshotId: string) {
  const u = await exigirUsuario();
  const snap = await prisma.snapshotPaciente.findUnique({ where: { id: snapshotId } });
  if (!snap) throw new Error("Snapshot não encontrado.");
  await prisma.snapshotPaciente.update({ where: { id: snapshotId }, data: { reconhecido: true } });
  await prisma.reconhecimento.create({
    data: { passagemId: snap.passagemId, usuarioId: u.id, tipo: "snapshot", referenciaId: snapshotId },
  });
  await registrarAuditoria({
    usuarioId: u.id,
    acao: "passagem.readback-snapshot",
    entidade: "SnapshotPaciente",
    entidadeId: snapshotId,
  });
  revalidatePath(`/passagem/${snap.passagemId}`);
}

// Read-back de contingência.
export async function reconhecerContingencia(contingenciaId: string, passagemId: string) {
  const u = await exigirUsuario();
  await prisma.contingencia.update({
    where: { id: contingenciaId },
    data: { status: "reconhecida", reconhecidaPor: u.nome, reconhecidaEm: new Date() },
  });
  await prisma.reconhecimento.create({
    data: { passagemId, usuarioId: u.id, tipo: "contingencia", referenciaId: contingenciaId },
  });
  await registrarAuditoria({
    usuarioId: u.id,
    acao: "passagem.readback-contingencia",
    entidade: "Contingencia",
    entidadeId: contingenciaId,
  });
  revalidatePath(`/passagem/${passagemId}`);
}

// Define quem recebe a passagem (caso não escolhido no início).
export async function definirReceptor(passagemId: string, medicoRecebeId: string) {
  const u = await exigirUsuario();
  await prisma.passagemEvento.update({
    where: { id: passagemId },
    data: { medicoRecebeId },
  });
  await registrarAuditoria({
    usuarioId: u.id,
    acao: "passagem.definir-receptor",
    entidade: "PassagemEvento",
    entidadeId: passagemId,
    valorNovo: { medicoRecebeId },
  });
  revalidatePath(`/passagem/${passagemId}`);
}

// Conclui a passagem: valida read-back de críticos/contingências, congela os
// snapshots de forma imutável, versiona, marca pendências abertas como herdadas.
export async function concluirPassagem(passagemId: string) {
  const u = await exigirUsuario();
  const passagem = await prisma.passagemEvento.findUnique({
    where: { id: passagemId },
    include: {
      snapshots: { include: { paciente: { include: { contingencias: true, pendencias: true } } } },
    },
  });
  if (!passagem) throw new Error("Passagem não encontrada.");
  if (passagem.status === "concluida") return { ok: true };
  if (!passagem.medicoRecebeId) throw new Error("Defina o médico que recebe antes de concluir.");

  // Validação de read-back: pacientes críticos (instáveis) precisam ser
  // reconhecidos, e contingências ativas precisam ser reconhecidas.
  const criticosNaoReconhecidos = passagem.snapshots.filter(
    (s) => s.gravidade === "instavel" && !s.reconhecido,
  );
  const contingenciasPendentes = passagem.snapshots.flatMap((s) =>
    s.paciente.contingencias.filter((c) => c.status === "ativa"),
  );
  if (criticosNaoReconhecidos.length > 0) {
    throw new Error(
      `Há ${criticosNaoReconhecidos.length} paciente(s) instável(is) sem reconhecimento do receptor.`,
    );
  }
  if (contingenciasPendentes.length > 0) {
    throw new Error(
      `Há ${contingenciasPendentes.length} contingência(s) ativa(s) sem reconhecimento (read-back).`,
    );
  }

  const agora = new Date();
  const duracaoSeg = Math.max(0, Math.round((agora.getTime() - passagem.inicioEm.getTime()) / 1000));

  // Congela cada snapshot e cria a versão imutável.
  for (const s of passagem.snapshots) {
    const acoesSnapshot = JSON.stringify(
      s.paciente.pendencias.map((p) => ({
        descricao: p.descricao,
        responsavel: p.responsavel,
        prioridade: p.prioridade,
        status: p.status,
        prazo: p.prazo,
      })),
    );
    const contingenciasSnapshot = JSON.stringify(
      s.paciente.contingencias.map((c) => ({
        parametro: c.parametro,
        limiar: c.limiar,
        acao: c.acao,
        status: c.status,
      })),
    );
    await prisma.snapshotPaciente.update({
      where: { id: s.id },
      data: { imutavel: true, acoesSnapshot, contingenciasSnapshot },
    });
    await prisma.snapshotVersao.create({
      data: {
        snapshotId: s.id,
        versao: s.versao,
        dadosJson: JSON.stringify({
          gravidade: s.gravidade,
          resumoPaciente: s.resumoPaciente,
          nivelPreocupacao: s.nivelPreocupacao,
          oQueMePreocupa: s.oQueMePreocupa,
          sinteseReceptor: s.sinteseReceptor,
          acoesSnapshot,
          contingenciasSnapshot,
          congeladoEm: agora.toISOString(),
        }),
      },
    });
  }

  // Pendências ainda abertas migram para o próximo turno (marcadas herdadas).
  const pacienteIds = passagem.snapshots.map((s) => s.pacienteId);
  await prisma.pendencia.updateMany({
    where: { pacienteId: { in: pacienteIds }, status: "aberta", herdada: false },
    data: { herdada: true },
  });

  await prisma.passagemEvento.update({
    where: { id: passagemId },
    data: { status: "concluida", concluidaEm: agora, duracaoSeg },
  });

  await registrarAuditoria({
    usuarioId: u.id,
    acao: "passagem.concluir",
    entidade: "PassagemEvento",
    entidadeId: passagemId,
    valorNovo: { duracaoSeg, pacientes: passagem.snapshots.length },
    detalhe: "Passagem concluída e snapshots congelados (imutáveis).",
  });

  revalidatePath("/quadro");
  revalidatePath("/historico");
  redirect(`/historico/${passagemId}?concluida=1`);
}
