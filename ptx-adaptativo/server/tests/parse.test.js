import { describe, it, expect } from 'vitest';
import { parseModelJson, normalizePlan } from '../src/parse.js';

describe('parseModelJson (tolerância a falhas)', () => {
  it('interpreta JSON puro', () => {
    expect(parseModelJson('{"a": 1}')).toEqual({ a: 1 });
  });

  it('remove cercas de markdown', () => {
    expect(parseModelJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it('ignora texto antes e depois do objeto', () => {
    expect(parseModelJson('Aqui está o plano:\n{"a": 1}\nEspero que ajude!')).toEqual({ a: 1 });
  });

  it('tolera vírgulas finais', () => {
    expect(parseModelJson('{"itens": [1, 2,],}')).toEqual({ itens: [1, 2] });
  });

  it('lança erro claro para resposta não-JSON', () => {
    expect(() => parseModelJson('não consigo gerar')).toThrow(/Não foi possível interpretar/);
  });

  it('lança erro para resposta vazia', () => {
    expect(() => parseModelJson(null)).toThrow(/vazia/);
  });
});

describe('normalizePlan', () => {
  it('normaliza estrutura completa', () => {
    const plan = normalizePlan({
      modo: 'novo',
      objetivo_internacao: 'Tratar pneumonia',
      itens: [
        { categoria: 'profilaxias', item: 'Enoxaparina 40mg SC', meta: 'Desde D1', prioridade: 'ALTA' },
      ],
      criterios_alta: ['Afebril 48h'],
      dpa: 'D+4',
    });
    expect(plan.itens).toHaveLength(1);
    expect(plan.itens[0].prioridade).toBe('alta');
    expect(plan.criterios_alta).toEqual(['Afebril 48h']);
  });

  it('descarta itens sem texto e usa defaults seguros', () => {
    const plan = normalizePlan({
      itens: [{ item: '' }, null, { item: 'X', categoria: 'inexistente', prioridade: 'urgente' }],
    });
    expect(plan.itens).toHaveLength(1);
    expect(plan.itens[0].categoria).toBe('terapeutica medicamentosa');
    expect(plan.itens[0].prioridade).toBe('media');
    expect(plan.modo).toBe('novo');
  });

  it('reconhece modo complemento e lacunas', () => {
    const plan = normalizePlan({ modo: 'complemento', lacunas: ['Sem critérios de alta'], itens: [] });
    expect(plan.modo).toBe('complemento');
    expect(plan.lacunas).toEqual(['Sem critérios de alta']);
  });
});
