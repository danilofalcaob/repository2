/*
 * Testes das regras críticas do Time Sepse App.
 * Execução: node --test time-sepse-app/tests/
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const TS = require('../js/dominio.js');

/* ------------------------------ SOFA: respiratório ------------------------------ */

test('SOFA respiratório — faixas de PaO2/FiO2', () => {
  assert.equal(TS.sofaRespiratorio(450, false), 0);
  assert.equal(TS.sofaRespiratorio(400, false), 0);
  assert.equal(TS.sofaRespiratorio(399, false), 1);
  assert.equal(TS.sofaRespiratorio(300, false), 1);
  assert.equal(TS.sofaRespiratorio(299, false), 2);
  assert.equal(TS.sofaRespiratorio(200, false), 2);
  assert.equal(TS.sofaRespiratorio(199, true), 3);
  assert.equal(TS.sofaRespiratorio(100, true), 3);
  assert.equal(TS.sofaRespiratorio(99, true), 4);
});

test('SOFA respiratório — pontos 3 e 4 exigem suporte ventilatório', () => {
  assert.equal(TS.sofaRespiratorio(150, false), 2);
  assert.equal(TS.sofaRespiratorio(80, false), 2);
  assert.equal(TS.sofaRespiratorio(150, true), 3);
  assert.equal(TS.sofaRespiratorio(80, true), 4);
});

test('SOFA respiratório — sem valor retorna null (não avaliado)', () => {
  assert.equal(TS.sofaRespiratorio(null, false), null);
  assert.equal(TS.sofaRespiratorio('', true), null);
});

/* ------------------------------ SOFA: coagulação ------------------------------ */

test('SOFA coagulação — faixas de plaquetas (×10³/µL)', () => {
  assert.equal(TS.sofaCoagulacao(200), 0);
  assert.equal(TS.sofaCoagulacao(150), 0);
  assert.equal(TS.sofaCoagulacao(149), 1);
  assert.equal(TS.sofaCoagulacao(100), 1);
  assert.equal(TS.sofaCoagulacao(99), 2);
  assert.equal(TS.sofaCoagulacao(50), 2);
  assert.equal(TS.sofaCoagulacao(49), 3);
  assert.equal(TS.sofaCoagulacao(20), 3);
  assert.equal(TS.sofaCoagulacao(19), 4);
});

/* ------------------------------ SOFA: hepático ------------------------------ */

test('SOFA hepático — faixas de bilirrubina (mg/dL)', () => {
  assert.equal(TS.sofaHepatico(1.0), 0);
  assert.equal(TS.sofaHepatico(1.19), 0);
  assert.equal(TS.sofaHepatico(1.2), 1);
  assert.equal(TS.sofaHepatico(1.9), 1);
  assert.equal(TS.sofaHepatico(2.0), 2);
  assert.equal(TS.sofaHepatico(5.9), 2);
  assert.equal(TS.sofaHepatico(6.0), 3);
  assert.equal(TS.sofaHepatico(11.9), 3);
  assert.equal(TS.sofaHepatico(12.0), 4);
});

/* ------------------------------ SOFA: cardiovascular ------------------------------ */

test('SOFA cardiovascular — PAM sem vasoativos', () => {
  assert.equal(TS.sofaCardiovascular({ pam: 80, droga: 'nenhuma' }), 0);
  assert.equal(TS.sofaCardiovascular({ pam: 70, droga: 'nenhuma' }), 0);
  assert.equal(TS.sofaCardiovascular({ pam: 69, droga: 'nenhuma' }), 1);
  assert.equal(TS.sofaCardiovascular({ pam: null, droga: 'nenhuma' }), null);
});

