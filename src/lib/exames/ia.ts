import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import { ANALITOS } from "./catalogo";
import { mapearExtracaoIA, type ExtracaoIA } from "./ia-mapa";

// Extração por IA (Claude): lê o PDF ou o printscreen do laudo e devolve os
// exames estruturados. Opcional — só é usada quando ANTHROPIC_API_KEY está
// configurada. O arquivo é enviado à API da Anthropic: use apenas com
// respaldo institucional/LGPD (ver README).

export function iaDisponivel(): boolean {
  if (process.env.EXAMES_IA === "desligada") return false;
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

const MODELO = process.env.EXAMES_IA_MODELO || "claude-opus-5-5";

const ExameSchema = z.object({
  codigo: z.string().describe("Código do catálogo ou 'outro'"),
  nome_no_laudo: z.string(),
  valor: z.number().nullable().describe("Valor numérico (ponto como separador decimal); null se qualitativo"),
  valor_texto: z.string().describe("Valor exatamente como impresso no laudo, ex.: '6.520', '0,62', '<0,5', 'Negativo'"),
  comparador: z.string().nullable().describe("'<', '>', '<=' ou '>=' quando o valor vem com sinal; senão null"),
  unidade: z.string().nullable(),
  ref_min: z.number().nullable(),
  ref_max: z.number().nullable(),
  ref_texto: z.string().nullable(),
  alterado_no_laudo: z.boolean().nullable().describe("true se o laudo marca o resultado como alterado"),
  observacao: z.string().nullable().describe("Ex.: 'colhido às 11:15', 'venosa', '50,3%'"),
  data_coleta: z.string().nullable().describe("AAAA-MM-DD, quando este exame tem data própria"),
  hora_coleta: z.string().nullable().describe("HH:MM, quando informada"),
});

const ExtracaoSchema = z.object({
  data_coleta: z.string().nullable().describe("AAAA-MM-DD da coleta principal"),
  hora_coleta: z.string().nullable().describe("HH:MM da coleta principal"),
  exames: z.array(ExameSchema),
  avisos: z.array(z.string()).describe("Problemas de leitura (trechos ilegíveis, data ausente etc.), em português"),
});

const CATALOGO_TEXTO = ANALITOS.map((a) => `- ${a.codigo}: ${a.nome} (${a.rotulo}; ${a.unidade || "sem unidade"})`).join("\n");

const SISTEMA = `Você transcreve laudos de exames laboratoriais de pacientes de UTI (laboratórios brasileiros) para dados estruturados.

Regras:
- Transcreva SOMENTE o que está escrito no laudo. Nunca invente, estime ou calcule valores (exceto converter o número para o campo "valor").
- Para cada resultado, informe o "codigo" do catálogo abaixo que corresponde ao exame; use "outro" quando não houver correspondência.
- "valor_texto" é o número exatamente como impresso (ex.: "6.520", "0,62", "323.000"). "valor" é o mesmo número em notação decimal com ponto (6520, 0.62, 323000). No padrão brasileiro, o ponto separa milhar e a vírgula separa decimal.
- No leucograma, informe o valor ABSOLUTO (/mm³ ou /µL) de cada célula. Se o laudo só tiver o percentual, informe o percentual com unidade "%".
- Unidade exatamente como no laudo (ex.: "mEq/L", "/mm³", "milhões/mm³", "mil/mm³", "mg/dL").
- Referência: "ref_min"/"ref_max" numéricos quando houver (use a faixa do sexo do paciente quando o laudo separar por sexo; "inferior a 5" → ref_max 5); "ref_texto" com o texto original.
- Gasometria: informe pH, pCO2, pO2, HCO3, BE, SatO2 e lactato. Em gasometria VENOSA, use observacao "venosa" e não informe pO2; a saturação venosa usa o código svo2.
- Relatórios cumulativos (várias datas em colunas): crie um item por exame e por data, preenchendo data_coleta/hora_coleta de cada um.
- Ignore urina (EAS/urina tipo 1/urocultura), outros líquidos corporais, dados do paciente e textos administrativos.
- Resultados qualitativos de sangue (ex.: hemocultura, sorologias) podem entrar como "outro", com valor null e valor_texto.
- Observações relevantes do próprio exame (ex.: "colhido às 11:15") vão em "observacao".
- Datas no formato AAAA-MM-DD e horas HH:MM. Use a data da COLETA (não a de nascimento, emissão ou liberação).

Catálogo (código: nome (rótulo; unidade)):
${CATALOGO_TEXTO}`;

export async function extrairComIA(params: {
  bytes: Uint8Array;
  tipoMime: string;
  sexo?: string | null;
  dataPadraoISO: string;
}): Promise<ExtracaoIA> {
  const client = new Anthropic();
  const base64 = Buffer.from(params.bytes).toString("base64");
  const arquivo: Anthropic.Beta.BetaContentBlockParam =
    params.tipoMime === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: params.tipoMime as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
            data: base64,
          },
        };

  const sexo = params.sexo === "F" ? "feminino" : params.sexo === "M" ? "masculino" : "não informado";
  const stream = client.beta.messages.stream({
    model: MODELO,
    max_tokens: 64000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(ExtracaoSchema) },
    system: [{ type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [arquivo, { type: "text", text: `Sexo do paciente: ${sexo}. Transcreva os exames deste laudo.` }],
      },
    ],
  });
  const msg = await stream.finalMessage();

  if (msg.stop_reason === "refusal") throw new Error("A IA recusou a leitura deste arquivo. Use a leitura local ou digite os valores.");
  if (msg.stop_reason === "max_tokens") throw new Error("Laudo extenso demais para uma leitura. Divida o arquivo em partes.");
  const texto = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const dados = ExtracaoSchema.parse(JSON.parse(texto));
  return mapearExtracaoIA(dados, params.sexo, params.dataPadraoISO);
}
