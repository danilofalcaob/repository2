"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { criarSessao, hashSenha } from "@/lib/auth";

const schema = z.object({
  nome: z.string().trim().min(3, "Informe seu nome completo."),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  telefone: z.string().trim().min(8, "Informe um telefone com DDD."),
  cidade: z.string().trim().min(2, "Informe sua cidade."),
  senha: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres."),
  termos: z.literal("on", { errorMap: () => ({ message: "É preciso aceitar os termos para continuar." }) }),
});

export type EstadoCadastro = { erro?: string };

export async function cadastrar(_: EstadoCadastro, fd: FormData): Promise<EstadoCadastro> {
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { erro: parsed.error.issues[0].message };
  const d = parsed.data;
  if (await prisma.usuario.findUnique({ where: { email: d.email } })) {
    return { erro: "Já existe uma conta com este e-mail. Use a opção Entrar." };
  }
  const u = await prisma.usuario.create({
    data: { nome: d.nome, email: d.email, telefone: d.telefone, cidade: d.cidade, senhaHash: await hashSenha(d.senha) },
  });
  await criarSessao(u.id);
  redirect("/intencoes/nova");
}
