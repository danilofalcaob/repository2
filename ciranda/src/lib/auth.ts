import "server-only";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { randomBytes, createHmac, timingSafeEqual } from "crypto";
import { prisma } from "./db";
import type { Perfil } from "./constants";

const COOKIE = "ciranda_sessao";
const DIAS_SESSAO = 7;

export type UsuarioSessao = {
  id: string;
  nome: string;
  email: string;
  cidade: string;
  perfil: Perfil;
  lojaId: string | null;
};

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 12);
}

export async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

// O cookie leva o token assinado com HMAC, para não ser adivinhado nem forjado.
function assinatura(token: string): string {
  return createHmac("sha256", process.env.SESSION_SECRET ?? "dev-secret").update(token).digest("hex");
}

function validarAssinatura(valor: string): string | null {
  const [token, recebida] = valor.split(".");
  if (!token || !recebida) return null;
  const esperada = assinatura(token);
  if (recebida.length !== esperada.length) return null;
  return timingSafeEqual(Buffer.from(recebida), Buffer.from(esperada)) ? token : null;
}

export async function criarSessao(usuarioId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiraEm = new Date(Date.now() + DIAS_SESSAO * 24 * 60 * 60 * 1000);
  await prisma.sessao.create({ data: { token, usuarioId, expiraEm } });
  cookies().set(COOKIE, `${token}.${assinatura(token)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiraEm,
  });
}

export async function encerrarSessao(): Promise<void> {
  const bruto = cookies().get(COOKIE)?.value;
  const token = bruto ? validarAssinatura(bruto) : null;
  if (token) await prisma.sessao.deleteMany({ where: { token } });
  cookies().delete(COOKIE);
}

export async function getUsuarioAtual(): Promise<UsuarioSessao | null> {
  const bruto = cookies().get(COOKIE)?.value;
  const token = bruto ? validarAssinatura(bruto) : null;
  if (!token) return null;
  const sessao = await prisma.sessao.findUnique({ where: { token }, include: { usuario: true } });
  if (!sessao || sessao.expiraEm < new Date() || !sessao.usuario.ativo) return null;
  const u = sessao.usuario;
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    cidade: u.cidade,
    perfil: u.perfil as Perfil,
    lojaId: u.lojaId,
  };
}

export async function exigirUsuario(perfis?: Perfil[]): Promise<UsuarioSessao> {
  const u = await getUsuarioAtual();
  if (!u) throw new Error("Sessão expirada. Entre novamente.");
  if (perfis && !perfis.includes(u.perfil)) throw new Error("Você não tem permissão para esta ação.");
  return u;
}

export function paginaInicial(perfil: Perfil): string {
  return perfil === "admin" ? "/admin" : perfil === "loja" ? "/loja" : "/painel";
}
