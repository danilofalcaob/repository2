"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { exigirUsuario } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { getUltimoSnapshotConcluido } from "@/lib/queries";

export async function registrarTRR(fd: FormData) {
  const u = await exigirUsuario();
  const pacienteId = String(fd.get("pacienteId") ?? "");
  const criterio = String(fd.get("criterio") ?? "").trim();
  if (!pacienteId || !criterio) throw new Error("Paciente e critério são obrigatórios.");

  const paciente = await prisma.paciente.findUnique({ where: { id: pacienteId } });
  if (!paciente || !u.setoresIds.includes(paciente.setorId)) throw new Error("Sem acesso a este paciente.");

  // Cruzamento: havia contingência/preocupação registrada na última passagem?
  const ultimoSnap = await getUltimoSnapshotConcluido(pacienteId);
  const contingenciasAtivas = await prisma.contingencia.count({
    where: { pacienteId, status: { in: ["ativa", "reconhecida", "disparada"] } },
  });
  const tinhaPreocupacao = ultimoSnap ? ultimoSnap.nivelPreocupacao !== "baixo" : false;

  const ocorridoStr = String(fd.get("ocorridoEm") ?? "");
  const evento = await prisma.eventoTRR.create({
    data: {
      pacienteId,
      criterio,
      equipe: String(fd.get("equipe") ?? "").trim() || null,
      desfecho: String(fd.get("desfecho") ?? "").trim() || null,
      ocorridoEm: ocorridoStr ? new Date(ocorridoStr) : new Date(),
      passagemId: ultimoSnap?.passagemId ?? null,
      tinhaContingencia: contingenciasAtivas > 0,
      tinhaPreocupacao,
    },
  });

  await registrarAuditoria({
    usuarioId: u.id,
    acao: "trr.registrar",
    entidade: "EventoTRR",
    entidadeId: evento.id,
    valorNovo: { pacienteId, criterio, tinhaContingencia: contingenciasAtivas > 0, tinhaPreocupacao },
  });

  revalidatePath("/trr");
  revalidatePath(`/pacientes/${pacienteId}`);
  redirect("/trr");
}
