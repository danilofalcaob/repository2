/**
 * Aprendizado adaptativo pragmático ("machine learning" leve, sem treino de modelo).
 *
 * - Cada sugestão vira um "padrão" (pattern_key): categoria + palavras-chave
 *   normalizadas do item, para agrupar formulações semelhantes.
 * - O contexto clínico vira um "context_key": síndromes reconhecidas na lista
 *   de problemas (pneumonia, icc, dpoc...), sem texto livre do paciente.
 * - Contadores de aceitação/rejeição por (padrão, contexto, setor) alimentam um
 *   score estilo Thompson/Beta: (aceitos + 0.5*modificados + 1) / (total + 2).
 * - A cada geração, um resumo do conhecimento (reforçar / evitar / regras)
 *   é injetado no prompt da API.
 */

const STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'a', 'o', 'as', 'os', 'e', 'em', 'no', 'na',
  'nos', 'nas', 'para', 'por', 'com', 'sem', 'ao', 'aos', 'um', 'uma', 'se',
  'que', 'ou', 'ate', 'apos', 'sobre', 'entre', 'ser', 'esta', 'estar', 'ha',
  'dia', 'dias', 'hoje', 'manter', 'avaliar', 'considerar', 'realizar',
  'solicitar', 'iniciar', 'paciente',
]);

export function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Chave estável para agrupar formulações semelhantes de um item de plano. */
export function patternKey(categoria, item) {
  const tokens = normalizeText(item)
    .split(' ')
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
  const unique = [...new Set(tokens)].sort().slice(0, 6);
  return `${normalizeText(categoria).replace(/\s/g, '_')}:${unique.join('-')}`;
}

/** Síndromes reconhecidas por palavras-chave na lista de problemas. */
const SYNDROME_KEYWORDS = {
  pneumonia: ['pneumonia', 'pnm', 'broncopneumonia', 'pac'],
  icc: ['icc', 'insuficiencia cardiaca', 'ic descompensada', 'congestao', 'edema agudo'],
  dpoc: ['dpoc', 'doenca pulmonar obstrutiva', 'exacerbacao dpoc', 'bronquite cronica'],
  itu_sepse: ['itu', 'infeccao urinaria', 'pielonefrite', 'sepse', 'choque septico', 'urosepse'],
  avc: ['avc', 'acidente vascular', 'ave', 'isquemico', 'hemorragico'],
  pos_operatorio: ['pos operatorio', 'po de', 'cirurgia', 'laparotomia', 'osteossintese', 'pos op'],
  tvp_tep: ['tvp', 'tep', 'trombose', 'embolia pulmonar'],
  dm_descompensado: ['cetoacidose', 'hiperglicemia', 'diabetes descompensado', 'ehh'],
  dren_renal: ['injuria renal', 'ira', 'insuficiencia renal', 'dialise'],
  hepatopatia: ['cirrose', 'hepatopatia', 'encefalopatia hepatica', 'ascite'],
};

export function detectSyndromes(problems) {
  const text = normalizeText((problems || []).join(' ; '));
  const found = [];
  for (const [syndrome, keywords] of Object.entries(SYNDROME_KEYWORDS)) {
    // fronteiras de palavra evitam falsos positivos (ex.: 'ira' em 'aspirativa')
    if (keywords.some((k) => new RegExp(`\\b${k}\\b`).test(text))) found.push(syndrome);
  }
  return found;
}

/** Contexto clínico mínimo persistido: apenas tags de síndrome. */
export function contextKey(problems) {
  const syndromes = detectSyndromes(problems);
  if (syndromes.length) return syndromes.sort().join('+');
  // fallback: 3 primeiros tokens significativos do primeiro problema
  const tokens = normalizeText((problems || [])[0] || '')
    .split(' ')
    .filter((t) => t.length > 3 && !STOPWORDS.has(t))
    .slice(0, 3);
  return tokens.length ? `outro:${tokens.join('-')}` : 'outro';
}

/** Score Beta/Thompson simplificado. Modificação conta como meia aceitação. */
export function score(stat) {
  const a = (stat.accepted || 0) + 0.5 * (stat.modified || 0);
  const r = (stat.rejected || 0) + 0.5 * (stat.modified || 0);
  return (a + 1) / (a + r + 2);
}

export function totalObservations(stat) {
  return (stat.accepted || 0) + (stat.modified || 0) + (stat.rejected || 0);
}

/**
 * Resumo do conhecimento aprendido, injetado no prompt.
 * Retorna { reforcar: [...], evitar: [...], regras: [...] }.
 */
export function buildKnowledge(db, ctxKey, sector) {
  const stats = db.listPatternStats({ contextKey: ctxKey, sector });
  const reforcar = [];
  const evitar = [];
  for (const s of stats) {
    const n = totalObservations(s);
    if (n < 2) continue; // exige mínimo de observações antes de influenciar
    const sc = score(s);
    if (sc >= 0.7) {
      reforcar.push({ item: s.item_exemplo, categoria: s.categoria, score: sc, n });
    } else if (sc <= 0.35) {
      const motivos = Object.entries(JSON.parse(s.motivos_json || '{}'))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([m]) => m);
      evitar.push({ item: s.item_exemplo, categoria: s.categoria, score: sc, n, motivos });
    }
  }
  reforcar.sort((a, b) => b.score * b.n - a.score * a.n);
  evitar.sort((a, b) => a.score - b.score);

  const regras = db
    .listRules(true)
    .filter((r) => !r.contexto || r.contexto === '' || ctxKey.includes(r.contexto));

  return {
    reforcar: reforcar.slice(0, 12),
    evitar: evitar.slice(0, 12),
    regras: regras.map((r) => ({ tipo: r.tipo, texto: r.texto })),
  };
}

/** Registra feedback e atualiza os agregados de aprendizado. */
export function recordFeedback(db, f) {
  const id = db.createFeedback(f);
  db.upsertPatternStat({
    patternKey: f.patternKey,
    contextKey: f.contextKey,
    sector: f.sector,
    categoria: f.categoria,
    itemExemplo: f.decision === 'modificado' && f.editedText ? f.editedText : f.item,
    decision: f.decision,
    motivo: f.motivo,
  });
  return id;
}
