"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { exigirUsuario, hashSenha } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";

async function exigirAdmin() {
  const u = await exigirUsuario();
  if (u.perfil !== "admin") throw new Error("Apenas administradores.");
  return u;
}

export async function criarSetor(fd: FormData) {
  const u = await exigirAdmin();
  const nome = String(fd.get("nome") ?? "").trim();
  if (!nome) throw new Error("Nome obrigatório.");
  const s = await prisma.setor.create({
    data: {
      nome,
      tipo: String(fd.get("tipo") ?? "PS"),
      instituicao: String(fd.get("instituicao") ?? "").trim() || "Instituição Demonstração",
    },
  });
  // Admin passa a ter acesso ao setor criado.
  await prisma.usuarioSetor.create({ data: { usuarioId: u.id, setorId: s.id } });
  await registrarAuditoria({ usuarioId: u.id, acao: "setor.criar", entidade: "Setor", entidadeId: s.id, valorNovo: { nome } });
  revalidatePath("/admin");
}

export async function criarTurno(fd: FormData) {
  const u = await exigirAdmin();
  const setorId = String(fd.get("setorId") ?? "");
  const inicio = String(fd.get("inicio") ?? "");
  if (!setorId || !inicio) throw new Error("Setor e início são obrigatórios.");
  const fim = String(fd.get("fim") ?? "");
  const t = await prisma.turno.create({
    data: {
      setorId,
      tipo: String(fd.get("tipo") ?? "diurno"),
      rotulo: String(fd.get("rotulo") ?? "").trim() || null,
      inicio: new Date(inicio),
      fim: fim ? new Date(fim) : null,
      responsavelId: String(fd.get("responsavelId") ?? "") || null,
    },
  });
  await registrarAuditoria({ usuarioId: u.id, acao: "turno.criar", entidade: "Turno", entidadeId: t.id });
  revalidatePath("/admin");
}

export async function criarUsuario(fd: FormData) {
  const u = await exigirAdmin();
  const nome = String(fd.get("nome") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const senha = String(fd.get("senha") ?? "");
  if (!nome || !email || senha.length < 6) {
    throw new Error("Nome, e-mail e senha (mín. 6) são obrigatórios.");
  }
  const existe = await prisma.usuario.findUnique({ where: { email } });
  if (existe) throw new Error("Já existe usuário com este e-mail.");

  const setoresIds = fd.getAll("setores").map(String).filter(Boolean);
  const novo = await prisma.usuario.create({
    data: {
      nome,
      email,
      senhaHash: await hashSenha(senha),
      registro: String(fd.get("registro") ?? "").trim() || null,
      perfil: String(fd.get("perfil") ?? "plantonista"),
      setores: { create: setoresIds.map((setorId) => ({ setorId })) },
    },
  });
  await registrarAuditoria({
    usuarioId: u.id,
    acao: "usuario.criar",
    entidade: "Usuario",
    entidadeId: novo.id,
    valorNovo: { nome, email, perfil: novo.perfil },
  });
  revalidatePath("/admin");
}

export async function alternarUsuarioAtivo(usuarioId: string, ativo: boolean) {
  const u = await exigirAdmin();
  await prisma.usuario.update({ where: { id: usuarioId }, data: { ativo } });
  await registrarAuditoria({
    usuarioId: u.id,
    acao: "usuario.ativo",
    entidade: "Usuario",
    entidadeId: usuarioId,
    valorNovo: { ativo },
  });
  revalidatePath("/admin");
}
