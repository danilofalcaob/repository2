import { describe, it, expect } from "vitest";
import { mapearExtracaoIA, type ExameIA } from "@/lib/exames/ia-mapa";
import { chaveDia } from "@/lib/exames/parser";

const base: Omit<ExameIA, "codigo" | "nome_no_laudo" | "valor" | "valor_texto"> = {
  comparador: null,
  unidade: null,
  ref_min: null,
  ref_max: null,
  ref_texto: null,
  alterado_no_laudo: null,
  observacao: null,
  data_coleta: null,
  hora_coleta: null,
};

describe("mapeamento da resposta da IA", () => {
  const r = mapearExtracaoIA(
    {
      data_coleta: "2026-06-01",
      hora_coleta: "07:30",
      avisos: [],
      exames: [
        { ...base, codigo: "k", nome_no_laudo: "Potássio", valor: 6.1, valor_texto: "6,1", unidade: "mEq/L", ref_min: 3.5, ref_max: 5.1 },
        { ...base, codigo: "inexistente", nome_no_laudo: "Creatinina sérica", valor: 0.62, valor_texto: "0,62", unidade: "mg/dL" },
        { ...base, codigo: "pcr", nome_no_laudo: "PCR", valor: 0.5, valor_texto: "<0,5", comparador: "<", unidade: "mg/dL" },
        { ...base, codigo: "outro", nome_no_laudo: "Hemocultura", valor: null, valor_texto: "Positiva (S. aureus)", alterado_no_laudo: true },
        { ...base, codigo: "k", nome_no_laudo: "Potássio", valor: 4.2, valor_texto: "4,2", unidade: "mEq/L", data_coleta: "2026-06-02", hora_coleta: "06:00" },
        { ...base, codigo: "k", nome_no_laudo: "Potássio (repetido)", valor: 6.1, valor_texto: "6,1", unidade: "mEq/L" },
      ],
    },
    "F",
    "2026-06-05T12:00:00.000Z",
  );
  const lista = r.resultados;

  it("usa o código do catálogo e reconhece pelo nome quando o código é inválido", () => {
    expect(lista[0]).toMatchObject({ analito: "k", flag: "alto", casas: 1 });
    expect(lista[1]).toMatchObject({ analito: "cr", casas: 2, refMax: 1.1, flag: "normal" });
  });
  it("mantém o comparador e o texto original", () => {
    expect(lista[2]).toMatchObject({ analito: "pcr", valorTexto: "<0,5", comparador: "<" });
  });
  it("aceita resultado qualitativo alterado", () => {
    expect(lista[3]).toMatchObject({ analito: "outro", valor: null, flag: "alterado" });
  });
  it("respeita a data por exame (relatório cumulativo) e remove duplicados", () => {
    expect(chaveDia(lista[4].coletadoEm)).toBe("2026-06-02");
    expect(lista).toHaveLength(5);
    expect(chaveDia(lista[0].coletadoEm)).toBe("2026-06-01");
  });
});
