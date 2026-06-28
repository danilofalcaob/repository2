import { GRAVIDADE_LABEL, PREOCUPACAO_LABEL, type Gravidade, type Preocupacao } from "./constants";

// Descreve, em pt-BR, o que mudou entre dois estados I-PASS (gravidade/preocupação).
// Usado para o resumo "o que mudou desde a última passagem".
export function descreverMudanca(
  anterior: { gravidade: string; nivelPreocupacao: string } | null,
  atual: { gravidade: string; nivelPreocupacao: string },
): string {
  if (!anterior) return "Primeira passagem deste paciente.";
  const partes: string[] = [];
  if (anterior.gravidade !== atual.gravidade) {
    partes.push(
      `gravidade ${GRAVIDADE_LABEL[anterior.gravidade as Gravidade]} → ${GRAVIDADE_LABEL[atual.gravidade as Gravidade]}`,
    );
  }
  if (anterior.nivelPreocupacao !== atual.nivelPreocupacao) {
    partes.push(
      `preocupação ${PREOCUPACAO_LABEL[anterior.nivelPreocupacao as Preocupacao]} → ${PREOCUPACAO_LABEL[atual.nivelPreocupacao as Preocupacao]}`,
    );
  }
  return partes.length ? partes.join("; ") : "Sem mudanças de gravidade/preocupação.";
}
