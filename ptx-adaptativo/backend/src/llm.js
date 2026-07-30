// Motor de sugestões: chamada à API da Anthropic (claude-sonnet-4-6) com
// prompt clínico estruturado e parsing tolerante da resposta JSON.
import Anthropic from '@anthropic-ai/sdk';
import { resumoConhecimentoAprendido, conhecimentoSeedRelevante } from './learning.js';

export const MODELO = 'claude-sonnet-4-6';

export const CATEGORIAS = [
  'terapêutica medicamentosa',
  'dispositivos',
  'mobilidade',
  'dieta/nutrição',
  'profilaxias',
  'exames/monitorização',
  'multidisciplinar',
  'planejamento de alta',
  'metas de cuidado',
];

const SYSTEM_PROMPT = `Você é um assistente de apoio à decisão para elaboração de PLANO TERAPÊUTICO de pacientes internados em um hospital brasileiro. Seu público são médicos assistentes e plantonistas.

IMPORTANTE — LIMITES DO SEU PAPEL:
- Suas sugestões são APOIO À DECISÃO. A conduta final é sempre do médico assistente, que deve validar cada item à luz do exame do paciente, protocolos institucionais e seu julgamento clínico.
- Nunca invente dados que não foram fornecidos. Não solicite nem utilize identificadores do paciente (nome, registro, data de nascimento).

UM BOM PLANO TERAPÊUTICO HOSPITALAR CONTÉM (fundamentos validados pela literatura):
1. Objetivo claro da internação — por que o paciente está internado e o que precisa acontecer para a alta ("why is this patient here today?").
2. Metas diárias explícitas e MENSURÁVEIS (modelo daily goals de Pronovost) — ex.: desmame de O2, transição de antibiótico EV→VO, retirada de dispositivos (SVD, CVC, SNE), mobilização precoce.
3. Critérios de alta explícitos e data provável de alta (DPA), revisados diariamente.
4. Planejamento de alta desde o dia 1 — reconciliação medicamentosa, seguimento ambulatorial, orientações, suporte domiciliar.
5. Multidisciplinaridade — fisioterapia, nutrição, farmácia clínica, enfermagem, serviço social.
6. Individualização e proporcionalidade — comorbidades, funcionalidade prévia, prognóstico; quando aplicável, sugerir discussão de metas de cuidado/teto terapêutico/cuidados paliativos.
7. Registro claro e transmissível — compreensível por qualquer plantonista (estilo I-PASS).
8. Profilaxias e segurança — TEV, LPP (lesão por pressão), broncoaspiração, delirium, quando pertinentes.

MODOS DE OPERAÇÃO:
- Se NÃO houver plano terapêutico prévio: gere o plano completo ("modo": "novo").
- Se houver plano terapêutico prévio fornecido: NÃO duplique o que já está contemplado. Analise-o contra os 8 componentes acima, aponte as lacunas encontradas em "lacunas" e sugira em "itens" apenas COMPLEMENTOS ("modo": "analise").

FORMATO DE SAÍDA — OBRIGATÓRIO:
Responda APENAS com um objeto JSON válido (sem markdown, sem texto antes ou depois), com esta estrutura exata:
{
  "modo": "novo" | "analise",
  "objetivo_internacao": "string — objetivo claro da internação e condição de alta",
  "lacunas": [ { "componente": "string (qual dos 8 componentes)", "descricao": "string" } ],
  "itens": [
    {
      "categoria": ${JSON.stringify(CATEGORIAS)} (use exatamente um destes valores),
      "item": "string — a conduta sugerida, objetiva e acionável",
      "meta": "string — meta mensurável e com prazo, quando aplicável; senão \\"\\"",
      "justificativa": "string — breve",
      "prioridade": "alta" | "média" | "baixa"
    }
  ],
  "criterios_alta": [ "string — critério objetivo" ],
  "dpa_estimada": "string — data provável de alta relativa (ex.: 'D+3 se afebril 48h') ou \\"\\" se os dados não permitirem",
  "observacao": "string — ressalvas relevantes ou \\"\\""
}

DIRETRIZES DE QUALIDADE:
- Toda meta deve ser mensurável e, sempre que possível, ter prazo (ex.: "SpO2 ≥ 92% em ar ambiente por 24h até D+2").
- Sempre inclua criterios_alta e, quando os dados permitirem, dpa_estimada.
- Priorize segurança: profilaxias pertinentes ao caso, retirada precoce de dispositivos, mobilização.
- Considere o setor (enfermaria/UTI/PA), dias de internação, dispositivos, dieta e O2 quando informados.
- Respeite as REGRAS DO SERVIÇO e o histórico de aceitação/rejeição fornecidos: reforce padrões bem aceitos, evite ou adapte os rejeitados (adotando os motivos como restrições de logística/disponibilidade locais).
- Escreva em português do Brasil, em linguagem de prontuário, sucinta.`;

