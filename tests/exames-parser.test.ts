import { describe, it, expect } from "vitest";
import { extrairDeTexto, identificarAnalito, detectarDataColeta, chaveDia } from "@/lib/exames/parser";
import { parseNumeroBR, formatarNumeroBR } from "@/lib/exames/valores";

const LINHA_EXEMPLO =
  "Lab 01/06/2026 - Eritrócitos **5,19 milhões/mm (aumentado)** / Hb 14,1 g/dL / Ht 44,0% / HCM **27,2 pg (diminuído)** / VCM 84,8 fL / CHCM 32,0 g/dL / RDW 13,3% / Leucócitos 6.520/mm / Neutrófilos 3.280/mm / Eosinófilos 60/mm / Basófilos 30/mm / Linfócitos 2.670/mm / Monócitos 480/mm / Plaquetas 323.000/mm / VPM 9,7 fL / Na 142 mEq/L / K 4,5 mEq/L / Ca 9,1 mg/dL / Mg 2,3 mg/dL / Ureia 38 mg/dL / Cr 0,62 mg/dL / TFG CKD-EPI 2021 111 mL/min/1,73m / Colesterol total 175 mg/dL / HDL 47 mg/dL / LDL 109 mg/dL / Não-HDL 128 mg/dL / VLDL 19 mg/dL / TG 93 mg/dL / TGO 11 U/L / TGP 10 U/L / BT 0,29 mg/dL / BD 0,09 mg/dL / BI 0,20 mg/dL / LH 8,3 UI/L / FSH 8,7 UI/L / Cortisol 13,5 mcg/dL (colhido às 11:15) / Estradiol 4,9 ng/dL / Prolactina 19 mcg/L / SHBG 90 nmol/L / 25-OH vitamina D 43 ng/mL / Ácido fólico **2,7 ng/mL (diminuído)** / Vitamina B12 727 ng/L / Ferritina 83 mcg/L / Ferro 92 mcg/dL / CTLF 257 mcg/dL / Saturação de transferrina 36% / CK total 47 U/L / HbA1c 5,2% / Glicemia média estimada 103 mg/dL.";

const LAUDO_BLOCOS = `LABORATÓRIO DEMONSTRAÇÃO
Paciente: PACIENTE FICTÍCIO     Data de nascimento: 12/03/1960
Data da coleta: 03/06/2026 07:30

HEMOGRAMA COMPLETO
ERITROGRAMA
Eritrócitos.......: 3,10 milhões/mm³     4,30 a 5,70 milhões/mm³
Hemoglobina.......: 8,9 g/dL             13,5 a 17,5 g/dL
Hematócrito.......: 27,5 %               39,0 a 50,0 %
LEUCOGRAMA
Leucócitos........: 18.900 /mm³          3.500 a 10.500 /mm³
Neutrófilos.......: 85,0 %  16.065 /mm³  45,5 a 70,0 %  1.700 a 7.000 /mm³
Linfócitos........: 8,0 %   1.512 /mm³   20,0 a 45,0 %  1.000 a 4.800 /mm³
Plaquetas.........: 98.000 /mm³          150.000 a 450.000 /mm³

POTÁSSIO
Resultado: 6,1 mEq/L
Valor de referência: 3,5 a 5,1 mEq/L

CREATININA ........ 2,10 mg/dL   Mulheres: 0,50 a 1,10  Homens: 0,70 a 1,30

25-HIDROXIVITAMINA D (25-OH) .... 18 ng/mL   Suficiência: 20 a 100 ng/mL

URINA TIPO I
Leucócitos: 25.000 /mL
Hemácias: 3.000 /mL

PROTEÍNA C REATIVA
Resultado: 182,4 mg/L        Inferior a 5,0 mg/L

GASOMETRIA ARTERIAL
pH ............ 7,21     7,35 a 7,45
pCO2 .......... 30 mmHg  35 a 45 mmHg
HCO3 .......... 12,0 mEq/L   22 a 26 mEq/L
BE ............ -14,5 mEq/L  -3,0 a +3,0
Lactato ....... 4,8 mmol/L   0,5 a 2,0 mmol/L
`;

describe("números pt-BR", () => {
  it("interpreta milhar e decimal", () => {
    expect(parseNumeroBR("6.520")).toEqual({ valor: 6520, casas: 0 });
    expect(parseNumeroBR("323.000")).toEqual({ valor: 323000, casas: 0 });
    expect(parseNumeroBR("0,62")).toEqual({ valor: 0.62, casas: 2 });
    expect(parseNumeroBR("44,0")).toEqual({ valor: 44, casas: 1 });
    expect(parseNumeroBR("4.5")).toEqual({ valor: 4.5, casas: 1 });
    expect(parseNumeroBR("1.234,5")).toEqual({ valor: 1234.5, casas: 1 });
    expect(parseNumeroBR("-14,5")).toEqual({ valor: -14.5, casas: 1 });
    expect(parseNumeroBR("abc")).toBeNull();
  });
  it("formata no padrão brasileiro", () => {
    expect(formatarNumeroBR(6520, 0)).toBe("6.520");
    expect(formatarNumeroBR(0.62, 2)).toBe("0,62");
    expect(formatarNumeroBR(323000, 0)).toBe("323.000");
  });
});

describe("reconhecimento de nomes", () => {
  it.each([
    ["Potássio sérico", "k"],
    ["K", "k"],
    ["TGO/AST", "tgo"],
    ["Colesterol não-HDL", "nao_hdl"],
    ["Colesterol HDL", "hdl"],
    ["Hemoglobina glicada", "hba1c"],
    ["Hemoglobina", "hb"],
    ["Cálcio iônico", "cai"],
    ["CK-MB", "ckmb"],
    ["Bilirrubina direta", "bd"],
    ["Saturação de transferrina", "sat_transferrina"],
    ["Proteína C reativa", "pcr"],
    ["Troponina I ultrassensível", "troponina"],
  ])("%s → %s", (nome, codigo) => {
    expect(identificarAnalito(nome)).toBe(codigo);
  });
});

