// Rotas da API do PTx Adaptativo.
// `criarApp({ llm })` permite injetar um gerador de sugestões falso nos testes.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import {
  criarUsuario, buscarUsuarioPorEmail, registrarGeracao, registrarFeedback,
  listarRegras, criarRegra, atualizarRegra, removerRegra, listarScores,
  estatisticasGlobais, estatisticasPorCategoria, serieTemporalSemanal,
  motivosRejeicao, expurgarDadosClinicos,
} from './db.js';
import { hashSenha, verificarSenha, emitirToken, exigirAuth, exigirAdmin } from './auth.js';
import { gerarSugestoes as gerarSugestoesLLM } from './llm.js';
import { aplicarFeedbackAoScore, normalizarItem, taxaAceitacao } from './learning.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DECISOES = new Set(['conforme', 'nao_conforme', 'aceito_modificado']);
const SETORES = new Set(['enfermaria', 'uti', 'pa']);

export function criarApp({ llm = gerarSugestoesLLM } = {}) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // ---------- autenticação ----------
  app.post('/api/auth/registrar', (req, res) => {
    const { nome, email, senha } = req.body ?? {};
    if (!nome?.trim() || !email?.trim() || !senha || senha.length < 6) {
      return res.status(400).json({ erro: 'Informe nome, e-mail e senha (mínimo 6 caracteres).' });
    }
    if (buscarUsuarioPorEmail(email)) {
      return res.status(409).json({ erro: 'E-mail já cadastrado.' });
    }
    const id = criarUsuario({ nome: nome.trim(), email: email.trim(), senhaHash: hashSenha(senha) });
    const usuario = { id, nome: nome.trim(), email: email.trim().toLowerCase(), papel: 'medico' };
    res.status(201).json({ token: emitirToken(usuario), usuario });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, senha } = req.body ?? {};
    const u = email ? buscarUsuarioPorEmail(email) : null;
    if (!u || !verificarSenha(senha ?? '', u.senha_hash)) {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }
    res.json({ token: emitirToken(u), usuario: { id: u.id, nome: u.nome, email: u.email, papel: u.papel } });
  });

  app.get('/api/auth/eu', exigirAuth, (req, res) => res.json({ usuario: req.usuario }));

  // ---------- geração de sugestões ----------
  app.post('/api/plano/gerar', exigirAuth, async (req, res) => {
    const b = req.body ?? {};
    const problemas = (Array.isArray(b.problemas) ? b.problemas : [])
      .map((p) => String(p).trim()).filter(Boolean);
    const evolucao = String(b.evolucao ?? '').trim();
    if (!problemas.length) return res.status(400).json({ erro: 'Informe ao menos um problema ativo.' });
    if (!evolucao) return res.status(400).json({ erro: 'Informe a evolução do dia.' });

    const setor = SETORES.has(String(b.setor ?? '').toLowerCase()) ? String(b.setor).toLowerCase() : null;
    const dados = {
      problemas,
      evolucao,
      hpma: String(b.hpma ?? ''),
      planoExistente: String(b.planoExistente ?? ''),
      diasInternacao: b.diasInternacao,
      setor,
      dispositivos: String(b.dispositivos ?? '').trim() || null,
      dieta: String(b.dieta ?? '').trim() || null,
      oxigenio: String(b.oxigenio ?? '').trim() || null,
    };

    try {
      const plano = await llm(dados);
      const geracaoId = registrarGeracao({
        usuarioId: req.usuario.id,
        setor,
        problemas: problemas.join('; '),
        modo: plano.modo,
        nItens: plano.itens.length,
      });
      res.json({ geracaoId, contexto: { problemas: problemas.join('; '), setor }, plano });
    } catch (err) {
      const status = err.statusCode ?? 500;
      res.status(status).json({ erro: err.message, respostaBruta: err.respostaBruta });
    }
  });

  // ---------- feedback ----------
  app.post('/api/feedback', exigirAuth, (req, res) => {
    const b = req.body ?? {};
    const categoria = String(b.categoria ?? '').trim();
    const item = String(b.item ?? '').trim();
    const decisao = String(b.decisao ?? '').trim();
    if (!categoria || !item || !DECISOES.has(decisao)) {
      return res.status(400).json({ erro: 'Informe categoria, item e decisão válida (conforme | nao_conforme | aceito_modificado).' });
    }
    const setor = SETORES.has(String(b.setor ?? '').toLowerCase()) ? String(b.setor).toLowerCase() : null;
    const motivo = String(b.motivo ?? '').trim() || null;

    const id = registrarFeedback({
      usuarioId: req.usuario.id,
      geracaoId: Number.isInteger(b.geracaoId) ? b.geracaoId : null,
      categoria,
      item,
      itemNorm: normalizarItem(item),
      decisao,
      motivo,
      textoEditado: String(b.textoEditado ?? '').trim() || null,
      contextoClinico: String(b.contextoClinico ?? '').trim() || null,
      setor,
    });
    const score = aplicarFeedbackAoScore({ categoria, item, setor, decisao, motivo });
    res.status(201).json({ id, score: score ? { taxa: score.taxa, ewma: score.ewma } : null });
  });

  // ---------- dashboard ----------
  app.get('/api/dashboard', exigirAuth, (req, res) => {
    const scores = listarScores({ limite: 1000 })
      .map((s) => ({ ...s, n: s.aceitos + s.modificados + s.rejeitados, taxa: taxaAceitacao(s), motivos: JSON.parse(s.motivos) }))
      .filter((s) => s.n >= 1);
    const maisAceitos = [...scores].sort((a, b) => b.taxa - a.taxa || b.n - a.n).slice(0, 10);
    const maisRejeitados = [...scores].sort((a, b) => a.taxa - b.taxa || b.n - a.n).slice(0, 10);
    res.json({
      global: estatisticasGlobais(),
      porCategoria: estatisticasPorCategoria(),
      serieSemanal: serieTemporalSemanal(),
      motivosRejeicao: motivosRejeicao(),
      maisAceitos,
      maisRejeitados,
    });
  });

  // ---------- regras aprendidas (admin) ----------
  app.get('/api/regras', exigirAuth, (req, res) => {
    res.json({ regras: listarRegras() });
  });
  app.post('/api/regras', exigirAuth, exigirAdmin, (req, res) => {
    const { tipo, texto } = req.body ?? {};
    if (!texto?.trim()) return res.status(400).json({ erro: 'Informe o texto da regra.' });
    const t = ['evitar', 'preferir', 'fraseado'].includes(tipo) ? tipo : 'evitar';
    const id = criarRegra({ tipo: t, texto: texto.trim(), origem: req.body?.origem === 'promovida' ? 'promovida' : 'manual', criadoPor: req.usuario.id });
    res.status(201).json({ id });
  });
  app.put('/api/regras/:id', exigirAuth, exigirAdmin, (req, res) => {
    const { tipo, texto, ativo } = req.body ?? {};
    atualizarRegra(Number(req.params.id), { tipo, texto, ativo });
    res.json({ ok: true });
  });
  app.delete('/api/regras/:id', exigirAuth, exigirAdmin, (req, res) => {
    removerRegra(Number(req.params.id));
    res.json({ ok: true });
  });

  // ---------- LGPD: expurgo manual (admin) ----------
  app.post('/api/admin/expurgo', exigirAuth, exigirAdmin, (req, res) => {
    const dias = Number(req.body?.dias ?? process.env.PTX_RETENCAO_DIAS ?? 90);
    if (!Number.isFinite(dias) || dias < 1) return res.status(400).json({ erro: 'Número de dias inválido.' });
    res.json({ expurgados: expurgarDadosClinicos(dias) });
  });

  app.get('/api/saude', (req, res) => res.json({ ok: true, iaConfigurada: Boolean(process.env.ANTHROPIC_API_KEY) }));

  // ---------- frontend buildado (produção) ----------
  const dist = path.join(__dirname, '..', '..', 'frontend', 'dist');
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  return app;
}