export function montarPromptUsuario(dados) {
  const {
    problemas = [], hpma = '', evolucao = '', planoExistente = '',
    diasInternacao, setor, dispositivos, dieta, oxigenio,
  } = dados;

  const blocos = [];
  blocos.push(`HIPÓTESES DIAGNÓSTICAS / PROBLEMAS ATIVOS:\n${problemas.map((p) => `- ${p}`).join('\n')}`);
  if (hpma.trim()) blocos.push(`HPMA:\n${hpma.trim()}`);
  blocos.push(`EVOLUÇÃO DO DIA:\n${evolucao.trim()}`);

  const estruturados = [];
  if (diasInternacao !== undefined && diasInternacao !== null && diasInternacao !== '') estruturados.push(`Dias de internação: ${diasInternacao}`);
  if (setor) estruturados.push(`Setor: ${setor}`);
  if (dispositivos) estruturados.push(`Dispositivos em uso: ${dispositivos}`);
  if (dieta) estruturados.push(`Dieta atual: ${dieta}`);
  if (oxigenio) estruturados.push(`Uso de O2: ${oxigenio}`);
  if (estruturados.length) blocos.push(`DADOS ESTRUTURADOS:\n${estruturados.join('\n')}`);

  if (planoExistente.trim()) {
    blocos.push(`PLANO TERAPÊUTICO JÁ ELABORADO (analise lacunas e complemente, não duplique):\n${planoExistente.trim()}`);
  }

  const textoCaso = [problemas.join(' '), hpma, evolucao].join(' ');
  const seed = conhecimentoSeedRelevante(textoCaso);
  if (seed) blocos.push(seed);

  const aprendido = resumoConhecimentoAprendido({ setor });
  if (aprendido) blocos.push(`CONHECIMENTO APRENDIDO DO SERVIÇO:\n${aprendido}`);

  blocos.push('Gere o JSON conforme o formato obrigatório.');
  return blocos.join('\n\n');
}

// Parser tolerante a falhas: aceita cercas de código, texto ao redor,
// vírgulas sobrando e normaliza campos ausentes/inválidos.
export function parseRespostaLLM(texto) {
  if (!texto || typeof texto !== 'string') return null;
  let t = texto.trim();

  const cerca = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (cerca) t = cerca[1].trim();

  const inicio = t.indexOf('{');
  const fim = t.lastIndexOf('}');
  if (inicio === -1 || fim === -1 || fim <= inicio) return null;
  t = t.slice(inicio, fim + 1);

  let obj = tentarParse(t) ?? tentarParse(t.replace(/,\s*([}\]])/g, '$1'));
  if (!obj || typeof obj !== 'object') return null;
  return normalizarResposta(obj);
}

function tentarParse(t) {
  try { return JSON.parse(t); } catch { return null; }
}

function normalizarResposta(obj) {
  const prioridades = new Set(['alta', 'média', 'baixa']);
  const itens = (Array.isArray(obj.itens) ? obj.itens : [])
    .filter((i) => i && typeof i.item === 'string' && i.item.trim())
    .map((i) => ({
      categoria: CATEGORIAS.includes(i.categoria) ? i.categoria : 'exames/monitorização',
      item: String(i.item).trim(),
      meta: typeof i.meta === 'string' ? i.meta.trim() : '',
      justificativa: typeof i.justificativa === 'string' ? i.justificativa.trim() : '',
      prioridade: prioridades.has(String(i.prioridade ?? '').toLowerCase()) ? String(i.prioridade).toLowerCase() : 'média',
    }));

  return {
    modo: obj.modo === 'analise' ? 'analise' : 'novo',
    objetivo_internacao: typeof obj.objetivo_internacao === 'string' ? obj.objetivo_internacao.trim() : '',
    lacunas: (Array.isArray(obj.lacunas) ? obj.lacunas : [])
      .filter((l) => l && (l.descricao || l.componente))
      .map((l) => ({ componente: String(l.componente ?? '').trim(), descricao: String(l.descricao ?? '').trim() })),
    itens,
    criterios_alta: (Array.isArray(obj.criterios_alta) ? obj.criterios_alta : [])
      .filter((c) => typeof c === 'string' && c.trim())
      .map((c) => c.trim()),
    dpa_estimada: typeof obj.dpa_estimada === 'string' ? obj.dpa_estimada.trim() : '',
    observacao: typeof obj.observacao === 'string' ? obj.observacao.trim() : '',
  };
}

let clienteAnthropicSingleton = null;
function clienteAnthropic() {
  if (!clienteAnthropicSingleton) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw Object.assign(new Error('ANTHROPIC_API_KEY não configurada no ambiente do servidor'), { statusCode: 503 });
    }
    clienteAnthropicSingleton = new Anthropic();
  }
  return clienteAnthropicSingleton;
}

// Gera as sugestões de plano. Retorna o objeto normalizado ou lança erro
// com statusCode apropriado.
export async function gerarSugestoes(dados) {
  const client = clienteAnthropic();
  const resposta = await client.messages.create({
    model: MODELO,
    max_tokens: 4096,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: montarPromptUsuario(dados) }],
  });

  if (resposta.stop_reason === 'refusal') {
    throw Object.assign(new Error('A IA recusou a solicitação. Revise o conteúdo enviado.'), { statusCode: 502 });
  }

  const texto = resposta.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  const parsed = parseRespostaLLM(texto);
  if (!parsed) {
    throw Object.assign(new Error('Não foi possível interpretar a resposta da IA. Tente novamente.'), {
      statusCode: 502,
      respostaBruta: texto.slice(0, 500),
    });
  }
  return parsed;
}