describe("leitura do formato 'linha de exames'", () => {
  const r = extrairDeTexto(LINHA_EXEMPLO, { sexo: "F" });
  const por = (c: string) => r.resultados.find((x) => x.analito === c);

  it("reconhece todos os itens do exemplo", () => {
    expect(r.resultados.length).toBe(49);
  });
  it("usa a data do prefixo Lab", () => {
    expect(chaveDia(por("hb")!.coletadoEm)).toBe("2026-06-01");
  });
  it("lê valores, casas decimais e unidades", () => {
    expect(por("eritrocitos")).toMatchObject({ valor: 5.19, casas: 2 });
    expect(por("leucocitos")).toMatchObject({ valor: 6520 });
    expect(por("plaquetas")).toMatchObject({ valor: 323000 });
    expect(por("tfg")).toMatchObject({ valor: 111 });
    expect(por("vitd")).toMatchObject({ valor: 43 });
    expect(por("ht")).toMatchObject({ valor: 44, casas: 1, unidade: "%" });
    expect(por("cr")).toMatchObject({ valor: 0.62, unidade: "mg/dL" });
  });
});

describe("leitura de laudo em blocos", () => {
  const r = extrairDeTexto(LAUDO_BLOCOS, { sexo: "M" });
  const por = (c: string) => r.resultados.find((x) => x.analito === c);

  it("detecta a data da coleta (não a de nascimento)", () => {
    const d = detectarDataColeta(LAUDO_BLOCOS)!;
    expect(d.confiavel).toBe(true);
    expect(chaveDia(d.iso)).toBe("2026-06-03");
  });
  it("lê valor absoluto do leucograma e a referência correspondente", () => {
    expect(por("neutrofilos")).toMatchObject({ valor: 16065, refMin: 1700, refMax: 7000, flag: "alto" });
    expect(por("leucocitos")).toMatchObject({ valor: 18900, refMax: 10500, flag: "alto" });
  });
  it("lê formato Resultado/Referência em linhas separadas", () => {
    expect(por("k")).toMatchObject({ valor: 6.1, refMin: 3.5, refMax: 5.1, flag: "alto" });
    expect(por("pcr")).toMatchObject({ valor: 182.4, refMax: 5, flag: "alto" });
  });
  it("escolhe a referência do sexo do paciente", () => {
    expect(por("cr")).toMatchObject({ valor: 2.1, refMin: 0.7, refMax: 1.3, flag: "alto" });
  });
  it("não confunde '25-OH' com o resultado", () => {
    expect(por("vitd")).toMatchObject({ valor: 18, refMin: 20, flag: "baixo" });
  });
  it("ignora a urina", () => {
    expect(r.resultados.filter((x) => x.analito === "leucocitos")).toHaveLength(1);
  });
  it("lê gasometria, inclusive BE negativo", () => {
    expect(por("ph")).toMatchObject({ valor: 7.21, flag: "baixo" });
    expect(por("be")).toMatchObject({ valor: -14.5, refMin: -3, refMax: 3, flag: "baixo" });
    expect(por("lactato")).toMatchObject({ valor: 4.8, flag: "critico_alto" });
    expect(por("plaquetas")).toMatchObject({ valor: 98000, flag: "baixo" });
  });
});

describe("correção de vírgula perdida no OCR", () => {
  const texto = `Data da coleta: 22/11/2026
Hematócrito 278 % 39,0 a 50,0 %
Magnésio 21 mg/dL 1,6 a 2,6 mg/dL
Creatinina 268 mg/dL 0,70 a 1,30 mg/dL
Leucócitos 21.400 /mm³ 3.500 a 10.500 /mm³
Proteína C reativa 132,0 mg/L Inferior a 5,0`;
  it("corrige só quando o texto vem de OCR e avisa", () => {
    const sem = extrairDeTexto(texto, { sexo: "M" });
    expect(sem.resultados.find((r) => r.analito === "ht")!.valor).toBe(278);
    const r = extrairDeTexto(texto, { sexo: "M", ocr: true });
    const por = (c: string) => r.resultados.find((x) => x.analito === c)!;
    expect(por("ht")).toMatchObject({ valor: 27.8, valorTexto: "27,8", flag: "baixo" });
    expect(por("mg")).toMatchObject({ valor: 2.1, flag: "normal" });
    expect(por("cr")).toMatchObject({ valor: 2.68, casas: 2 });
    expect(por("leucocitos").valor).toBe(21400);
    expect(por("pcr").valor).toBe(132);
    expect(r.avisos.join(" ")).toContain("Ht 278 → 27,8");
  });
});

describe("marcações escritas no texto", () => {
  const r = extrairDeTexto(
    "Lab 01/06/2026 - HCM **27,2 pg (diminuído)** / Cortisol 13,5 mcg/dL (colhido às 11:15) / Cr 0,95 mg/dL.",
    { sexo: "F" },
  );
  const por = (c: string) => r.resultados.find((x) => x.analito === c)!;
  it("respeita (diminuído) quando não há referência", () => {
    expect(por("hcm")).toMatchObject({ valor: 27.2, flag: "baixo", refMin: null, refMax: null });
  });
  it("guarda a observação entre parênteses", () => {
    expect(por("cortisol").observacao).toBe("colhido às 11:15");
  });
  it("não leva o ponto final para a unidade", () => {
    expect(por("cr").unidade).toBe("mg/dL");
  });
});
