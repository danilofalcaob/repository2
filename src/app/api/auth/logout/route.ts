import { NextResponse } from "next/server";
import { getUsuarioAtual, encerrarSessao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";

export async function POST() {
  const u = await getUsuarioAtual();
  await registrarAuditoria({ usuarioId: u?.id, acao: "auth.logout" });
  await encerrarSessao();
  return NextResponse.json({ ok: true });
}
