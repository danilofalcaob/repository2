/**
 * Parsing tolerante do JSON retornado pelo modelo.
 * O modelo é instruído a responder apenas JSON, mas o parser tolera:
 * cercas de markdown, texto antes/depois do objeto e vírgulas finais.
 */

export function parseModelJson(raw) {
  if (raw == null) throw new Error('Resposta vazia do modelo');
  let text = String(raw).trim();

  // remove cercas ```json ... ```
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  const attempts = [text];

  // recorte entre a primeira '{' e a última '}'
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) attempts.push(text.slice(first, last + 1));

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch {
      // tenta remover vírgulas finais antes de } ou ]
      try {
        return JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1'));
      } catch {
        // próxima tentativa
      }
    }
  }
  const preview = text.slice(0, 200);
  throw new Error(`Não foi possível interpretar o JSON do modelo: ${preview}...`);
}

const CATEGORIAS_VALIDAS = [
  'terapeutica medicamentosa',
  'dispositivos',
  'mobilidade',
  'dieta/nutricao',
  'profilaxias',
  'exames/monitorizacao',
  'multidisciplinar',
  'planejamento de alta',
  'metas de cuidado',
];

/** Normaliza e valida a estrutura do plano; descarta itens malformados. */
export function normalizePlan(parsed) {
  const plan = {
    modo: parsed.modo === 'complemento' ? 'complemento' : 'novo',
    objetivo_internacao: String(parsed.objetivo_internacao || ''),
    lacunas: Array.isArray(parsed.lacunas) ? parsed.lacunas.map(String) : [],
    itens: [],
    criterios_alta: Array.isArray(parsed.criterios_alta)
      ? parsed.criterios_alta.map(String)
      : [],
    dpa: String(parsed.dpa || ''),
  };
  for (const it of Array.isArray(parsed.itens) ? parsed.itens : []) {
    if (!it || typeof it !== 'object') continue;
    const item = String(it.item || '').trim();
    if (!item) continue;
    const categoria = String(it.categoria || 'terapeutica medicamentosa')
      .toLowerCase()
      .trim();
    plan.itens.push({
      categoria: CATEGORIAS_VALIDAS.includes(categoria) ? categoria : 'terapeutica medicamentosa',
      item,
      meta: String(it.meta || '').trim(),
      justificativa: String(it.justificativa || '').trim(),
      prioridade: ['alta', 'media', 'baixa'].includes(String(it.prioridade || '').toLowerCase())
        ? String(it.prioridade).toLowerCase()
        : 'media',
    });
  }
  return plan;
}

export { CATEGORIAS_VALIDAS };