test('SOFA cardiovascular — dopamina e dobutamina', () => {
  assert.equal(TS.sofaCardiovascular({ droga: 'dobutamina' }), 2);
  assert.equal(TS.sofaCardiovascular({ droga: 'dopamina', dose: 4 }), 2);
  assert.equal(TS.sofaCardiovascular({ droga: 'dopamina', dose: 5 }), 2);
  assert.equal(TS.sofaCardiovascular({ droga: 'dopamina', dose: 5.1 }), 3);
  assert.equal(TS.sofaCardiovascular({ droga: 'dopamina', dose: 15 }), 3);
  assert.equal(TS.sofaCardiovascular({ droga: 'dopamina', dose: 15.1 }), 4);
});

test('SOFA cardiovascular — norepinefrina e adrenalina', () => {
  assert.equal(TS.sofaCardiovascular({ droga: 'norepinefrina', dose: 0.05 }), 3);
  assert.equal(TS.sofaCardiovascular({ droga: 'norepinefrina', dose: 0.1 }), 3);
  assert.equal(TS.sofaCardiovascular({ droga: 'norepinefrina', dose: 0.11 }), 4);
  assert.equal(TS.sofaCardiovascular({ droga: 'adrenalina', dose: 0.1 }), 3);
  assert.equal(TS.sofaCardiovascular({ droga: 'adrenalina', dose: 0.2 }), 4);
  // Sem dose informada, assume faixa menor (3) — nunca null com vasopressor.
  assert.equal(TS.sofaCardiovascular({ droga: 'norepinefrina' }), 3);
});

/* ------------------------------ SOFA: neurológico ------------------------------ */

test('SOFA neurológico — faixas de Glasgow', () => {
  assert.equal(TS.sofaNeurologico(15), 0);
  assert.equal(TS.sofaNeurologico(14), 1);
  assert.equal(TS.sofaNeurologico(13), 1);
  assert.equal(TS.sofaNeurologico(12), 2);
  assert.equal(TS.sofaNeurologico(10), 2);
  assert.equal(TS.sofaNeurologico(9), 3);
  assert.equal(TS.sofaNeurologico(6), 3);
  assert.equal(TS.sofaNeurologico(5), 4);
  assert.equal(TS.sofaNeurologico(3), 4);
});

/* ------------------------------ SOFA: renal ------------------------------ */

test('SOFA renal — faixas de creatinina (mg/dL)', () => {
  assert.equal(TS.sofaRenal(1.0, null), 0);
  assert.equal(TS.sofaRenal(1.2, null), 1);
  assert.equal(TS.sofaRenal(1.9, null), 1);
  assert.equal(TS.sofaRenal(2.0, null), 2);
  assert.equal(TS.sofaRenal(3.4, null), 2);
  assert.equal(TS.sofaRenal(3.5, null), 3);
  assert.equal(TS.sofaRenal(4.9, null), 3);
  assert.equal(TS.sofaRenal(5.0, null), 4);
});

test('SOFA renal — diurese e combinação (vale a maior pontuação)', () => {
  assert.equal(TS.sofaRenal(null, 1500), 0);
  assert.equal(TS.sofaRenal(null, 499), 3);
  assert.equal(TS.sofaRenal(null, 199), 4);
  assert.equal(TS.sofaRenal(1.0, 300), 3);  // creatinina normal, diurese baixa
  assert.equal(TS.sofaRenal(5.5, 1500), 4); // creatinina alta, diurese normal
  assert.equal(TS.sofaRenal(null, null), null);
});

/* ------------------------------ SOFA: total ------------------------------ */

test('calcularSofa — paciente normal soma 0', () => {
  const r = TS.calcularSofa({
    pao2: 95, fio2: 21, suporteVentilatorio: false,
    plaquetas: 250, bilirrubina: 0.8,
    pam: 85, droga: 'nenhuma',
    glasgow: 15, creatinina: 0.9
  });
  assert.equal(r.total, 0);
  assert.deepEqual(r.naoAvaliados, []);
});

