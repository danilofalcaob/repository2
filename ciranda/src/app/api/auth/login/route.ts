import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verificarSenha, criarSessao, paginaInicial } from "@/lib/auth";
import { classificarErroBanco, mensagemProblemaBanco } from "@/lib/diagnostico";
import type { Perfil } from "@/lib/constants";

const schema = z.object({ email: z.string().email(), senha: z.string().min(1) });

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });
  const { email, senha } = parsed.data;

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email: email.toLowerCase() } });
    if (!usuario || !usuario.ativo || !(await verificarSenha(senha, usuario.senhaHash))) {
      return NextResponse.json({ erro: "E-mail ou senha incorretos." }, { status: 401 });
    }
    await criarSessao(usuario.id);
    return NextResponse.json({ ok: true, destino: paginaInicial(usuario.perfil as Perfil) });
  } catch (e) {
    console.error("[login] Erro ao acessar o banco de dados:", e);
    return NextResponse.json({ erro: mensagemProblemaBanco(classificarErroBanco(e)) }, { status: 503 });
  }
}
