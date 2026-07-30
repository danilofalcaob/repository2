import { Router } from 'express';
import {
  registerUser, loginUser, authMiddleware, adminOnly, cookieOptions, COOKIE_NAME,
} from './auth.js';
import {
  contextKey, detectSyndromes, patternKey, buildKnowledge, recordFeedback,
  score, totalObservations,
} from './learning.js';
import { generatePlan, MODEL } from './ai.js';

const MOTIVOS_VALIDOS = [
  'nao disponivel no servico',
  'logistica inviavel',
  'nao se aplica ao perfil de pacientes',
  'redundante',
  'outro',
];

// Express 4 não propaga rejeições de handlers async para o middleware de erro.
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function buildRouter(db, deps = {}) {
  const router = Router();
  const auth = authMiddleware(db);

  // ---------------- autenticação ----------------
  router.post('/auth/register', (req, res) => {
    const user = registerUser(db, req.body || {});
    const { token } = loginUser(db, { email: user.email, password: req.body.password });
    res.cookie(COOKIE_NAME, token, cookieOptions());
    res.status(201).json({ user });
  });

  router.post('/auth/login', (req, res) => {
    const { token, user } = loginUser(db, req.body || {});
    res.cookie(COOKIE_NAME, token, cookieOptions());
    res.json({ user });
  });

  router.post('/auth/logout', auth, (req, res) => {
    db.deleteSession(req.sessionToken);
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.json({ ok: true });
  });

  router.get('/auth/me', auth, (req, res) => res.json({ user: req.user }));

  // ---------------- geração de plano ----------------
  router.post('/generate', auth, asyncH(async (req, res) => {
    const {
      problems, hpma, evolution, existingPlan,
      diasInternacao, setor, dispositivos, dieta, oxigenio,
    } = req.body || {};

    const problemList = (Array.isArray(problems) ? problems : [])
      .map((p) => String(p).trim())
      .filter(Boolean);
    if (!problemList.length) {
      return res.status(400).json({ error: 'Informe ao menos uma hipótese diagnóstica / problema ativo.' });
    }
    if (!evolution || !String(evolution).trim()) {
      return res.status(400).json({ error: 'A evolução do dia é obrigatória.' });
    }

    const ctxKey = contextKey(problemList);
    const knowledge = buildKnowledge(db, ctxKey, setor || '');
    const seedItems = db.seedForSyndromes(detectSyndromes(problemList));

    const input = {
      problems: problemList,
      hpma: String(hpma || '').trim(),
      evolution: String(evolution).trim(),
      existingPlan: String(existingPlan || '').trim(),
      diasInternacao: String(diasInternacao || '').trim(),
      setor: String(setor || '').trim(),
      dispositivos: String(dispositivos || '').trim(),
      dieta: String(dieta || '').trim(),
      oxigenio: String(oxigenio || '').trim(),
    };

    const plan = await generatePlan(input, knowledge, seedItems, deps);

    const generationId = db.createGeneration({
      userId: req.user.id,
      contextKey: ctxKey,
      sector: input.setor,
      problems: problemList,
      mode: plan.modo,
    });

    const itens = plan.itens.map((it) => {
      const pk = patternKey(it.categoria, it.item);
      const id = db.createSuggestion({
        generationId,
        categoria: it.categoria,
        item: it.item,
        meta: it.meta,
        justificativa: it.justificativa,
        prioridade: it.prioridade,
        patternKey: pk,
      });
      return { id, ...it };
    });

    res.json({
      generationId,
      contextKey: ctxKey,
      model: MODEL,
      plan: { ...plan, itens },
    });
  }));

  // ---------------- feedback ----------------
  router.post('/feedback', auth, (req, res) => {
    const { suggestionId, decision, motivo, editedText } = req.body || {};
    if (!['conforme', 'nao_conforme', 'modificado'].includes(decision)) {
      return res.status(400).json({ error: 'Decisão inválida.' });
    }
    const suggestion = db.findSuggestion(Number(suggestionId));
    if (!suggestion) return res.status(404).json({ error: 'Sugestão não encontrada.' });

    const motivoNorm = motivo ? String(motivo).trim() : '';
    if (decision === 'nao_conforme' && motivoNorm && !MOTIVOS_VALIDOS.includes(motivoNorm)) {
      // motivo livre é aceito, mas mapeado para 'outro' com texto preservado
    }

    const id = recordFeedback(db, {
      suggestionId: suggestion.id,
      userId: req.user.id,
      decision,
      motivo: motivoNorm,
      editedText: decision === 'modificado' ? String(editedText || '').trim() : '',
      categoria: suggestion.categoria,
      item: suggestion.item,
      patternKey: suggestion.pattern_key,
      contextKey: suggestion.context_key,
      sector: suggestion.sector,
    });
    res.status(201).json({ id });
  });

  // ---------------- dashboard ----------------
  router.get('/dashboard', auth, (req, res) => {
    const summary = db.feedbackSummary();
    const byCat = db.feedbackByCategory();
    const overTime = db.feedbackOverTime();
    const motivos = db.topMotivos();

    const totals = { conforme: 0, nao_conforme: 0, modificado: 0 };
    for (const s of summary) totals[s.decision] = s.c;
    const total = totals.conforme + totals.nao_conforme + totals.modificado;
    const conformidade = total
      ? (totals.conforme + 0.5 * totals.modificado) / total
      : null;

    const categorias = {};
    for (const r of byCat) {
      categorias[r.categoria] ??= { conforme: 0, nao_conforme: 0, modificado: 0 };
      categorias[r.categoria][r.decision] = r.c;
    }
    const porCategoria = Object.entries(categorias).map(([categoria, c]) => {
      const t = c.conforme + c.nao_conforme + c.modificado;
      return {
        categoria,
        total: t,
        conformidade: t ? (c.conforme + 0.5 * c.modificado) / t : null,
        ...c,
      };
    });

    const semanas = {};
    for (const r of overTime) {
      semanas[r.week] ??= { conforme: 0, nao_conforme: 0, modificado: 0 };
      semanas[r.week][r.decision] = r.c;
    }
    const evolucao = Object.entries(semanas).map(([week, c]) => {
      const t = c.conforme + c.nao_conforme + c.modificado;
      return { week, total: t, conformidade: t ? (c.conforme + 0.5 * c.modificado) / t : null };
    });

    const stats = db.listPatternStats();
    const ranked = stats
      .filter((s) => totalObservations(s) >= 2)
      .map((s) => ({
        item: s.item_exemplo,
        categoria: s.categoria,
        contexto: s.context_key,
        n: totalObservations(s),
        score: score(s),
        motivos: JSON.parse(s.motivos_json || '{}'),
      }));
    const maisAceitos = [...ranked].sort((a, b) => b.score - a.score).slice(0, 10);
    const maisRejeitados = [...ranked].sort((a, b) => a.score - b.score).slice(0, 10);

    res.json({
      totals, total, conformidade, porCategoria, evolucao,
      motivosRejeicao: motivos, maisAceitos, maisRejeitados,
    });
  });

  // ---------------- regras aprendidas (admin) ----------------
  router.get('/rules', auth, (req, res) => res.json({ rules: db.listRules() }));

  router.post('/rules', auth, adminOnly, (req, res) => {
    const { tipo, texto, contexto, origem } = req.body || {};
    if (!['evitar', 'preferir'].includes(tipo) || !texto?.trim()) {
      return res.status(400).json({ error: "Informe tipo ('evitar'|'preferir') e texto." });
    }
    const id = db.createRule({
      tipo, texto: texto.trim(), contexto: (contexto || '').trim(),
      origem: origem === 'aprendida' ? 'aprendida' : 'manual',
      createdBy: req.user.id,
    });
    res.status(201).json({ id });
  });

  router.patch('/rules/:id', auth, adminOnly, (req, res) => {
    db.updateRule(Number(req.params.id), req.body || {});
    res.json({ ok: true });
  });

  router.delete('/rules/:id', auth, adminOnly, (req, res) => {
    db.deleteRule(Number(req.params.id));
    res.json({ ok: true });
  });

  // ---------------- LGPD: expurgo ----------------
  router.post('/admin/purge', auth, adminOnly, (req, res) => {
    const days = Number(req.body?.olderThanDays) || 90;
    const result = db.purgeClinicalText(days);
    res.json({ ok: true, olderThanDays: days, ...result });
  });

  return router;
}

export { MOTIVOS_VALIDOS };
