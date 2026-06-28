import "server-only";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { randomBytes, createHmac } from "crypto";
import { prisma } from "./db";
import type { Perfil } from "./constants";

const COOKIE = "pp_sessao";
const DIAS_SESSAO = 7;

export type UsuarioSessao = {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  registro: string | null;
  setoresIds: string[];
};

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 12);
}

export async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

// Assina o token com HMAC para evitar adivinhação/forja do valor de cookie.
function assinar(token: string): string {
  const segredo = process.env.SESSION_SECRET ?? "dev-secret";
  const assinatura = createHmac("sha256", segredo).update(token).digest("hex");
  return `${token}.${assinatura}`;
}

function validarAssinatura(valor: string): string | null {
  const [token, assinatura] = valor.split(".");
  if (!token || !assinatura) return null;
  const segredo = process.env.SESSION_SECRET ?? "dev-secret";
  const esperado = createHmac("sha256", segredo).update(token).digest("hex");
  // Comparação simples; tamanhos iguais (hex de 64).
  if (assinatura.length !== esperado.length) return null;
  let diff = 0;
  for (let i = 0; i < esperado.length; i++) diff |= esperado.charCodeAt(i) ^ assinatura.charCodeAt(i);
  return diff === 0 ? token : null;
}

export async function criarSessao(usuarioId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiraEm = new Date(Date.now() + DIAS_SESSAO * 24 * 60 * 60 * 1000);
  await prisma.sessao.create({ data: { token, usuarioId, expiraEm } });
  cookies().set(COOKIE, assinar(token), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiraEm,
  });
}

export async function encerrarSessao(): Promise<void> {
  const bruto = cookies().get(COOKIE)?.value;
  if (bruto) {
    const token = validarAssinatura(bruto);
    if (token) await prisma.sessao.deleteMany({ where: { token } });
  }
  cookies().delete(COOKIE);
}

// Retorna o usuário autenticado (ou null). Usada em server components/rotas.
export async function getUsuarioAtual(): Promise<UsuarioSessao | null> {
  const bruto = cookies().get(COOKIE)?.value;
  if (!bruto) return null;
  const token = validarAssinatura(bruto);
  if (!token) return null;

  const sessao = await prisma.sessao.findUnique({
    where: { token },
    include: { usuario: { include: { setores: true } } },
  });
  if (!sessao || sessao.expiraEm < new Date() || !sessao.usuario.ativo) return null;

  const u = sessao.usuario;
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    perfil: u.perfil as Perfil,
    registro: u.registro,
    setoresIds: u.setores.map((s) => s.setorId),
  };
}

// Helper para rotas/páginas que exigem autenticação.
export async function exigirUsuario(): Promise<UsuarioSessao> {
  const u = await getUsuarioAtual();
  if (!u) throw new Error("NAO_AUTENTICADO");
  return u;
}

export function podeAdministrar(perfil: Perfil): boolean {
  return perfil === "admin";
}

export function podeVerGestao(perfil: Perfil): boolean {
  return perfil === "admin" || perfil === "coordenador";
}
