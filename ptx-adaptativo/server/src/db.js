/**
 * Camada de acesso a dados (SQLite via better-sqlite3).
 *
 * Todas as consultas SQL vivem neste módulo, atrás de funções nomeadas —
 * migrar para PostgreSQL depois significa reimplementar apenas este arquivo
 * (mesma assinatura de funções), sem tocar em rotas ou lógica de negócio.
 */
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'medico',      -- 'medico' | 'admin'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL
);

-- Uma geração de plano. Guarda apenas o contexto clínico mínimo
-- (lista de problemas, sem identificadores do paciente).
CREATE TABLE IF NOT EXISTS generations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  context_key TEXT NOT NULL,
  sector TEXT,
  problems_json TEXT NOT NULL DEFAULT '[]',
  mode TEXT NOT NULL DEFAULT 'novo',        -- 'novo' | 'complemento'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  generation_id INTEGER NOT NULL REFERENCES generations(id),
  categoria TEXT NOT NULL,
  item TEXT NOT NULL,
  meta TEXT,
  justificativa TEXT,
  prioridade TEXT,
  pattern_key TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  suggestion_id INTEGER REFERENCES suggestions(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  decision TEXT NOT NULL,                   -- 'conforme' | 'nao_conforme' | 'modificado'
  motivo TEXT,
  edited_text TEXT,
  categoria TEXT NOT NULL,
  item TEXT NOT NULL,
  pattern_key TEXT NOT NULL,
  context_key TEXT NOT NULL,
  sector TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Agregados de aprendizado por padrão de item + contexto + setor.
-- Sobrevive ao expurgo (não contém texto clínico do paciente).
CREATE TABLE IF NOT EXISTS pattern_stats (
  pattern_key TEXT NOT NULL,
  context_key TEXT NOT NULL,
  sector TEXT NOT NULL DEFAULT '',
  categoria TEXT NOT NULL,
  item_exemplo TEXT NOT NULL,
  accepted INTEGER NOT NULL DEFAULT 0,
  modified INTEGER NOT NULL DEFAULT 0,
  rejected INTEGER NOT NULL DEFAULT 0,
  motivos_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (pattern_key, context_key, sector)
);

-- Regras aprendidas/aprovadas pelo administrador, injetadas no prompt.
CREATE TABLE IF NOT EXISTS rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL,                        -- 'evitar' | 'preferir'
  texto TEXT NOT NULL,
  contexto TEXT NOT NULL DEFAULT '',         -- '' = todos os contextos
  ativo INTEGER NOT NULL DEFAULT 1,
  origem TEXT NOT NULL DEFAULT 'manual',     -- 'manual' | 'aprendida'
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Base de conhecimento inicial por síndrome (seed).
CREATE TABLE IF NOT EXISTS seed_knowledge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  syndrome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  item TEXT NOT NULL,
  meta TEXT,
  justificativa TEXT,
  prioridade TEXT NOT NULL DEFAULT 'media'
);

CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_pattern ON feedback(pattern_key, context_key);
CREATE INDEX IF NOT EXISTS idx_suggestions_gen ON suggestions(generation_id);
`;

export function createDb(dbPath) {
  const resolved =
    dbPath ||
    process.env.DATABASE_PATH ||
    path.join(__dirname, '..', 'data', 'ptx.db');
  if (resolved !== ':memory:') {
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
  }
  const sqlite = new Database(resolved);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(SCHEMA);

  return {
    raw: sqlite,

    // ---------- usuários e sessões ----------
    countUsers: () => sqlite.prepare('SELECT COUNT(*) c FROM users').get().c,
    createUser: ({ email, name, passwordHash, role }) =>
      sqlite
        .prepare(
          'INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)'
        )
        .run(email.toLowerCase().trim(), name.trim(), passwordHash, role)
        .lastInsertRowid,
    findUserByEmail: (email) =>
      sqlite
        .prepare('SELECT * FROM users WHERE email = ?')
        .get(email.toLowerCase().trim()),
    findUserById: (id) =>
      sqlite.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(id),
    createSession: (token, userId, expiresAt) =>
      sqlite
        .prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
        .run(token, userId, expiresAt),
    findSession: (token) =>
      sqlite
        .prepare(
          `SELECT s.token, s.expires_at, u.id, u.email, u.name, u.role
           FROM sessions s JOIN users u ON u.id = s.user_id
           WHERE s.token = ? AND s.expires_at > datetime('now')`
        )
        .get(token),
    deleteSession: (token) =>
      sqlite.prepare('DELETE FROM sessions WHERE token = ?').run(token),

    // ---------- gerações e sugestões ----------
    createGeneration: ({ userId, contextKey, sector, problems, mode }) =>
      sqlite
        .prepare(
          `INSERT INTO generations (user_id, context_key, sector, problems_json, mode)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(userId, contextKey, sector || '', JSON.stringify(problems), mode)
        .lastInsertRowid,
    createSuggestion: ({ generationId, categoria, item, meta, justificativa, prioridade, patternKey }) =>
      sqlite
        .prepare(
          `INSERT INTO suggestions (generation_id, categoria, item, meta, justificativa, prioridade, pattern_key)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(generationId, categoria, item, meta || '', justificativa || '', prioridade || 'media', patternKey)
        .lastInsertRowid,
    findSuggestion: (id) =>
      sqlite
        .prepare(
          `SELECT s.*, g.context_key, g.sector FROM suggestions s
           JOIN generations g ON g.id = s.generation_id WHERE s.id = ?`
        )
        .get(id),

    // ---------- feedback ----------
    createFeedback: (f) =>
      sqlite
        .prepare(
          `INSERT INTO feedback
             (suggestion_id, user_id, decision, motivo, edited_text,
              categoria, item, pattern_key, context_key, sector)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          f.suggestionId || null,
          f.userId,
          f.decision,
          f.motivo || '',
          f.editedText || '',
          f.categoria,
          f.item,
          f.patternKey,
          f.contextKey,
          f.sector || ''
        ).lastInsertRowid,

    getPatternStat: (patternKey, contextKey, sector) =>
      sqlite
        .prepare(
          'SELECT * FROM pattern_stats WHERE pattern_key = ? AND context_key = ? AND sector = ?'
        )
        .get(patternKey, contextKey, sector || ''),

    upsertPatternStat: ({ patternKey, contextKey, sector, categoria, itemExemplo, decision, motivo }) => {
      const existing = sqlite
        .prepare(
          'SELECT * FROM pattern_stats WHERE pattern_key = ? AND context_key = ? AND sector = ?'
        )
        .get(patternKey, contextKey, sector || '');
      const motivos = existing ? JSON.parse(existing.motivos_json) : {};
      if (decision === 'nao_conforme' && motivo) {
        motivos[motivo] = (motivos[motivo] || 0) + 1;
      }
      const col =
        decision === 'conforme' ? 'accepted' : decision === 'modificado' ? 'modified' : 'rejected';
      if (existing) {
        sqlite
          .prepare(
            `UPDATE pattern_stats SET ${col} = ${col} + 1, motivos_json = ?, updated_at = datetime('now')
             WHERE pattern_key = ? AND context_key = ? AND sector = ?`
          )
          .run(JSON.stringify(motivos), patternKey, contextKey, sector || '');
      } else {
        sqlite
          .prepare(
            `INSERT INTO pattern_stats
               (pattern_key, context_key, sector, categoria, item_exemplo, ${col}, motivos_json)
             VALUES (?, ?, ?, ?, ?, 1, ?)`
          )
          .run(patternKey, contextKey, sector || '', categoria, itemExemplo, JSON.stringify(motivos));
      }
    },

    listPatternStats: ({ contextKey, sector } = {}) => {
      if (contextKey !== undefined) {
        return sqlite
          .prepare(
            `SELECT * FROM pattern_stats
             WHERE context_key IN (?, '') AND sector IN (?, '')
             ORDER BY (accepted + modified + rejected) DESC`
          )
          .all(contextKey, sector || '');
      }
      return sqlite
        .prepare('SELECT * FROM pattern_stats ORDER BY (accepted + modified + rejected) DESC')
        .all();
    },

    // ---------- dashboard ----------
    feedbackSummary: () =>
      sqlite
        .prepare(
          `SELECT decision, COUNT(*) c FROM feedback GROUP BY decision`
        )
        .all(),
    feedbackByCategory: () =>
      sqlite
        .prepare(
          `SELECT categoria, decision, COUNT(*) c FROM feedback GROUP BY categoria, decision`
        )
        .all(),
    feedbackOverTime: () =>
      sqlite
        .prepare(
          `SELECT strftime('%Y-W%W', created_at) week, decision, COUNT(*) c
           FROM feedback GROUP BY week, decision ORDER BY week`
        )
        .all(),
    topMotivos: () =>
      sqlite
        .prepare(
          `SELECT motivo, COUNT(*) c FROM feedback
           WHERE decision = 'nao_conforme' AND motivo != ''
           GROUP BY motivo ORDER BY c DESC LIMIT 10`
        )
        .all(),

    // ---------- regras ----------
    listRules: (onlyActive = false) =>
      sqlite
        .prepare(
          `SELECT * FROM rules ${onlyActive ? 'WHERE ativo = 1' : ''} ORDER BY created_at DESC`
        )
        .all(),
    createRule: ({ tipo, texto, contexto, origem, createdBy }) =>
      sqlite
        .prepare(
          `INSERT INTO rules (tipo, texto, contexto, origem, created_by) VALUES (?, ?, ?, ?, ?)`
        )
        .run(tipo, texto, contexto || '', origem || 'manual', createdBy || null).lastInsertRowid,
    updateRule: (id, { ativo, texto, tipo, contexto }) =>
      sqlite
        .prepare(
          `UPDATE rules SET
             ativo = COALESCE(?, ativo),
             texto = COALESCE(?, texto),
             tipo = COALESCE(?, tipo),
             contexto = COALESCE(?, contexto)
           WHERE id = ?`
        )
        .run(ativo === undefined ? null : ativo ? 1 : 0, texto ?? null, tipo ?? null, contexto ?? null, id),
    deleteRule: (id) => sqlite.prepare('DELETE FROM rules WHERE id = ?').run(id),

    // ---------- seed ----------
    countSeed: () => sqlite.prepare('SELECT COUNT(*) c FROM seed_knowledge').get().c,
    insertSeed: (s) =>
      sqlite
        .prepare(
          `INSERT INTO seed_knowledge (syndrome, categoria, item, meta, justificativa, prioridade)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(s.syndrome, s.categoria, s.item, s.meta || '', s.justificativa || '', s.prioridade || 'media'),
    seedForSyndromes: (syndromes) => {
      if (!syndromes.length) return [];
      const placeholders = syndromes.map(() => '?').join(',');
      return sqlite
        .prepare(`SELECT * FROM seed_knowledge WHERE syndrome IN (${placeholders})`)
        .all(...syndromes);
    },

    // ---------- anonimização / expurgo (LGPD) ----------
    purgeClinicalText: (olderThanDays) => {
      const g = sqlite
        .prepare(
          `UPDATE generations SET problems_json = '[]'
           WHERE created_at < datetime('now', ?) AND problems_json != '[]'`
        )
        .run(`-${olderThanDays} days`);
      const f = sqlite
        .prepare(
          `UPDATE feedback SET edited_text = ''
           WHERE created_at < datetime('now', ?) AND edited_text != ''`
        )
        .run(`-${olderThanDays} days`);
      return { generations: g.changes, feedback: f.changes };
    },

    close: () => sqlite.close(),
  };
}

let defaultDb = null;
export function getDb() {
  if (!defaultDb) defaultDb = createDb();
  return defaultDb;
}