test('calcularSofa — PaO2/FiO2 calculada a partir de PaO2 e FiO2', () => {
  const r = TS.calcularSofa({ pao2: 90, fio2: 60, suporteVentilatorio: true });
  assert.equal(r.relacaoPF, 150); // 90 / 0.6
  assert.equal(r.orgaos.respiratorio, 3);
});

test('calcularSofa — caso grave soma corretamente', () => {
  const r = TS.calcularSofa({
    pao2: 60, fio2: 80, suporteVentilatorio: true, // PF = 75 → 4
    plaquetas: 15,        // 4
    bilirrubina: 13,      // 4
    droga: 'norepinefrina', dose: 0.3, // 4
    glasgow: 3,           // 4
    creatinina: 6         // 4
  });
  assert.equal(r.total, 24);
});

test('calcularSofa — campos ausentes não pontuam e são sinalizados', () => {
  const r = TS.calcularSofa({ plaquetas: 90, glasgow: 12 });
  assert.equal(r.total, 4); // 2 + 2
  assert.deepEqual(r.naoAvaliados.sort(),
    ['cardiovascular', 'hepatico', 'renal', 'respiratorio']);
});

/* ------------------------------ Classificação ------------------------------ */

test('classificação — SOFA < 2 exclui sepse', () => {
  const c = TS.classificarSofa(1, false);
  assert.equal(c.codigo, 'sepse_excluida');
});

test('classificação — SOFA ≥ 2 é sepse', () => {
  assert.equal(TS.classificarSofa(2, false).codigo, 'sepse');
  assert.equal(TS.classificarSofa(10, false).codigo, 'sepse');
});

test('classificação — norepinefrina define choque séptico', () => {
  const c = TS.classificarSofa(8, true);
  assert.equal(c.codigo, 'choque_septico');
  assert.equal(c.alerta, null);
});

test('classificação — norepinefrina com SOFA < 2 gera alerta de revisão', () => {
  const c = TS.classificarSofa(1, true);
  assert.equal(c.codigo, 'choque_septico');
  assert.ok(c.alerta);
});

/* ------------------------------ Metas de tempo ------------------------------ */

function protocoloBase() {
  return {
    abertoEm: '2026-07-27T10:00:00.000Z',
    etapas: {}
  };
}

test('meta do lactato — 30 min a partir do recebimento no laboratório', () => {
  const p = protocoloBase();
  p.etapas.lab_recebimento = { status: 'concluida', em: '2026-07-27T10:20:00.000Z' };
  p.etapas.lab_lactato = { status: 'concluida', em: '2026-07-27T10:45:00.000Z' };
  const m = TS.avaliarMeta(TS.etapaPorId('lab_lactato'), p);
  assert.equal(m.minutos, 25);
  assert.equal(m.dentro, true);
});

test('meta do lactato — estourada quando passa de 30 min', () => {
  const p = protocoloBase();
  p.etapas.lab_recebimento = { status: 'concluida', em: '2026-07-27T10:00:00.000Z' };
  p.etapas.lab_lactato = { status: 'concluida', em: '2026-07-27T10:31:00.000Z' };
  const m = TS.avaliarMeta(TS.etapaPorId('lab_lactato'), p);
  assert.equal(m.dentro, false);
});

test('meta dos demais exames — 2 h a partir do recebimento', () => {
  const p = protocoloBase();
  p.etapas.lab_recebimento = { status: 'concluida', em: '2026-07-27T10:00:00.000Z' };
  p.etapas.lab_demais = { status: 'concluida', em: '2026-07-27T11:59:00.000Z' };
  const m = TS.avaliarMeta(TS.etapaPorId('lab_demais'), p);
  assert.equal(m.dentro, true);
});

test('meta — usa a abertura do protocolo quando o recebimento não foi registrado', () => {
  const p = protocoloBase();
  p.etapas.lab_lactato = { status: 'concluida', em: '2026-07-27T10:29:00.000Z' };
  const m = TS.avaliarMeta(TS.etapaPorId('lab_lactato'), p);
  assert.equal(m.referencia, p.abertoEm);
  assert.equal(m.dentro, true);
});

