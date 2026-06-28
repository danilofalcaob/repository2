import "server-only";
import { prisma } from "./db";

// Registro append-only de toda ação relevante. Nunca atualiza/deleta logs.
export async function registrarAuditoria(params: {
  usuarioId?: string | null;
  acao: string;
  entidade?: string;
  entidadeId?: string;
  valorAnterior?: unknown;
  valorNovo?: unknown;
  detalhe?: string;
}): Promise<void> {
  const serial = (v: unknown) =>
    v == null ? null : typeof v === "string" ? v : JSON.stringify(v);
  try {
    await prisma.logAuditoria.create({
      data: {
        usuarioId: params.usuarioId ?? null,
        acao: params.acao,
        entidade: params.entidade,
        entidadeId: params.entidadeId,
        valorAnterior: serial(params.valorAnterior),
        valorNovo: serial(params.valorNovo),
        detalhe: params.detalhe,
      },
    });
  } catch (e) {
    // Auditoria não deve quebrar o fluxo principal, mas registramos no console.
    console.error("Falha ao registrar auditoria:", e);
  }
}
