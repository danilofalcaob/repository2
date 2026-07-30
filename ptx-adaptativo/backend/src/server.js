// Entrada do servidor: abre o banco, roda seed idempotente, agenda o expurgo
// LGPD e sobe o Express (que também serve o frontend buildado, se existir).
import { openDb, expurgarDadosClinicos } from './db.js';
import { executarSeed } from './seed.js';
import { criarApp } from './app.js';

const PORTA = Number(process.env.PORT ?? 3001);
const RETENCAO_DIAS = Number(process.env.PTX_RETENCAO_DIAS ?? 90);

openDb();
const seed = executarSeed();
if (seed.conhecimento) console.log(`[seed] ${seed.conhecimento} itens de conhecimento inseridos.`);
if (seed.admin) console.log('[seed] usuário admin criado (admin@ptx.local — troque a senha padrão!).');

// Expurgo LGPD: na subida e a cada 24h.
function rodarExpurgo() {
  const r = expurgarDadosClinicos(RETENCAO_DIAS);
  if (r.feedbacks || r.geracoes) {
    console.log(`[lgpd] expurgo (> ${RETENCAO_DIAS} dias): ${r.feedbacks} feedbacks, ${r.geracoes} gerações anonimizados.`);
  }
}
rodarExpurgo();
setInterval(rodarExpurgo, 24 * 3600 * 1000).unref();

const app = criarApp();
app.listen(PORTA, () => {
  console.log(`PTx Adaptativo — backend em http://localhost:${PORTA}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[aviso] ANTHROPIC_API_KEY não configurada — a geração de sugestões ficará indisponível.');
  }
});
