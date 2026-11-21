import { describe, it, expect } from "vitest";
import { extrairDeTexto, dataLocalParaISO } from "@/lib/exames/parser";
import { linhasDeExames, itemLinha } from "@/lib/exames/linha";
import { gerarEvolucao } from "@/lib/exames/evolucao";
import { pontosDeAtencao } from "@/lib/exames/atencao";
import { completarResultado, casasDe, type Resultado } from "@/lib/exames/valores";
import { getAnalito } from "@/lib/exames/catalogo";

// Cria um resultado com a referência padrão do catálogo (sexo masculino).
function r(codigo: string, valor: number, dia: number, hora = 6, extra: Partial<Resultado> = {}): Resultado {
  const a = getAnalito(codigo)!;
  return completarResultado(
    {
      analito: codigo,
      nome: a.rotulo,
      valor,
      valorTexto: String(valor),
      casas: casasDe(valor),
      unidade: a.unidade,
      refMin: null,
      refMax: null,
      coletadoEm: dataLocalParaISO(2026, 6, dia, hora),
      ...extra,
    },
    "M",
  );
}

const AGORA = new Date(dataLocalParaISO(2026, 6, 6, 12));

describe("exames em linha", () => {
  it("reproduz o formato do prontuário", () => {
    const texto =
      "Lab 01/06/2026 - Eritrócitos **5,19 milhões/mm³ (aumentado)** / Hb 14,1 g/dL / Ht 44,0% / HCM **27,2 pg (diminuído)** / Leucócitos 6.520/mm³ / Plaquetas 323.000/mm³ / Cortisol 13,5 mcg/dL (colhido às 11:15) / Ácido fólico **2,7 ng/mL (diminuído)**";
    const { resultados } = extrairDeTexto(texto, { sexo: "F" });
    // Referências do laudo de origem (HCM 27,5-33; eritrócitos até 5,03).
    const ajustados = resultados.map((x) =>
      x.analito === "hcm" ? completarResultado({ ...x, refMin: 27.5, refMax: 33 }, "F") : x,
    );
    const cortisol = ajustados.find((x) => x.analito === "cortisol")!;
    cortisol.observacao = "colhido às 11:15";
    const [linha] = linhasDeExames(ajustados);
    expect(linha.texto).toBe(
      "Lab 01/06/2026 - Eritrócitos **5,19 milhões/mm³ (aumentado)** / Hb 14,1 g/dL / Ht 44,0% / HCM **27,2 pg (diminuído)** / Leucócitos 6.520/mm³ / Plaquetas 323.000/mm³ / Cortisol 13,5 mcg/dL (colhido às 11:15) / Ácido fólico **2,7 ng/mL (diminuído)**.",
    );
    expect(linha.alterados).toBe(3);
  });

  it("oferece marcação sem asteriscos", () => {
    const k = r("k", 6.1, 1);
    expect(itemLinha(k, "maiusculas")).toBe("K 6,1 mEq/L (AUMENTADO)");
    expect(itemLinha(k, "nenhuma")).toBe("K 6,1 mEq/L (aumentado)");
  });

  it("separa coletas do mesmo dia pela hora e ordena da mais recente", () => {
    const linhas = linhasDeExames([r("k", 6.1, 2, 6), r("k", 5.2, 2, 18), r("k", 4.4, 1, 6)]);
    expect(linhas.map((l) => l.rotuloData)).toEqual(["02/06/2026 18:00", "02/06/2026 06:00", "01/06/2026"]);
  });
});

