import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";

// Diagnóstico do banco de dados para a tela de login: quando o ambiente não
// foi preparado, quem está testando precisa ver O QUE fazer, não um "Falha ao
// entrar." genérico.

export type ProblemaBanco = "sem_configuracao" | "sem_tabelas" | "sem_usuarios" | "indisponivel";

export type EstadoBanco = { ok: true } | { ok: false; problema: ProblemaBanco };

export function classificarErroBanco(e: unknown): ProblemaBanco {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    // P2021: tabela inexistente · P2022: coluna inexistente (banco desatualizado)
    if (e.code === "P2021" || e.code === "P2022") return "sem_tabelas";
  }
  if (e instanceof Prisma.PrismaClientInitializationError) {
    if (/DATABASE_URL/.test(e.message)) return "sem_configuracao";
  }
  return "indisponivel";
}

export async function verificarBanco(): Promise<EstadoBanco> {
  if (!process.env.DATABASE_URL) return { ok: false, problema: "sem_configuracao" };
  try {
    const usuarios = await prisma.usuario.count();
    return usuarios > 0 ? { ok: true } : { ok: false, problema: "sem_usuarios" };
  } catch (e) {
    console.error("[diagnostico] Banco de dados indisponível:", e);
    return { ok: false, problema: classificarErroBanco(e) };
  }
}

const MENSAGEM_DESENVOLVIMENTO: Record<ProblemaBanco, string> = {
  sem_configuracao:
    "Falta o arquivo .env com a DATABASE_URL. No terminal, na pasta do projeto, rode `npm run setup` e depois `npm run dev`.",
  sem_tabelas:
    "O banco de dados ainda não foi criado ou está desatualizado em relação ao código. Pare o servidor (Ctrl+C), rode `npm run setup` e depois `npm run dev`.",
  sem_usuarios:
    "O banco existe, mas está vazio. Pare o servidor (Ctrl+C), rode `npm run setup` para carregar os usuários de demonstração e depois `npm run dev`.",
  indisponivel:
    "Não foi possível conectar ao banco de dados. Confira a DATABASE_URL no arquivo .env e veja o erro completo no terminal onde o app está rodando.",
};

// Em produção não expomos detalhes de configuração a quem ainda não fez login;
// o detalhe completo fica no log do servidor.
export function mensagemProblemaBanco(problema: ProblemaBanco): string {
  if (process.env.NODE_ENV === "production") {
    return "O sistema está temporariamente indisponível. Avise o responsável técnico.";
  }
  return MENSAGEM_DESENVOLVIMENTO[problema];
}
