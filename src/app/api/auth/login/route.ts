import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verificarSenha, criarSessao } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";

const schema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  }
  const { email, senha } = parsed.data;

  const usuario = await prisma.usuario.findUnique({ where: { email: email.toLowerCase() } });
  if (!usuario || !usuario.ativo || !(await verificarSenha(senha, usuario.senhaHash))) {
    return NextResponse.json({ erro: "E-mail ou senha incorretos." }, { status: 401 });
  }

  await criarSessao(usuario.id);
  await registrarAuditoria({ usuarioId: usuario.id, acao: "auth.login", entidade: "Usuario", entidadeId: usuario.id });

  return NextResponse.json({ ok: true });
}
