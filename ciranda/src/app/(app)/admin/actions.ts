"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { exigirUsuario, hashSenha } from "@/lib/auth";
import { rodarCasamento } from "@/lib/motor";

export async function rodarCasamentoAgora() {
  await exigirUsuario(["admin"]);
  const r = await rodarCasamento();
  revalidatePath("/admin");
  redirect(`/admin?formadas=${r.formadas.length}&fila=${r.naoAtendidos}&candidatos=${r.estatisticas.ciclosCandidatos}`);
}

const schemaLoja = z.object({
  nome: z.string().trim().min(2, "Informe o nome da loja."),
  cnpj: z.string().trim().optional(),
  cidade: z.string().trim().min(2, "Informe a cidade."),
  telefone: z.string().trim().optional(),
  endereco: z.string().trim().optional(),
  taxa: z.coerce.number().min(0, "Taxa inválida.").max(20, "Taxa acima de 20%? Confira."),
  responsavel: z.string().trim().min(3, "Informe o responsável."),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  senha: z.string().min(6, "Senha com pelo menos 6 caracteres."),
});

export type EstadoLoja = { erro?: string; ok?: string };

export async function criarLoja(_: EstadoLoja, fd: FormData): Promise<EstadoLoja> {
  await exigirUsuario(["admin"]);
  const p = schemaLoja.safeParse(Object.fromEntries(fd));
  if (!p.success) return { erro: p.error.issues[0].message };
  const d = p.data;
  if (await prisma.usuario.findUnique({ where: { email: d.email } })) return { erro: "Já existe um usuário com este e-mail." };
  await prisma.loja.create({
    data: {
      nome: d.nome,
      cnpj: d.cnpj || null,
      cidade: d.cidade,
      telefone: d.telefone || null,
      endereco: d.endereco || null,
      taxaServico: d.taxa / 100,
      usuarios: {
        create: { nome: d.responsavel, email: d.email, senhaHash: await hashSenha(d.senha), perfil: "loja", cidade: d.cidade, telefone: d.telefone || null },
      },
    },
  });
  revalidatePath("/admin/lojas");
  return { ok: `${d.nome} cadastrada. O acesso é ${d.email}.` };
}

export async function alternarLoja(lojaId: string) {
  await exigirUsuario(["admin"]);
  const l = await prisma.loja.findUnique({ where: { id: lojaId } });
  if (!l) throw new Error("Loja não encontrada.");
  await prisma.loja.update({ where: { id: lojaId }, data: { ativa: !l.ativa } });
  revalidatePath("/admin/lojas");
}

// A taxa nova vale para as próximas cirandas; as já assumidas mantêm a taxa congelada.
export async function ajustarTaxaLoja(lojaId: string, fd: FormData) {
  await exigirUsuario(["admin"]);
  const taxa = z.coerce.number().min(0).max(20).safeParse(fd.get("taxa"));
  if (!taxa.success) throw new Error("Taxa inválida.");
  await prisma.loja.update({ where: { id: lojaId }, data: { taxaServico: taxa.data / 100 } });
  revalidatePath("/admin/lojas");
}
