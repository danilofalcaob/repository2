// Converte a resposta estruturada da IA em resultados do app (código do
// catálogo, data da coleta, casas decimais, referência e situação). Puro e
// testável sem chamar a API.

import { getAnalito } from "./catalogo";
import { dataLocalParaISO, identificarAnalito } from "./parser";
import { casasDe, completarResultado, parseNumeroBR, type Resultado } from "./valores";

export type ExameIA = {
  codigo: string;
  nome_no_laudo: string;
  valor: number | null;
  valor_texto: string;
  comparador: string | null;
  unidade: string | null;
  ref_min: number | null;
  ref_max: number | null;
  ref_texto: string | null;
  alterado_no_laudo: boolean | null;
  observacao: string | null;
  data_coleta: string | null;
  hora_coleta: string | null;
};

export type RespostaIA = {
  data_coleta: string | null;
  hora_coleta: string | null;
  exames: ExameIA[];
  avisos: string[];
};

export type ExtracaoIA = {
  resultados: Resultado[];
  dataColetaISO: string | null;
  avisos: string[];
};

function montarData(data: string | null | undefined, hora: string | null | undefined): string | null {
  const d = data?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!d) return null;
  const h = hora?.match(/^(\d{1,2}):(\d{2})/);
  return dataLocalParaISO(+d[1], +d[2], +d[3], h ? +h[1] : 6, h ? +h[2] : 0);
}

export function mapearExtracaoIA(dados: RespostaIA, sexo: string | null | undefined, dataPadraoISO: string): ExtracaoIA {
  const dataPrincipal = montarData(dados.data_coleta, dados.hora_coleta);
  const resultados: Resultado[] = [];
  const vistos = new Set<string>();
  for (const e of dados.exames) {
    const codigo = getAnalito(e.codigo) ? e.codigo : (identificarAnalito(e.nome_no_laudo) ?? "outro");
    const coletadoEm = montarData(e.data_coleta, e.hora_coleta) ?? dataPrincipal ?? dataPadraoISO;
    const chave = codigo === "outro" ? `outro|${e.nome_no_laudo}|${coletadoEm}` : `${codigo}|${coletadoEm}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const num = e.valor_texto ? parseNumeroBR(e.valor_texto.replace(/^[<>≤≥=]+/, "")) : null;
    resultados.push(
      completarResultado(
        {
          analito: codigo,
          nome: e.nome_no_laudo,
          valor: e.valor,
          valorTexto: e.valor_texto || (e.valor != null ? String(e.valor) : ""),
          casas: num?.casas ?? (e.valor != null ? casasDe(e.valor) : 0),
          comparador: e.comparador,
          unidade: e.unidade,
          refMin: e.ref_min,
          refMax: e.ref_max,
          refTexto: e.ref_texto,
          observacao: e.observacao,
          coletadoEm,
          qualitativoAlterado: e.valor == null && e.alterado_no_laudo === true,
        },
        sexo,
      ),
    );
  }
  const avisos = [...dados.avisos];
  if (!dataPrincipal && !dados.exames.some((e) => e.data_coleta)) {
    avisos.push("Data da coleta não encontrada no laudo — confira a data antes de confirmar.");
  }
  return { resultados, dataColetaISO: dataPrincipal, avisos };
}
