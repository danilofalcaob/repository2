// Camada de acesso a dados do PTx Adaptativo.
//
// Toda interação com o banco passa por este módulo. O restante do código nunca
// importa `node:sqlite` diretamente — para migrar para PostgreSQL basta
// reimplementar as funções exportadas aqui (mesmas assinaturas) sobre `pg`.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db = null;

export function openDb(dbPath) {
  const file = dbPath ?? process.env.PTX_DB_PATH ?? path.join(__dirname, '..', 'data', 'ptx.sqlite');
  if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
  db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL;');
  migrate();
  return db;
}

export function getDb() {
  if (!db) openDb();
  return db;
}

export function closeDb() {
  if (db) { db.close(); db = null; }
}

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      papel TEXT NOT NULL DEFAULT 'medico', -- 'medico' | 'admin'
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Registro mínimo de cada geração de plano (sem identificadores de paciente).
    CREATE TABLE IF NOT EXISTS geracoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER REFERENCES usuarios(id),
      setor TEXT,
      problemas TEXT,           -- contexto clínico mínimo; anulado pelo expurgo
      modo TEXT,                -- 'novo' | 'analise'
      n_itens INTEGER,
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Feedback item a item (👍/👎/aceito com modificação).
    CREATE TABLE IF NOT EXISTS feedbacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER REFERENCES usuarios(id),
      geracao_id INTEGER REFERENCES geracoes(id),
      categoria TEXT NOT NULL,
      item TEXT NOT NULL,
      item_norm TEXT NOT NULL,
      decisao TEXT NOT NULL,    -- 'conforme' | 'nao_conforme' | 'aceito_modificado'
      motivo TEXT,
      texto_editado TEXT,       -- anulado pelo expurgo
      contexto_clinico TEXT,    -- resumo (diagnósticos); anulado pelo expurgo
      setor TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_feedbacks_criado ON feedbacks(criado_em);

    -- Score adaptativo por padrão de item + contexto (categoria + setor).
    CREATE TABLE IF NOT EXISTS item_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      categoria TEXT NOT NULL,
      item_norm TEXT NOT NULL,
      item_exemplo TEXT NOT NULL,
      setor TEXT NOT NULL DEFAULT '',
      aceitos INTEGER NOT NULL DEFAULT 0,
      modificados INTEGER NOT NULL DEFAULT 0,
      rejeitados INTEGER NOT NULL DEFAULT 0,
      ewma REAL NOT NULL DEFAULT 0.5,
      motivos TEXT NOT NULL DEFAULT '[]', -- JSON: últimos motivos de rejeição
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (categoria, item_norm, setor)
    );

    -- Regras aprendidas, editáveis/aprováveis pelo administrador.
    CREATE TABLE IF NOT EXISTS regras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL DEFAULT 'evitar',  -- 'evitar' | 'preferir' | 'fraseado'
      texto TEXT NOT NULL,
      ativo INTEGER NOT NULL DEFAULT 1,
      origem TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'promovida'
      criado_por INTEGER REFERENCES usuarios(id),
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Base de conhecimento inicial por síndrome (seed).
    CREATE TABLE IF NOT EXISTS conhecimento_seed (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sindrome TEXT NOT NULL,
      palavras_chave TEXT NOT NULL, -- JSON: termos que ativam a síndrome
      categoria TEXT NOT NULL,
      item TEXT NOT NULL,
      meta TEXT
    );
  `);
}

// ---------- meta ----------
export function metaGet(chave) {
  const row = getDb().prepare('SELECT valor FROM meta WHERE chave = ?').get(chave);
  return row ? row.valor : null;
}
export function metaSet(chave, valor) {
  getDb().prepare('INSERT INTO meta (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor').run(chave, valor);
}

// ---------- usuários ----------
export function criarUsuario({ nome, email, senhaHash, papel = 'medico' }) {
  const r = getDb().prepare('INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES (?, ?, ?, ?)')
    .run(nome, email.toLowerCase(), senhaHash, papel);
  return Number(r.lastInsertRowid);
}
export function buscarUsuarioPorEmail(email) {
  return getDb().prepare('SELECT * FROM usuarios WHERE email = ?').get(email.toLowerCase()) ?? null;
}
export function buscarUsuarioPorId(id) {
  return getDb().prepare('SELECT id, nome, email, papel FROM usuarios WHERE id = ?').get(id) ?? null;
}
export function contarUsuarios() {
  return Number(getDb().prepare('SELECT COUNT(*) AS n FROM usuarios').get().n);
}

// ---------- gerações ----------
export function registrarGeracao({ usuarioId, setor, problemas, modo, nItens }) {
  const r = getDb().prepare('INSERT INTO geracoes (usuario_id, setor, problemas, modo, n_itens) VALUES (?, ?, ?, ?, ?)')
    .run(usuarioId ?? null, setor ?? null, problemas ?? null, modo, nItens);
  return Number(r.lastInsertRowid);
}

// ---------- feedback ----------
export function registrarFeedback(f) {
  const r = getDb().prepare(`
    INSERT INTO feedbacks (usuario_id, geracao_id, categoria, item, item_norm, decisao, motivo, texto_editado, contexto_clinico, setor)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    f.usuarioId ?? null, f.geracaoId ?? null, f.categoria, f.item, f.itemNorm,
    f.decisao, f.motivo ?? null, f.textoEditado ?? null, f.contextoClinico ?? null, f.setor ?? null
  );
  return Number(r.lastInsertRowid);
}

export function obterScore(categoria, itemNorm, setor) {
  return getDb().prepare('SELECT * FROM item_scores WHERE categoria = ? AND item_norm = ? AND setor = ?')
    .get(categoria, itemNorm, setor) ?? null;
}

