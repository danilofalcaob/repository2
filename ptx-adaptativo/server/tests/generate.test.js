import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '../src/db.js';
import { runSeed } from '../src/seed.js';
import { buildUserPrompt, generatePlan, SYSTEM_PROMPT } from '../src/ai.js';
import { buildKnowledge, contextKey, detectSyndromes, patternKey, recordFeedback } from '../src/learning.js';

describe('construção do prompt', () => {
  let db;
  beforeEach(() => {
    db = createDb(':memory:');
    runSeed(db);
    db.createUser({ email: 'a@a.com', name: 'A', passwordHash: 'x', role: 'admin' });
  });

  const input = {
    problems: ['Pneumonia comunitária'],
    hpma: '',
    evolution: 'Afebril há 24h, SpO2 94% com O2 2L',
    existingPlan: '',
    diasInternacao: '3',
    setor: 'enfermaria',
    dispositivos: '',
    dieta: 'oral',
    oxigenio: 'cateter 2L',
  };

  it('inclui dados do paciente e seed da síndrome', () => {
    const seedItems = db.seedForSyndromes(detectSyndromes(input.problems));
    const prompt = buildUserPrompt(input, buildKnowledge(db, 'pneumonia', 'enfermaria'), seedItems);
    expect(prompt).toContain('Pneumonia comunitária');
    expect(prompt).toContain('Dias de internação: 3');
    expect(prompt).toContain('ITENS TÍPICOS DO SERVIÇO');
    expect(prompt).toContain('EV→VO');
    expect(prompt).toContain('modo "novo"');
  });

  it('injeta padrões rejeitados com motivos no prompt', () => {
    const pk = patternKey('dieta/nutricao', 'Dieta hipossódica rigorosa');
    for (let i = 0; i < 3; i++) {
      recordFeedback(db, {
        suggestionId: null, userId: 1, decision: 'nao_conforme',
        motivo: 'logistica inviavel', editedText: '',
        categoria: 'dieta/nutricao', item: 'Dieta hipossódica rigorosa',
        patternKey: pk, contextKey: 'pneumonia', sector: 'enfermaria',
      });
    }
    const prompt = buildUserPrompt(input, buildKnowledge(db, 'pneumonia', 'enfermaria'), []);
    expect(prompt).toContain('RECORRENTEMENTE REJEITADOS');
    expect(prompt).toContain('logistica inviavel');
  });

  it('modo complemento instrui análise de lacunas sem duplicação', () => {
    const prompt = buildUserPrompt(
      { ...input, existingPlan: 'ATB EV, dieta oral' },
      buildKnowledge(db, 'pneumonia', ''),
      []
    );
    expect(prompt).toContain('modo "complemento"');
    expect(prompt).toContain('não duplique');
  });

  it('system prompt deixa claro que é apoio à decisão', () => {
    expect(SYSTEM_PROMPT).toMatch(/APOIO À DECISÃO/);
    expect(SYSTEM_PROMPT).toMatch(/conduta final é sempre do médico/i);
  });
});

describe('generatePlan com mock da API', () => {
  const mockResponse = (text) => ({
    createMessage: async () => ({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text }],
    }),
  });

  const input = {
    problems: ['ICC descompensada'], hpma: '', evolution: 'Congesto',
    existingPlan: '', diasInternacao: '', setor: '', dispositivos: '', dieta: '', oxigenio: '',
  };
  const emptyKnowledge = { reforcar: [], evitar: [], regras: [] };

  it('gera plano normalizado a partir de JSON com cercas', async () => {
    const raw = '```json\n' + JSON.stringify({
      modo: 'novo',
      objetivo_internacao: 'Compensar ICC',
      itens: [{ categoria: 'terapeutica medicamentosa', item: 'Furosemida EV', meta: 'BH -500mL/dia', prioridade: 'alta' }],
      criterios_alta: ['Peso seco'], dpa: 'D+5',
    }) + '\n```';
    const plan = await generatePlan(input, emptyKnowledge, [], mockResponse(raw));
    expect(plan.itens).toHaveLength(1);
    expect(plan.itens[0].meta).toBe('BH -500mL/dia');
    expect(plan.dpa).toBe('D+5');
  });

  it('propaga erro claro quando o modelo não retorna JSON', async () => {
    await expect(
      generatePlan(input, emptyKnowledge, [], mockResponse('desculpe, não posso'))
    ).rejects.toThrow(/Não foi possível interpretar/);
  });

  it('trata recusa do modelo', async () => {
    const deps = { createMessage: async () => ({ stop_reason: 'refusal', content: [] }) };
    await expect(generatePlan(input, emptyKnowledge, [], deps)).rejects.toThrow(/recusou/);
  });
});
