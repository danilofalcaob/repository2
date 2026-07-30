import { describe, it, expect } from 'vitest';
import { parseRespostaLLM, montarPromptUsuario, CATEGORIAS } from '../src/llm.js';
import { openDb, closeDb } from '../src/db.js';

const RESPOSTA_VALIDA = JSON.stringify({
  modo: 'novo',
  objetivo_internacao: 'Tratar pneumonia comunitária até estabilidade clínica',
  lacunas: [],
  itens: [
    { categoria: 'terapêutica medicamentosa', item: 'Ceftriaxona 2g EV 1x/dia', meta: 'Transição EV→VO quando afebril 48h', justificativa: 'PAC', prioridade: 'alta' },
    { categoria: 'dispositivos', item: 'Desmame de O2', meta: 'SpO2 ≥ 92% em ar ambiente', justificativa: 'Evitar hiperóxia', prioridade: 'média' },
  ],
  criterios_alta: ['Afebril 48h', 'SpO2 ≥ 92% em ar ambiente'],
  dpa_estimada: 'D+3',
  observacao: '',
});

describe('parseRespostaLLM (tolerância a falhas)', () => {
  it('interpreta JSON puro', () => {
    const r = parseRespostaLLM(RESPOSTA_VALIDA);
    expect(r.modo).toBe('novo');
    expect(r.itens).toHaveLength(2);
    expect(r.criterios_alta).toHaveLength(2);
    expect(r.dpa_estimada).toBe('D+3');
  });

  it('interpreta JSON dentro de cerca de código markdown', () => {
    const r = parseRespostaLLM('Aqui está o plano:\n```json\n' + RESPOSTA_VALIDA + '\n```\nEspero que ajude!');
    expect(r).not.toBeNull();
    expect(r.itens).toHaveLength(2);
  });

  it('interpreta JSON com texto ao redor sem cerca', () => {
    const r = parseRespostaLLM('Segue o resultado. ' + RESPOSTA_VALIDA + ' Fim.');
    expect(r).not.toBeNull();
  });

  it('tolera vírgulas sobrando', () => {
    const comVirgula = RESPOSTA_VALIDA.replace('"observacao":""}', '"observacao":"",}');
    const r = parseRespostaLLM(comVirgula);
    expect(r).not.toBeNull();
  });

  it('normaliza categoria desconhecida e prioridade inválida', () => {
    const r = parseRespostaLLM(JSON.stringify({
      modo: 'novo',
      itens: [{ categoria: 'inexistente', item: 'Coletar hemograma', prioridade: 'urgentíssima' }],
    }));
    expect(CATEGORIAS).toContain(r.itens[0].categoria);
    expect(r.itens[0].prioridade).toBe('média');
    expect(r.criterios_alta).toEqual([]);
  });

  it('descarta itens sem texto', () => {
    const r = parseRespostaLLM(JSON.stringify({ modo: 'novo', itens: [{ categoria: 'dispositivos' }, { item: '  ' }, { item: 'Retirar SVD' }] }));
    expect(r.itens).toHaveLength(1);
    expect(r.itens[0].item).toBe('Retirar SVD');
  });

  it('retorna null para resposta sem JSON', () => {
    expect(parseRespostaLLM('Desculpe, não posso ajudar com isso.')).toBeNull();
    expect(parseRespostaLLM('')).toBeNull();
    expect(parseRespostaLLM(null)).toBeNull();
  });

  it('retorna null para JSON irrecuperável', () => {
    expect(parseRespostaLLM('{ "modo": "novo", "itens": [ { quebrado')).toBeNull();
  });
});

describe('montarPromptUsuario', () => {
  it('inclui problemas, evolução, campos estruturados e modo análise', () => {
    openDb(':memory:');
    try {
      const p = montarPromptUsuario({
        problemas: ['Pneumonia comunitária', 'DM2'],
        evolucao: 'Afebril há 24h, mantém O2 2 L/min.',
        hpma: 'Tosse há 5 dias.',
        planoExistente: 'Ceftriaxona D3.',
        diasInternacao: 3,
        setor: 'enfermaria',
        dispositivos: 'AVP',
        dieta: 'branda',
        oxigenio: 'CN 2 L/min',
      });
      expect(p).toContain('Pneumonia comunitária');
      expect(p).toContain('EVOLUÇÃO DO DIA');
      expect(p).toContain('Dias de internação: 3');
      expect(p).toContain('PLANO TERAPÊUTICO JÁ ELABORADO');
      expect(p).toContain('Ceftriaxona D3.');
    } finally {
      closeDb();
    }
  });
});
