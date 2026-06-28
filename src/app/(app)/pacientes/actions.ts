"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { exigirUsuario } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";

function val(fd: FormData, k: string) {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export async function criarPaciente(fd: FormData) {
  const u = await exigirUsuario();
  const setorId = val(fd, "setorId");
  const identificador = val(fd, "identificador");
  if (!setorId || !identificador) throw new Error("Setor e identificador são obrigatórios.");
  if (!u.setoresIds.includes(setorId)) throw new Error("Sem acesso a este setor.");

  const idadeStr = val(fd, "idade");
  const p = await prisma.paciente.create({
    data: {
      setorId,
      identificador,
      leito: val(fd, "leito"),
      idade: idadeStr ? parseInt(idadeStr, 10) : null,
      sexo: val(fd, "sexo"),
      diagnosticoPrincipal: val(fd, "diagnosticoPrincipal"),
      alergias: val(fd, "alergias"),
    },
  });
  await registrarAuditoria({
    usuarioId: u.id,
    acao: "paciente.criar",
    entidade: "Paciente",
    entidadeId: p.id,
    valorNovo: { identificador, setorId },
  });
  revalidatePath("/pacientes");
  revalidatePath("/quadro");
}

export async function atualizarStatusPaciente(pacienteId: string, status: string) {
  const u = await exigirUsuario();
  const antes = await prisma.paciente.findUnique({ where: { id: pacienteId } });
  if (!antes || !u.setoresIds.includes(antes.setorId)) throw new Error("Sem acesso.");
  await prisma.paciente.update({ where: { id: pacienteId }, data: { status } });
  await registrarAuditoria({
    usuarioId: u.id,
    acao: "paciente.status",
    entidade: "Paciente",
    entidadeId: pacienteId,
    valorAnterior: antes.status,
    valorNovo: status,
  });
  revalidatePath(`/pacientes/${pacienteId}`);
  revalidatePath("/quadro");
}

// ---- Pendências ----
export async function criarPendencia(fd: FormData) {
  const u = await exigirUsuario();
  const pacienteId = val(fd, "pacienteId")!;
  const descricao = val(fd, "descricao");
  if (!descricao) throw new Error("Descrição obrigatória.");
  const prazo = val(fd, "prazo");
  const pend = await prisma.pendencia.create({
    data: {
      pacienteId,
      descricao,
      responsavel: val(fd, "responsavel"),
      prioridade: val(fd, "prioridade") ?? "media",
      prazo: prazo ? new Date(prazo) : null,
    },
  });
  await registrarAuditoria({
    usuarioId: u.id,
    acao: "pendencia.criar",
    entidade: "Pendencia",
    entidadeId: pend.id,
    valorNovo: { descricao },
  });
  revalidatePath(`/pacientes/${pacienteId}`);
  revalidatePath("/quadro");
}

export async function mudarStatusPendencia(pendenciaId: string, status: string) {
  const u = await exigirUsuario();
  const antes = await prisma.pendencia.findUnique({ where: { id: pendenciaId } });
  if (!antes) throw new Error("Pendência não encontrada.");
  const hist = antes.historicoJson ? JSON.parse(antes.historicoJson) : [];
  hist.push({ por: u.nome, de: antes.status, para: status, em: new Date().toISOString() });
  await prisma.pendencia.update({
    where: { id: pendenciaId },
    data: {
      status,
      concluidaEm: status === "concluida" ? new Date() : null,
      historicoJson: JSON.stringify(hist),
    },
  });
  await registrarAuditoria({
    usuarioId: u.id,
    acao: "pendencia.status",
    entidade: "Pendencia",
    entidadeId: pendenciaId,
    valorAnterior: antes.status,
    valorNovo: status,
  });
  revalidatePath(`/pacientes/${antes.pacienteId}`);
  revalidatePath("/quadro");
}

// ---- Contingências ----
export async function criarContingencia(fd: FormData) {
  const u = await exigirUsuario();
  const pacienteId = val(fd, "pacienteId")!;
  const parametro = val(fd, "parametro");
  const limiar = val(fd, "limiar");
  const acao = val(fd, "acao");
  if (!parametro || !limiar || !acao)
    throw new Error("Parâmetro, limiar e ação são obrigatórios.");
  const lembrete = val(fd, "lembreteEm");
  const c = await prisma.contingencia.create({
    data: {
      pacienteId,
      parametro,
      limiar,
      acao,
      prioridade: val(fd, "prioridade") ?? "alta",
      lembreteEm: lembrete ? new Date(lembrete) : null,
    },
  });
  await registrarAuditoria({
    usuarioId: u.id,
    acao: "contingencia.criar",
    entidade: "Contingencia",
    entidadeId: c.id,
    valorNovo: { parametro, limiar, acao },
  });
  revalidatePath(`/pacientes/${pacienteId}`);
  revalidatePath("/quadro");
}

// Registra que o gatilho da contingência ocorreu.
export async function dispararContingencia(contingenciaId: string) {
  const u = await exigirUsuario();
  const antes = await prisma.contingencia.findUnique({ where: { id: contingenciaId } });
  if (!antes) throw new Error("Contingência não encontrada.");
  await prisma.contingencia.update({
    where: { id: contingenciaId },
    data: { status: "disparada", dispradaEm: new Date() },
  });
  await registrarAuditoria({
    usuarioId: u.id,
    acao: "contingencia.disparar",
    entidade: "Contingencia",
    entidadeId: contingenciaId,
    valorAnterior: antes.status,
    valorNovo: "disparada",
  });
  revalidatePath(`/pacientes/${antes.pacienteId}`);
  revalidatePath("/quadro");
}

export async function resolverContingencia(contingenciaId: string) {
  const u = await exigirUsuario();
  const antes = await prisma.contingencia.findUnique({ where: { id: contingenciaId } });
  if (!antes) throw new Error("Contingência não encontrada.");
  await prisma.contingencia.update({
    where: { id: contingenciaId },
    data: { status: "resolvida", resolvidaEm: new Date() },
  });
  await registrarAuditoria({
    usuarioId: u.id,
    acao: "contingencia.resolver",
    entidade: "Contingencia",
    entidadeId: contingenciaId,
    valorAnterior: antes.status,
    valorNovo: "resolvida",
  });
  revalidatePath(`/pacientes/${antes.pacienteId}`);
  revalidatePath("/quadro");
}
