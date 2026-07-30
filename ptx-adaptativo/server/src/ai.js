/**
 * Integração com a API da Anthropic (claude-sonnet-4-6).
 * A chave vem exclusivamente de ANTHROPIC_API_KEY no ambiente do servidor —
 * nunca é enviada ao frontend.
 */
import Anthropic from '@anthropic-ai/sdk';
import { parseModelJson, normalizePlan, CATEGORIAS_VALIDAS } from './parse.js';

export const MODEL = process.env.PTX_MODEL || 'claude-sonnet-4-6';
const MAX_TOKENS = 6000;

let _client = null;
function getClient() {
  if (!_client) _client = new Anthropic(); // lê ANTHROPIC_API_KEY do ambiente
  return _client;
}

export const SYSTEM_PROMPT = `Você é um assistente de apoio à decisão para elaboração de PLANO TERAPÊUTICO de pacientes internados em um hospital brasileiro. Você auxilia médicos assistentes e plantonistas.

REGRA FUNDAMENTAL: suas sugestões são APOIO À DECISÃO. A conduta final é sempre do médico assistente, que deve validar cada item de acordo com o quadro clínico completo, as diretrizes institucionais e o seu julgamento profissional. Nunca apresente sugestões como ordens.

Um bom plano terapêutico hospitalar contém estes 8 componentes (validados pela literatura):
1. Objetivo claro da internação — por que o paciente está internado e o que precisa acontecer para a alta.
2. Metas diárias explícitas e MENSURÁVEIS (modelo daily goals de Pronovost) — ex.: desmame de O2, transição de antibiótico EV→VO, retirada de dispositivos (SVD, CVC, SNE), mobilização precoce.
3. Critérios de alta explícitos e data provável de alta (DPA), revisados diariamente.
4. Planejamento de alta desde o dia 1 — reconciliação medicamentosa, seguimento ambulatorial, orientações, suporte domiciliar.
5. Multidisciplinaridade — fisioterapia, nutrição, farmácia clínica, enfermagem, serviço social.
6. Individualização e proporcionalidade — comorbidades, funcionalidade prévia, prognóstico; quando aplicável, sugerir discussão de metas de cuidado/teto terapêutico/cuidados paliativos.
7. Registro claro e transmissível — compreensível por qualquer plantonista (estilo I-PASS).
8. Profilaxias e segurança — TEV, LPP (lesão por pressão), broncoaspiração, delirium, quando pertinentes.

FORMATO DE SAÍDA — responda APENAS com um objeto JSON válido, sem texto antes ou depois, sem cercas de markdown, com esta estrutura:
{
  "modo": "novo" | "complemento",
  "objetivo_internacao": "frase clara respondendo 'por que este paciente está internado hoje?'",
  "lacunas": ["apenas quando modo=complemento: lacunas do plano existente em relação aos 8 componentes"],
  "itens": [
    {
      "categoria": "${CATEGORIAS_VALIDAS.join('" | "')}",
      "item": "conduta sugerida, objetiva e acionável",
      "meta": "meta mensurável com prazo, quando aplicável (ex.: 'SpO2 >= 92% em ar ambiente em 48h')",
      "justificativa": "breve justificativa clínica",
      "prioridade": "alta" | "media" | "baixa"
    }
  ],
  "criterios_alta": ["critérios de alta explícitos e verificáveis"],
  "dpa": "data provável de alta estimada (ex.: 'D+3 a D+5 da internação') com justificativa breve"
}

Diretrizes:
- Escreva em português do Brasil, em linguagem de prontuário, concisa.
- Sempre inclua criterios_alta e dpa quando os dados permitirem estimar; se não permitirem, explique o que falta.
- Quando um plano já elaborado for fornecido (modo complemento), NÃO duplique o que já está adequado: aponte lacunas em relação aos 8 componentes e sugira apenas complementos.
- Respeite o CONHECIMENTO DO SERVIÇO fornecido: reforce padrões bem aceitos, evite ou adapte itens recorrentemente rejeitados (considerando os motivos), e siga as regras explícitas do serviço.
- Individualize: considere setor, dias de internação, dispositivos, dieta e O2 informados.`;

