import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getDb } from './db.js';
import { runSeed } from './seed.js';
import { buildRouter } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;

const db = getDb();
const seeded = runSeed(db);
if (seeded) console.log(`Base de conhecimento inicial: ${seeded} itens inseridos.`);

// Expurgo automático de texto clínico (LGPD) na subida e a cada 24h.
const PURGE_DAYS = Number(process.env.PURGE_DAYS) || 90;
const purge = () => {
  const r = db.purgeClinicalText(PURGE_DAYS);
  if (r.generations || r.feedback) {
    console.log(`Expurgo LGPD (> ${PURGE_DAYS} dias): ${r.generations} gerações, ${r.feedback} feedbacks anonimizados.`);
  }
};
purge();
setInterval(purge, 24 * 60 * 60 * 1000).unref();

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/api', buildRouter(db));

// erros de rotas síncronas/assíncronas
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Erro interno.' });
});

// frontend compilado (produção)
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('AVISO: ANTHROPIC_API_KEY não definida — a geração de planos falhará até configurá-la.');
}

app.listen(PORT, () => {
  console.log(`PTx Adaptativo — backend em http://localhost:${PORT}`);
});