test('meta do antibiótico — 1 h a partir da abertura do protocolo', () => {
  const p = protocoloBase();
  p.etapas.enf_instalacao_atb = { status: 'concluida', em: '2026-07-27T10:50:00.000Z' };
  const m = TS.avaliarMeta(TS.etapaPorId('enf_instalacao_atb'), p);
  assert.equal(m.dentro, true);
  p.etapas.enf_instalacao_atb.em = '2026-07-27T11:01:00.000Z';
  assert.equal(TS.avaliarMeta(TS.etapaPorId('enf_instalacao_atb'), p).dentro, false);
});

test('meta — conclusão anterior à referência é sinalizada como inconsistente', () => {
  const p = protocoloBase();
  // Lactato liberado às 10:10, mas recebimento registrado depois (11:00):
  // ordem inconsistente — não pode contar como meta cumprida.
  p.etapas.lab_lactato = { status: 'concluida', em: '2026-07-27T10:10:00.000Z' };
  p.etapas.lab_recebimento = { status: 'concluida', em: '2026-07-27T11:00:00.000Z' };
  const m = TS.avaliarMeta(TS.etapaPorId('lab_lactato'), p);
  assert.equal(m.inconsistente, true);
  assert.equal(m.dentro, false);
});

test('meta — avaliação normal marca inconsistente como falso', () => {
  const p = protocoloBase();
  p.etapas.lab_recebimento = { status: 'concluida', em: '2026-07-27T10:00:00.000Z' };
  p.etapas.lab_lactato = { status: 'concluida', em: '2026-07-27T10:10:00.000Z' };
  const m = TS.avaliarMeta(TS.etapaPorId('lab_lactato'), p);
  assert.equal(m.inconsistente, false);
  assert.equal(m.dentro, true);
});

test('meta — etapa sem meta ou não concluída retorna null', () => {
  const p = protocoloBase();
  assert.equal(TS.avaliarMeta(TS.etapaPorId('enf_monitorizacao'), p), null);
  assert.equal(TS.avaliarMeta(TS.etapaPorId('lab_lactato'), p), null);
});

/* ------------------------------ Regras do protocolo ------------------------------ */

test('usoNorepinefrina — verdadeiro apenas com a etapa concluída', () => {
  const p = protocoloBase();
  assert.equal(TS.usoNorepinefrina(p), false);
  p.etapas.med_norepinefrina = { status: 'nao_indicada', em: '2026-07-27T10:10:00.000Z' };
  assert.equal(TS.usoNorepinefrina(p), false);
  p.etapas.med_norepinefrina = { status: 'concluida', em: '2026-07-27T10:10:00.000Z' };
  assert.equal(TS.usoNorepinefrina(p), true);
});

test('pendenciasObrigatorias — etapas opcionais não contam como pendência', () => {
  const p = protocoloBase();
  const pendentes = TS.pendenciasObrigatorias(p).map((e) => e.id);
  assert.ok(pendentes.indexOf('med_ressuscitacao') === -1);
  assert.ok(pendentes.indexOf('med_norepinefrina') === -1);
  assert.ok(pendentes.indexOf('fisio_suporte') === -1);
  assert.ok(pendentes.indexOf('enf_segundo_lactato') === -1);
  assert.ok(pendentes.indexOf('med_avaliacao_inicial') !== -1);
  assert.equal(pendentes.length, 11); // 15 etapas − 4 opcionais
});

test('catálogo — enfermeiro e técnico compartilham as mesmas etapas', () => {
  const doEnfermeiro = TS.etapasDoPapel('enfermeiro').map((e) => e.id);
  const doTecnico = TS.etapasDoPapel('tecnico').map((e) => e.id);
  assert.deepEqual(doEnfermeiro, doTecnico);
  assert.equal(doEnfermeiro.length, 4);
});
