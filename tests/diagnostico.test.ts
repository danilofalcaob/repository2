import { describe, it, expect, vi, afterEach } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("server-only", () => ({}));

const { classificarErroBanco, mensagemProblemaBanco } = await import("@/lib/diagnostico");

describe("diagnóstico do banco na tela de login", () => {
  const ambienteOriginal = process.env.NODE_ENV;
  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = ambienteOriginal;
  });

  it("reconhece tabela ou coluna inexistente (banco não criado ou desatualizado)", () => {
    for (const code of ["P2021", "P2022"]) {
      const e = new Prisma.PrismaClientKnownRequestError("tabela ausente", {
        code,
        clientVersion: "5.22.0",
      });
      expect(classificarErroBanco(e)).toBe("sem_tabelas");
    }
  });

  it("reconhece a falta da DATABASE_URL", () => {
    const e = new Prisma.PrismaClientInitializationError(
      "error: Environment variable not found: DATABASE_URL.",
      "5.22.0",
    );
    expect(classificarErroBanco(e)).toBe("sem_configuracao");
  });

  it("trata qualquer outro erro como banco indisponível", () => {
    expect(classificarErroBanco(new Error("conexão recusada"))).toBe("indisponivel");
  });

  it("indica o comando a rodar em desenvolvimento", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    expect(mensagemProblemaBanco("sem_tabelas")).toMatch(/npm run setup/);
  });

  it("não expõe detalhes de configuração em produção", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    const msg = mensagemProblemaBanco("sem_configuracao");
    expect(msg).not.toMatch(/DATABASE_URL|\.env|npm/);
    expect(msg).toMatch(/indisponível/);
  });
});