function formatKnowledge(knowledge, seedItems) {
  const parts = [];
  if (knowledge.regras.length) {
    parts.push(
      'REGRAS EXPLÍCITAS DO SERVIÇO (obrigatórias):\n' +
        knowledge.regras.map((r) => `- [${r.tipo.toUpperCase()}] ${r.texto}`).join('\n')
    );
  }
  if (knowledge.reforcar.length) {
    parts.push(
      'PADRÕES BEM ACEITOS neste contexto (reforce/prefira formulações assim):\n' +
        knowledge.reforcar
          .map((k) => `- (${k.categoria}) ${k.item} [aceitação ${(k.score * 100).toFixed(0)}%, n=${k.n}]`)
          .join('\n')
    );
  }
  if (knowledge.evitar.length) {
    parts.push(
      'PADRÕES RECORRENTEMENTE REJEITADOS neste contexto (evite ou adapte):\n' +
        knowledge.evitar
          .map(
            (k) =>
              `- (${k.categoria}) ${k.item} [aceitação ${(k.score * 100).toFixed(0)}%, n=${k.n}]` +
              (k.motivos?.length ? ` — motivos: ${k.motivos.join('; ')}` : '')
          )
          .join('\n')
    );
  }
  if (seedItems.length) {
    parts.push(
      'ITENS TÍPICOS DO SERVIÇO para as síndromes identificadas (use como base, adaptando ao caso):\n' +
        seedItems
          .map((s) => `- (${s.categoria}) ${s.item}${s.meta ? ` | meta: ${s.meta}` : ''}`)
          .join('\n')
    );
  }
  return parts.length ? parts.join('\n\n') : 'Sem histórico de aprendizado ainda para este contexto.';
}

export function buildUserPrompt(input, knowledge, seedItems) {
  const {
    problems, hpma, evolution, existingPlan,
    diasInternacao, setor, dispositivos, dieta, oxigenio,
  } = input;

  const lines = [
    '== DADOS DO PACIENTE (sem identificadores) ==',
    `Hipóteses diagnósticas / problemas ativos:\n${problems.map((p) => `- ${p}`).join('\n')}`,
  ];
  if (hpma) lines.push(`HPMA:\n${hpma}`);
  lines.push(`Evolução do dia:\n${evolution}`);
  const estruturados = [];
  if (diasInternacao) estruturados.push(`Dias de internação: ${diasInternacao}`);
  if (setor) estruturados.push(`Setor: ${setor}`);
  if (dispositivos) estruturados.push(`Dispositivos em uso: ${dispositivos}`);
  if (dieta) estruturados.push(`Dieta atual: ${dieta}`);
  if (oxigenio) estruturados.push(`Uso de O2: ${oxigenio}`);
  if (estruturados.length) lines.push(estruturados.join('\n'));

  if (existingPlan) {
    lines.push(
      `== PLANO TERAPÊUTICO JÁ ELABORADO PELO MÉDICO ==\n${existingPlan}\n\n` +
        'TAREFA: modo "complemento". Analise o plano acima em relação aos 8 componentes, liste as lacunas em "lacunas" e sugira em "itens" APENAS complementos que faltam — não duplique o que já está adequado.'
    );
  } else {
    lines.push('TAREFA: modo "novo". Elabore o plano terapêutico sugerido completo.');
  }

  lines.push(`== CONHECIMENTO APRENDIDO DO SERVIÇO ==\n${formatKnowledge(knowledge, seedItems)}`);
  return lines.join('\n\n');
}

/**
 * Gera o plano chamando a API. Retorna o plano normalizado.
 * `deps.createMessage` permite injetar um mock nos testes.
 */
export async function generatePlan(input, knowledge, seedItems, deps = {}) {
  const createMessage =
    deps.createMessage ||
    (async (params) => getClient().messages.create(params));

  const response = await createMessage({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildUserPrompt(input, knowledge, seedItems) }],
  });

  if (response.stop_reason === 'refusal') {
    throw Object.assign(new Error('O modelo recusou a solicitação.'), { status: 422 });
  }
  const textBlock = (response.content || []).find((b) => b.type === 'text');
  if (!textBlock) throw new Error('Resposta do modelo sem conteúdo de texto.');
  return normalizePlan(parseModelJson(textBlock.text));
}
