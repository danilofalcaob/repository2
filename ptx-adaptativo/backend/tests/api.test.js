// Testes de API de ponta a ponta com LLM mockado (sem chamadas externas).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { openDb, closeDb } from '../src/db.js';
import { executarSeed } from '../src/seed.js';
import { criarApp } from '../src/app.js';

let servidor;
let base;
let tokenAdmin;
let tokenMedico;

const PLANO_FAKE = {
  modo: 'novo',
  objetivo_internacao: 'Tratar pneumonia até estabilidade',
  lacunas: [],
  itens: [
    { categoria: 'terapêutica medicamentosa', item: 'Ceftriaxona 2g EV 1x/dia', meta: 'EV→VO se afebril 48h', justificativa: 'PAC', prioridade: 'alta' },
    { categoria: 'profilaxias', item: 'Enoxaparina 40mg SC 1x/dia', meta: 'Prescrita em D0', justificativa: 'TEV', prioridade: 'alta' },
  ],
  criterios_alta: ['Afebril 48h'],
  dpa_estimada: 'D+3',
  observacao: '',
};

async function api(caminho, { metodo = 'GET', corpo, token } = {}) {
  const r = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: r.status, corpo: await r.json().catch(() => null) };
}

beforeAll(async () => {
  openDb(':memory:');
  executarSeed({ senhaAdmin: 'senha-admin' });
  const app = criarApp({ llm: async () => structuredClone(PLANO_FAKE) });
  await new Promise((resolve) => { servidor = app.listen(0, resolve); });
  base = `http://127.0.0.1:${servidor.address().port}`;

  const admin = await api('/api/auth/login', { metodo: 'POST', corpo: { email: 'admin@ptx.local', senha: 'senha-admin' } });
  tokenAdmin = admin.corpo.token;
  const med = await api('/api/auth/registrar', { metodo: 'POST', corpo: { nome: 'Dra. Ana', email: 'ana@h.com', senha: 'segredo1' } });
  tokenMedico = med.corpo.token;
});

afterAll(async () => {
  await new Promise((resolve) => servidor.close(resolve));
  closeDb();
});

describe('autenticação', () => {
  it('rejeita login inválido e acesso sem token', async () => {
    expect((await api('/api/auth/login', { metodo: 'POST', corpo: { email: 'x@x.com', senha: 'errada' } })).status).toBe(401);
    expect((await api('/api/dashboard')).status).toBe(401);
  });
  it('identifica o usuário autenticado', async () => {
    const r = await api('/api/auth/eu', { token: tokenMedico });
    expect(r.status).toBe(200);
    expect(r.corpo.usuario.papel).toBe('medico');
  });
});

describe('geração de plano', () => {
  it('valida campos obrigatórios', async () => {
    const r = await api('/api/plano/gerar', { metodo: 'POST', token: tokenMedico, corpo: { problemas: [], evolucao: '' } });
    expect(r.status).toBe(400);
  });
  it('gera plano e registra a geração', async () => {
    const r = await api('/api/plano/gerar', {
      metodo: 'POST', token: tokenMedico,
      corpo: { problemas: ['Pneumonia comunitária'], evolucao: 'Afebril há 24h', setor: 'enfermaria' },
    });
    expect(r.status).toBe(200);
    expect(r.corpo.geracaoId).toBeGreaterThan(0);
    expect(r.corpo.plano.itens).toHaveLength(2);
    expect(r.corpo.plano.criterios_alta.length).toBeGreaterThan(0);
    expect(r.corpo.plano.dpa_estimada).toBe('D+3');
  });
});

describe('feedback e aprendizado', () => {
  it('persiste feedback e atualiza score', async () => {
    const r = await api('/api/feedback', {
      metodo: 'POST', token: tokenMedico,
      corpo: {
        categoria: 'profilaxias', item: 'Enoxaparina 40mg SC 1x/dia', decisao: 'conforme',
        setor: 'enfermaria', contextoClinico: 'Pneumonia comunitária',
      },
    });
    expect(r.status).toBe(201);
    expect(r.corpo.score.taxa).toBeGreaterThan(0.5);
  });
  it('rejeita decisão inválida', async () => {
    const r = await api('/api/feedback', { metodo: 'POST', token: tokenMedico, corpo: { categoria: 'x', item: 'y', decisao: 'talvez' } });
    expect(r.status).toBe(400);
  });
  it('feedback negativo aparece no dashboard', async () => {
    await api('/api/feedback', {
      metodo: 'POST', token: tokenMedico,
      corpo: { categoria: 'terapêutica medicamentosa', item: 'Levofloxacino 750mg', decisao: 'nao_conforme', motivo: 'não disponível no serviço', setor: 'enfermaria' },
    });
    const d = await api('/api/dashboard', { token: tokenMedico });
    expect(d.status).toBe(200);
    expect(d.corpo.global.total).toBeGreaterThanOrEqual(2);
    expect(d.corpo.motivosRejeicao.some((m) => m.motivo === 'não disponível no serviço')).toBe(true);
    expect(d.corpo.maisRejeitados.some((s) => s.item_exemplo.includes('Levofloxacino'))).toBe(true);
  });
});

describe('regras aprendidas', () => {
  it('médico não cria regra; admin cria, edita e remove', async () => {
    expect((await api('/api/regras', { metodo: 'POST', token: tokenMedico, corpo: { texto: 'x' } })).status).toBe(403);

    const criada = await api('/api/regras', {
      metodo: 'POST', token: tokenAdmin,
      corpo: { tipo: 'evitar', texto: 'Não sugerir levofloxacino; o serviço usa amoxicilina-clavulanato.' },
    });
    expect(criada.status).toBe(201);
    const id = criada.corpo.id;

    const lista = await api('/api/regras', { token: tokenMedico });
    expect(lista.corpo.regras.some((r) => r.id === id)).toBe(true);

    expect((await api(`/api/regras/${id}`, { metodo: 'PUT', token: tokenAdmin, corpo: { ativo: false } })).status).toBe(200);
    expect((await api(`/api/regras/${id}`, { metodo: 'DELETE', token: tokenAdmin })).status).toBe(200);
  });
});

describe('LGPD', () => {
  it('expurgo é restrito ao admin e responde contagens', async () => {
    expect((await api('/api/admin/expurgo', { metodo: 'POST', token: tokenMedico, corpo: { dias: 90 } })).status).toBe(403);
    const r = await api('/api/admin/expurgo', { metodo: 'POST', token: tokenAdmin, corpo: { dias: 90 } });
    expect(r.status).toBe(200);
    expect(r.corpo.expurgados).toHaveProperty('feedbacks');
  });
});
