import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDb, closeDb, criarRegra, inserirConhecimento, obterScore } from '../src/db.js';
import {
  normalizarItem, aplicarFeedbackAoScore, taxaAceitacao,
  resumoConhecimentoAprendido, conhecimentoSeedRelevante,
} from '../src/learning.js';

beforeEach(() => openDb(':memory:'));
afterEach(() => closeDb());

describe('normalizarItem', () => {
  it('agrupa variações do mesmo item (acentos, doses, pontuação)', () => {
    const a = normalizarItem('Transição de antibiótico EV→VO (ceftriaxona 2g)');
    const b = normalizarItem('transicao de antibiotico EV VO ceftriaxona 1g!');
    expect(a).toBe(b);
    expect(a).toContain('transicao de antibiotico');
  });
  it('retorna vazio para entrada vazia', () => {
    expect(normalizarItem('')).toBe('');
    expect(normalizarItem(null)).toBe('');
  });
});

describe('aplicarFeedbackAoScore', () => {
  const base = { categoria: 'dispositivos', item: 'Retirar SVD precocemente', setor: 'enfermaria' };

  it('cria score e atualiza contadores e EWMA', () => {
    const s1 = aplicarFeedbackAoScore({ ...base, decisao: 'conforme' });
    expect(s1.aceitos).toBe(1);
    expect(s1.ewma).toBeGreaterThan(0.5);

    const s2 = aplicarFeedbackAoScore({ ...base, decisao: 'nao_conforme', motivo: 'não disponível no serviço' });
    expect(s2.rejeitados).toBe(1);
    expect(JSON.parse(s2.motivos)).toContain('não disponível no serviço');
  });

  it('persiste no banco por (categoria, item_norm, setor)', () => {
    aplicarFeedbackAoScore({ ...base, decisao: 'conforme' });
    aplicarFeedbackAoScore({ ...base, decisao: 'aceito_modificado' });
    const row = obterScore('dispositivos', normalizarItem(base.item), 'enfermaria');
    expect(row.aceitos).toBe(1);
    expect(row.modificados).toBe(1);
  });

  it('taxa usa suavização de Laplace (pouca evidência ≈ 0,5)', () => {
    const s = aplicarFeedbackAoScore({ ...base, decisao: 'conforme' });
    // 1 aceite: (1+1)/(1+2) = 0,667 — não dispara para 1,0
    expect(taxaAceitacao(s)).toBeCloseTo(2 / 3, 5);
  });
});

describe('resumoConhecimentoAprendido', () => {
  it('inclui regras ativas e padrões com evidência mínima', () => {
    criarRegra({ tipo: 'evitar', texto: 'Não sugerir levofloxacino; o serviço usa amoxicilina-clavulanato.' });
    const fb = { categoria: 'terapêutica medicamentosa', item: 'Levofloxacino 750mg VO', setor: 'enfermaria' };
    aplicarFeedbackAoScore({ ...fb, decisao: 'nao_conforme', motivo: 'não disponível no serviço' });
    aplicarFeedbackAoScore({ ...fb, decisao: 'nao_conforme', motivo: 'não disponível no serviço' });
    aplicarFeedbackAoScore({ ...fb, decisao: 'nao_conforme' });

    const ok = { categoria: 'mobilidade', item: 'Deambulação precoce 2x/dia', setor: 'enfermaria' };
    aplicarFeedbackAoScore({ ...ok, decisao: 'conforme' });
    aplicarFeedbackAoScore({ ...ok, decisao: 'conforme' });
    aplicarFeedbackAoScore({ ...ok, decisao: 'conforme' });

    const resumo = resumoConhecimentoAprendido({ setor: 'enfermaria' });
    expect(resumo).toContain('REGRAS DO SERVIÇO');
    expect(resumo).toContain('amoxicilina-clavulanato');
    expect(resumo).toContain('REJEITADOS');
    expect(resumo).toContain('Levofloxacino');
    expect(resumo).toContain('não disponível no serviço');
    expect(resumo).toContain('BEM ACEITOS');
    expect(resumo).toContain('Deambulação');
  });

  it('ignora padrões com evidência insuficiente', () => {
    aplicarFeedbackAoScore({ categoria: 'dispositivos', item: 'Retirar CVC', setor: '', decisao: 'conforme' });
    expect(resumoConhecimentoAprendido({})).toBe('');
  });
});

describe('conhecimentoSeedRelevante', () => {
  it('ativa itens pela palavra-chave da síndrome', () => {
    inserirConhecimento({
      sindrome: 'Pneumonia', palavrasChave: ['pneumonia'], categoria: 'dispositivos',
      item: 'Desmame de O2', meta: 'SpO2 ≥ 92% em ar ambiente',
    });
    const r = conhecimentoSeedRelevante('Paciente com pneumonia comunitária em D2');
    expect(r).toContain('Pneumonia');
    expect(r).toContain('Desmame de O2');
    expect(conhecimentoSeedRelevante('Cetoacidose diabética')).toBe('');
  });
});