export function salvarScore(s) {
  getDb().prepare(`
    INSERT INTO item_scores (categoria, item_norm, item_exemplo, setor, aceitos, modificados, rejeitados, ewma, motivos, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT (categoria, item_norm, setor) DO UPDATE SET
      aceitos = excluded.aceitos,
      modificados = excluded.modificados,
      rejeitados = excluded.rejeitados,
      ewma = excluded.ewma,
      motivos = excluded.motivos,
      item_exemplo = excluded.item_exemplo,
      atualizado_em = datetime('now')
  `).run(s.categoria, s.item_norm, s.item_exemplo, s.setor, s.aceitos, s.modificados, s.rejeitados, s.ewma, s.motivos);
}

export function listarScores({ setor = null, limite = 500 } = {}) {
  if (setor) {
    return getDb().prepare('SELECT * FROM item_scores WHERE setor IN (?, \'\') ORDER BY atualizado_em DESC LIMIT ?').all(setor, limite);
  }
  return getDb().prepare('SELECT * FROM item_scores ORDER BY atualizado_em DESC LIMIT ?').all(limite);
}

// ---------- regras ----------
export function listarRegras({ apenasAtivas = false } = {}) {
  const sql = apenasAtivas
    ? 'SELECT * FROM regras WHERE ativo = 1 ORDER BY id DESC'
    : 'SELECT * FROM regras ORDER BY id DESC';
  return getDb().prepare(sql).all();
}
export function criarRegra({ tipo, texto, origem = 'manual', criadoPor = null }) {
  const r = getDb().prepare('INSERT INTO regras (tipo, texto, origem, criado_por) VALUES (?, ?, ?, ?)')
    .run(tipo, texto, origem, criadoPor);
  return Number(r.lastInsertRowid);
}
export function atualizarRegra(id, { tipo, texto, ativo }) {
  getDb().prepare('UPDATE regras SET tipo = COALESCE(?, tipo), texto = COALESCE(?, texto), ativo = COALESCE(?, ativo) WHERE id = ?')
    .run(tipo ?? null, texto ?? null, ativo === undefined ? null : (ativo ? 1 : 0), id);
}
export function removerRegra(id) {
  getDb().prepare('DELETE FROM regras WHERE id = ?').run(id);
}

// ---------- conhecimento seed ----------
export function inserirConhecimento({ sindrome, palavrasChave, categoria, item, meta }) {
  getDb().prepare('INSERT INTO conhecimento_seed (sindrome, palavras_chave, categoria, item, meta) VALUES (?, ?, ?, ?, ?)')
    .run(sindrome, JSON.stringify(palavrasChave), categoria, item, meta ?? null);
}
export function contarConhecimento() {
  return Number(getDb().prepare('SELECT COUNT(*) AS n FROM conhecimento_seed').get().n);
}
export function listarConhecimento() {
  return getDb().prepare('SELECT * FROM conhecimento_seed').all();
}

// ---------- dashboard ----------
export function estatisticasGlobais() {
  return getDb().prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN decisao = 'conforme' THEN 1 ELSE 0 END) AS conformes,
      SUM(CASE WHEN decisao = 'aceito_modificado' THEN 1 ELSE 0 END) AS modificados,
      SUM(CASE WHEN decisao = 'nao_conforme' THEN 1 ELSE 0 END) AS nao_conformes
    FROM feedbacks
  `).get();
}
export function estatisticasPorCategoria() {
  return getDb().prepare(`
    SELECT categoria,
      COUNT(*) AS total,
      SUM(CASE WHEN decisao = 'conforme' THEN 1 ELSE 0 END) AS conformes,
      SUM(CASE WHEN decisao = 'aceito_modificado' THEN 1 ELSE 0 END) AS modificados,
      SUM(CASE WHEN decisao = 'nao_conforme' THEN 1 ELSE 0 END) AS nao_conformes
    FROM feedbacks GROUP BY categoria ORDER BY total DESC
  `).all();
}
export function serieTemporalSemanal() {
  return getDb().prepare(`
    SELECT strftime('%Y-%W', criado_em) AS semana,
      COUNT(*) AS total,
      SUM(CASE WHEN decisao IN ('conforme', 'aceito_modificado') THEN 1 ELSE 0 END) AS aceitos
    FROM feedbacks GROUP BY semana ORDER BY semana
  `).all();
}
export function motivosRejeicao() {
  return getDb().prepare(`
    SELECT COALESCE(NULLIF(TRIM(motivo), ''), '(sem motivo)') AS motivo, COUNT(*) AS total
    FROM feedbacks WHERE decisao = 'nao_conforme'
    GROUP BY 1 ORDER BY total DESC LIMIT 15
  `).all();
}

// ---------- LGPD: expurgo/anonimização ----------
// Anula o texto clínico livre de registros antigos, preservando apenas os
// agregados necessários ao aprendizado (categoria, item, decisão, motivo).
export function expurgarDadosClinicos(dias) {
  const d = getDb();
  const cutoff = `-${Math.max(1, Math.floor(dias))} days`;
  const r1 = d.prepare(`
    UPDATE feedbacks SET contexto_clinico = NULL, texto_editado = NULL
    WHERE criado_em < datetime('now', ?) AND (contexto_clinico IS NOT NULL OR texto_editado IS NOT NULL)
  `).run(cutoff);
  const r2 = d.prepare(`
    UPDATE geracoes SET problemas = NULL
    WHERE criado_em < datetime('now', ?) AND problemas IS NOT NULL
  `).run(cutoff);
  return { feedbacks: Number(r1.changes), geracoes: Number(r2.changes) };
}
