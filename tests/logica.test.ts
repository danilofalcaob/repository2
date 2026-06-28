import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { descreverMudanca } from "@/lib/diff";
import { formatarDuracao, estaVencida } from "@/lib/format";
import { GRAVIDADE_ORDEM, PREOCUPACAO_ORDEM } from "@/lib/constants";

describe("descreverMudanca (o que mudou desde a última passagem)", () => {
  it("indica primeira passagem quando não há anterior", () => {
    expect(descreverMudanca(null, { gravidade: "estavel", nivelPreocupacao: "baixo" })).toMatch(
      /primeira passagem/i,
    );
  });

  it("descreve mudança de gravidade e preocupação", () => {
    const txt = descreverMudanca(
      { gravidade: "estavel", nivelPreocupacao: "baixo" },
      { gravidade: "instavel", nivelPreocupacao: "alto" },
    );
    expect(txt).toMatch(/gravidade/i);
    expect(txt).toMatch(/preocupação/i);
  });

  it("reporta ausência de mudança", () => {
    const txt = descreverMudanca(
      { gravidade: "cuidado", nivelPreocupacao: "medio" },
      { gravidade: "cuidado", nivelPreocupacao: "medio" },
    );
    expect(txt).toMatch(/sem mudanças/i);
  });
});

describe("ordenação por prioridade clínica", () => {
  it("instável > cuidado > estável", () => {
    expect(GRAVIDADE_ORDEM.instavel).toBeGreaterThan(GRAVIDADE_ORDEM.cuidado);
    expect(GRAVIDADE_ORDEM.cuidado).toBeGreaterThan(GRAVIDADE_ORDEM.estavel);
  });
  it("preocupação alta > média > baixa", () => {
    expect(PREOCUPACAO_ORDEM.alto).toBeGreaterThan(PREOCUPACAO_ORDEM.medio);
    expect(PREOCUPACAO_ORDEM.medio).toBeGreaterThan(PREOCUPACAO_ORDEM.baixo);
  });
});

describe("formatação", () => {
  it("formata duração em min/seg", () => {
    expect(formatarDuracao(90)).toBe("1min 30s");
    expect(formatarDuracao(null)).toBe("—");
  });
  it("detecta prazo vencido", () => {
    expect(estaVencida(new Date(Date.now() - 1000))).toBe(true);
    expect(estaVencida(new Date(Date.now() + 60000))).toBe(false);
    expect(estaVencida(null)).toBe(false);
  });
});

describe("segurança de senha (hash forte + verificação)", () => {
  it("faz hash e valida corretamente, rejeitando senha errada", async () => {
    const hash = await bcrypt.hash("demo123", 12);
    expect(hash).not.toBe("demo123");
    expect(await bcrypt.compare("demo123", hash)).toBe(true);
    expect(await bcrypt.compare("errada", hash)).toBe(false);
  });
});
