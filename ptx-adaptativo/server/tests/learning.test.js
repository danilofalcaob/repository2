import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '../src/db.js';
import {
  normalizeText, patternKey, contextKey, detectSyndromes,
  score, buildKnowledge, recordFeedback,
} from '../src/learning.js';

describe('normalização e chaves', () => {
  it('remove acentos e pontuação', () => {
    expect(normalizeText('Transição EV→VO até amanhã!')).toBe('transicao ev vo ate amanha');
  });

  it('patternKey agrupa formulações semelhantes', () => {
    const a = patternKey('profilaxias', 'Profilaxia de TEV com enoxaparina 40mg');
    const b = patternKey('profilaxias', 'Enoxaparina 40mg para profilaxia de TEV');
    expect(a).toBe(b);
  });

  it('detecta síndromes por palavras-chave', () => {
    expect(detectSyndromes(['Pneumonia comunitária grave', 'DM2'])).toContain('pneumonia');
    expect(detectSyndromes(['ICC descompensada perfil B'])).toContain('icc');
    expect(detectSyndromes(['Sepse de foco urinário'])).toContain('itu_sepse');
  });

  it('contextKey é estável e ordenado', () => {
    expect(contextKey(['Sepse urinária', 'Pneumonia aspirativa'])).toBe('itu_sepse+pneumonia');
    expect(contextKey(['Pneumonia', 'sepse'])).toBe('itu_sepse+pneumonia');
  });

  it('contextKey tem fallback sem síndrome conhecida', () => {
    expect(contextKey(['Lombalgia mecânica aguda'])).toMatch(/^outro:/);
    expect(contextKey([])).toBe('outro');
  });
});

describe('score adaptativo (Beta/Thompson simplificado)', () => {
  it('começa neutro em 0.5', () => {
    expect(score({ accepted: 0, rejected: 0, modified: 0 })).toBe(0.5);
  });
  it('cresce com aceitações e cai com rejeições', () => {
    expect(score({ accepted: 8, rejected: 0, modified: 0 })).toBeGreaterThan(0.85);
    expect(score({ accepted: 0, rejected: 8, modified: 0 })).toBeLessThan(0.15);
  });
  it('modificação conta como meio termo', () => {
    const s = score({ accepted: 0, rejected: 0, modified: 4 });
    expect(s).toBeCloseTo(0.5, 5);
  });
});

describe('feedback → pattern_stats → conhecimento injetado', () => {
  let db;
  beforeEach(() => {
    db = createDb(':memory:');
    db.createUser({ email: 'a@a.com', name: 'A', passwordHash: 'x', role: 'admin' });
  });

  const fb = (decision, motivo = '') => ({
    suggestionId: null,
    userId: 1,
    decision,
    motivo,
    editedText: '',
    categoria: 'profilaxias',
    item: 'Profilaxia de TEV com enoxaparina',
    patternKey: patternKey('profilaxias', 'Profilaxia de TEV com enoxaparina'),
    contextKey: 'pneumonia',
    sector: 'enfermaria',
  });

  it('persiste feedback e atualiza contadores', () => {
    recordFeedback(db, fb('conforme'));
    recordFeedback(db, fb('conforme'));
    recordFeedback(db, fb('nao_conforme', 'redundante'));
    const stat = db.getPatternStat(fb('x').patternKey, 'pneumonia', 'enfermaria');
    expect(stat.accepted).toBe(2);
    expect(stat.rejected).toBe(1);
    expect(JSON.parse(stat.motivos_json)).toEqual({ redundante: 1 });
  });

  it('padrões bem aceitos entram em "reforcar" no conhecimento', () => {
    for (let i = 0; i < 4; i++) recordFeedback(db, fb('conforme'));
    const k = buildKnowledge(db, 'pneumonia', 'enfermaria');
    expect(k.reforcar).toHaveLength(1);
    expect(k.reforcar[0].item).toMatch(/enoxaparina/);
    expect(k.evitar).toHaveLength(0);
  });

  it('padrões rejeitados entram em "evitar" com motivos', () => {
    for (let i = 0; i < 4; i++) recordFeedback(db, fb('nao_conforme', 'nao disponivel no servico'));
    const k = buildKnowledge(db, 'pneumonia', 'enfermaria');
    expect(k.evitar).toHaveLength(1);
    expect(k.evitar[0].motivos).toContain('nao disponivel no servico');
  });

  it('exige mínimo de 2 observações antes de influenciar', () => {
    recordFeedback(db, fb('conforme'));
    const k = buildKnowledge(db, 'pneumonia', 'enfermaria');
    expect(k.reforcar).toHaveLength(0);
  });

  it('regras ativas do admin entram no conhecimento', () => {
    db.createRule({ tipo: 'evitar', texto: 'Não sugerir X; o serviço usa Y', contexto: '', createdBy: 1 });
    db.createRule({ tipo: 'preferir', texto: 'Regra inativa', contexto: '', createdBy: 1 });
    db.updateRule(2, { ativo: false });
    const k = buildKnowledge(db, 'pneumonia', 'enfermaria');
    expect(k.regras).toHaveLength(1);
    expect(k.regras[0].texto).toMatch(/serviço usa Y/);
  });

  it('modificação com texto editado atualiza o exemplo do padrão', () => {
    recordFeedback(db, { ...fb('modificado'), editedText: 'Enoxaparina 60mg (obesidade)' });
    const stat = db.getPatternStat(fb('x').patternKey, 'pneumonia', 'enfermaria');
    expect(stat.modified).toBe(1);
    expect(stat.item_exemplo).toBe('Enoxaparina 60mg (obesidade)');
  });
});

describe('expurgo LGPD', () => {
  it('anonimiza texto clínico antigo preservando agregados', () => {
    const db = createDb(':memory:');
    db.createUser({ email: 'a@a.com', name: 'A', passwordHash: 'x', role: 'admin' });
    const genId = db.createGeneration({
      userId: 1, contextKey: 'pneumonia', sector: '', problems: ['Pneumonia lobar'], mode: 'novo',
    });
    // envelhece o registro artificialmente
    db.raw.prepare("UPDATE generations SET created_at = datetime('now', '-100 days') WHERE id = ?").run(genId);
    const result = db.purgeClinicalText(90);
    expect(result.generations).toBe(1);
    const row = db.raw.prepare('SELECT problems_json FROM generations WHERE id = ?').get(genId);
    expect(row.problems_json).toBe('[]');
  });
});
