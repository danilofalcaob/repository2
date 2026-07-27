/*
 * Time Sepse App — base das funções serverless (Vercel + Postgres).
 * O estado da equipe fica numa única linha JSONB, com controle de versão
 * para evitar que dois aparelhos gravem por cima um do outro.
 */
'use strict';

const { Pool } = require('pg');
const ACOES = require('../js/acoes.js');

let pool;

function obterPool() {
  if (!pool) {
    const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!url) throw new Error('Defina POSTGRES_URL (ou DATABASE_URL) nas variáveis de ambiente.');
    pool = new Pool({
      connectionString: url,
      max: 1,
      ssl: url.includes('localhost') ? false : { rejectUnauthorized: false }
    });
  }
  return pool;
}

async function garantirTabela(cliente) {
  await cliente.query(
    'CREATE TABLE IF NOT EXISTS time_sepse_estado (' +
    'id INT PRIMARY KEY, versao BIGINT NOT NULL, dados JSONB NOT NULL)'
  );
}

async function carregar(cliente) {
  const resultado = await cliente.query('SELECT versao, dados FROM time_sepse_estado WHERE id = 1');
  if (!resultado.rows.length) {
    const inicial = ACOES.estadoInicial();
    await cliente.query(
      'INSERT INTO time_sepse_estado (id, versao, dados) VALUES (1, 1, $1) ON CONFLICT (id) DO NOTHING',
      [JSON.stringify(inicial)]
    );
    return { versao: 1, estado: inicial };
  }
  return { versao: Number(resultado.rows[0].versao), estado: resultado.rows[0].dados };
}

function pinValido(req, res) {
  const pin = process.env.TIME_SEPSE_PIN || '';
  if (!pin) return true;
  if ((req.headers['x-time-sepse-pin'] || '') === pin) return true;
  res.status(401).json({ erro: 'pin_necessario' });
  return false;
}

module.exports = { obterPool, garantirTabela, carregar, pinValido, ACOES };