describe("resumo evolutivo", () => {
  it("hipercalemia com melhora e normalização nos últimos 2 dias", () => {
    const ev = gerarEvolucao(
      [r("k", 4.6, 1), r("k", 5.9, 2), r("k", 6.3, 3), r("k", 5.0, 4), r("k", 4.4, 5)],
      { agora: AGORA, janelaDias: 7 },
    );
    expect(ev.frases).toHaveLength(1);
    expect(ev.frases[0].tipo).toBe("normalizou");
    expect(ev.frases[0].textoSemValores).toBe(
      "Evoluiu com hipercalemia, com melhora e normalização nos últimos 2 dias.",
    );
    expect(ev.frases[0].texto).toContain("pico de K 6,3 mEq/L em 03/06");
  });

  it("leucocitose progressiva", () => {
    const ev = gerarEvolucao(
      [r("leucocitos", 9800, 2), r("leucocitos", 12300, 3), r("leucocitos", 15100, 4), r("leucocitos", 18900, 5)],
      { agora: AGORA, janelaDias: 7 },
    );
    expect(ev.texto).toBe("Evoluiu com leucocitose progressiva (Leucócitos 9.800 → 18.900/mm³).");
  });

  it("piora da função renal com estadiamento KDIGO", () => {
    const ev = gerarEvolucao([r("cr", 0.9, 2), r("cr", 1.4, 3), r("cr", 2.1, 5)], { agora: AGORA, janelaDias: 7 });
    expect(ev.texto).toBe(
      "Evoluiu com piora da função renal (Cr 0,9 → 2,1 mg/dL; KDIGO 2 pelo critério de creatinina).",
    );
  });

  it("combina frases e mantém estáveis no fim", () => {
    const ev = gerarEvolucao(
      [
        r("leucocitos", 9800, 3),
        r("leucocitos", 14500, 5),
        r("cr", 0.9, 3),
        r("cr", 1.8, 5),
        r("hb", 8.4, 3),
        r("hb", 8.1, 5),
        r("albumina", 2.6, 3),
        r("albumina", 2.5, 5),
      ],
      { agora: AGORA, janelaDias: 7, incluirValores: false },
    );
    expect(ev.texto).toBe(
      "Evoluiu com leucocitose e piora da função renal. Mantém, de forma estável, anemia e hipoalbuminemia.",
    );
  });

  it("PCR elevada em queda", () => {
    const ev = gerarEvolucao([r("pcr", 182, 2), r("pcr", 140, 3), r("pcr", 65, 5)], { agora: AGORA, janelaDias: 7 });
    expect(ev.frases[0].tipo).toBe("melhora");
    expect(ev.texto).toBe("Mantém elevação de PCR, porém em melhora (PCR 182 → 65 mg/L).");
  });

  it("classifica distúrbio ácido-base", () => {
    const ev = gerarEvolucao(
      [r("ph", 7.31, 4), r("hco3", 16, 4), r("pco2", 32, 4), r("ph", 7.22, 5), r("hco3", 12, 5), r("pco2", 30, 5)],
      { agora: AGORA, janelaDias: 7 },
    );
    expect(ev.texto).toBe("Evoluiu com acidose metabólica progressiva (pH 7,31 → 7,22).");
  });

  it("período sem exames", () => {
    const ev = gerarEvolucao([r("k", 6.1, 1)], { agora: AGORA, janelaDias: 1 });
    expect(ev.semExames).toBe(true);
    expect(ev.texto).toBe("Sem exames laboratoriais no período (último em 01/06/2026).");
  });

  it("sem alterações", () => {
    const ev = gerarEvolucao([r("k", 4.1, 4), r("na", 139, 4)], { agora: AGORA, janelaDias: 7 });
    expect(ev.texto).toBe("Sem alterações laboratoriais relevantes no período.");
  });
});

describe("pontos de atenção", () => {
  it("prioriza críticos e indica tendência", () => {
    const painel = pontosDeAtencao([
      r("k", 5.6, 4),
      r("k", 6.8, 5),
      r("hb", 8.0, 4),
      r("hb", 8.1, 5),
      r("na", 131, 5),
      r("lactato", 3.1, 4),
      r("lactato", 1.4, 5),
    ]);
    expect(painel.alterados.map((a) => [a.chave, a.tendencia, a.critico])).toEqual([
      ["k", "piorando", true],
      ["na", "novo", false],
      ["hb", "persistente", false],
    ]);
    expect(painel.normalizados.map((n) => n.chave)).toEqual(["lactato"]);
    expect(painel.criticos).toBe(1);
  });
});

describe("redação do resumo", () => {
  it("coloca o adjetivo antes do complemento", () => {
    const ev = gerarEvolucao([r("inr", 1.12, 2), r("inr", 1.38, 3), r("inr", 1.61, 5)], { agora: AGORA, janelaDias: 7 });
    expect(ev.texto).toBe("Evoluiu com alargamento progressivo do INR (INR 1,12 → 1,61).");
  });
  it("omite alterações discretas, salvo se pedido", () => {
    const dados = [r("cl", 104, 3), r("cl", 109, 4), r("cl", 106, 5)];
    expect(gerarEvolucao(dados, { agora: AGORA, janelaDias: 7 }).frases).toHaveLength(0);
    const com = gerarEvolucao(dados, { agora: AGORA, janelaDias: 7, incluirDiscretas: true });
    expect(com.frases[0].textoSemValores).toBe(
      "Evoluiu com hipercloremia, com melhora e normalização no último exame.",
    );
  });
  it("valor crítico nunca é tratado como discreto", () => {
    const ev = gerarEvolucao([r("k", 4.4, 4), r("k", 6.6, 5)], { agora: AGORA, janelaDias: 7 });
    expect(ev.texto).toContain("hipercalemia");
  });
});

describe("troca de direção", () => {
  it("hipercalemia corrigida que vira hipocalemia não é 'normalização'", () => {
    const ev = gerarEvolucao([r("k", 5.9, 3), r("k", 4.1, 4), r("k", 3.2, 5)], { agora: AGORA, janelaDias: 7, incluirValores: false });
    expect(ev.texto).toBe("Evoluiu com hipocalemia. Evoluiu com hipercalemia, já resolvida.");
  });
});
