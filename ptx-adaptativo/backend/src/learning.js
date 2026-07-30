// Aprendizado adaptativo pragmático:
// - cada feedback atualiza contadores (aceitos/modificados/rejeitados) e uma
//   média móvel exponencial (EWMA) por padrão de item + categoria + setor;
// - a taxa de aceitação usa suavização de Laplace (prior Beta(1,1)), no espírito
//   de um Thompson sampling simplificado: itens com pouca evidência ficam
//   próximos de 0,5 e só "aprendem" com volume;
// - a cada geração, um resumo do conhecimento do serviço (itens bem aceitos,
//   itens rejeitados com motivos e regras aprovadas) é injetado no prompt.
import {
  obterScore, salvarScore, listarScores, listarRegras, listarConhecimento,
} from './db.js';

const EWMA_ALFA = 0.3;
const VALOR_DECISAO = { conforme: 1, aceito_modificado: 0.5, nao_conforme: 0 };

// Normaliza o texto do item para agrupar variações do mesmo padrão:
// minúsculas, sem acentos, sem pontuação, sem números/doses, espaços colapsados.
export function normalizarItem(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\d+([.,]\d+)?\s*(mg|mcg|g|ml|ui|l\/min|lpm|mg\/kg|x\/dia|h)?/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 10)
    .join(' ');
}

export function taxaAceitacao(score) {
  // Laplace: (aceitos + 0,5*modificados + 1) / (n + 2)
  const n = score.aceitos + score.modificados + score.rejeitados;
  return (score.aceitos + 0.5 * score.modificados + 1) / (n + 2);
}

export function aplicarFeedbackAoScore({ categoria, item, setor, decisao, motivo }) {
  const itemNorm = normalizarItem(item);
  if (!itemNorm) return null;
  const setorNorm = (setor ?? '').trim().toLowerCase();
  const atual = obterScore(categoria, itemNorm, setorNorm) ?? {
    categoria, item_norm: itemNorm, item_exemplo: item, setor: setorNorm,
    aceitos: 0, modificados: 0, rejeitados: 0, ewma: 0.5, motivos: '[]',
  };

  if (decisao === 'conforme') atual.aceitos += 1;
  else if (decisao === 'aceito_modificado') atual.modificados += 1;
  else if (decisao === 'nao_conforme') atual.rejeitados += 1;

  atual.ewma = EWMA_ALFA * (VALOR_DECISAO[decisao] ?? 0.5) + (1 - EWMA_ALFA) * atual.ewma;
  atual.item_exemplo = item;

  if (decisao === 'nao_conforme' && motivo?.trim()) {
    const motivos = JSON.parse(atual.motivos);
    motivos.push(motivo.trim());
    atual.motivos = JSON.stringify(motivos.slice(-5));
  }

  salvarScore(atual);
  return { ...atual, taxa: taxaAceitacao(atual) };
}

const MIN_EVIDENCIA = 2; // nº mínimo de feedbacks para o padrão entrar no prompt

// Monta o bloco de "conhecimento do serviço" injetado no prompt da IA.
export function resumoConhecimentoAprendido({ setor } = {}) {
  const scores = listarScores({ setor: (setor ?? '').trim().toLowerCase() || null })
    .map((s) => ({ ...s, n: s.aceitos + s.modificados + s.rejeitados, taxa: taxaAceitacao(s) }))
    .filter((s) => s.n >= MIN_EVIDENCIA);

  const bemAceitos = scores
    .filter((s) => s.taxa >= 0.7)
    .sort((a, b) => b.taxa - a.taxa || b.n - a.n)
    .slice(0, 12);

  const rejeitados = scores
    .filter((s) => s.taxa <= 0.35)
    .sort((a, b) => a.taxa - b.taxa || b.n - a.n)
    .slice(0, 12);

  const regras = listarRegras({ apenasAtivas: true });

  const linhas = [];
  if (regras.length) {
    linhas.push('REGRAS DO SERVIÇO (aprovadas pelo administrador — cumpra sempre):');
    for (const r of regras) linhas.push(`- [${r.tipo}] ${r.texto}`);
  }
  if (bemAceitos.length) {
    linhas.push('\nPADRÕES HISTORICAMENTE BEM ACEITOS neste serviço (priorize e reforce):');
    for (const s of bemAceitos) {
      linhas.push(`- (${s.categoria}${s.setor ? `, setor ${s.setor}` : ''}) "${s.item_exemplo}" — aceitação ${(s.taxa * 100).toFixed(0)}% em ${s.n} avaliações`);
    }
  }
  if (rejeitados.length) {
    linhas.push('\nPADRÕES RECORRENTEMENTE REJEITADOS neste serviço (evite ou adapte):');
    for (const s of rejeitados) {
      const motivos = JSON.parse(s.motivos);
      linhas.push(`- (${s.categoria}${s.setor ? `, setor ${s.setor}` : ''}) "${s.item_exemplo}" — rejeição ${((1 - s.taxa) * 100).toFixed(0)}% em ${s.n} avaliações${motivos.length ? `; motivos: ${motivos.join('; ')}` : ''}`);
    }
  }
  return linhas.join('\n');
}

// Seleciona itens da base de conhecimento seed cujas palavras-chave aparecem
// nos problemas/evolução informados.
export function conhecimentoSeedRelevante(textoCaso) {
  const texto = String(textoCaso ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const relevantes = [];
  for (const c of listarConhecimento()) {
    const chaves = JSON.parse(c.palavras_chave);
    if (chaves.some((k) => texto.includes(k))) relevantes.push(c);
  }
  if (!relevantes.length) return '';
  const porSindrome = new Map();
  for (const c of relevantes) {
    if (!porSindrome.has(c.sindrome)) porSindrome.set(c.sindrome, []);
    porSindrome.get(c.sindrome).push(c);
  }
  const linhas = ['ITENS TÍPICOS PARA AS SÍNDROMES IDENTIFICADAS (adapte ao caso; não copie cegamente):'];
  for (const [sindrome, itens] of porSindrome) {
    linhas.push(`\n${sindrome}:`);
    for (const c of itens) linhas.push(`- (${c.categoria}) ${c.item}${c.meta ? ` | meta: ${c.meta}` : ''}`);
  }
  return linhas.join('\n');
}
