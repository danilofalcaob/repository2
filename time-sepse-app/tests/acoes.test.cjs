/*
 * Testes das ações de negócio compartilhadas (navegador + servidor).
 * Execução: node --test time-sepse-app/tests/acoes.test.cjs
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ACOES = require('../js/acoes.js');

function comEquipe() {
  const estado = ACOES.estadoInicial();
  ACOES.aplicar(estado, { tipo: 'entrar_turno', dados: { papel: 'medico', nome: 'Dra. Ana' } });
  ACOES.aplicar(estado, { tipo: 'entrar_turno', dados: { papel: 'enfermeiro', nome: 'Carlos' } });
  return estado;
}

function comProtocolo() {
  const estado = comEquipe();
  const r = ACOES.aplicar(estado, {
    tipo: 'abrir_protocolo',
    dados: { responsavelPapel: 'medico', paciente: { nome: 'José', prontuario: '123' } }
  });
  return { estado, protocoloId: r.protocoloId };
}

/* ------------------------------ Turnos ------------------------------ */

test('entrar_turno registra entrada e substitui plantão anterior', () => {
  const estado = ACOES.estadoInicial();
  const r1 = ACOES.aplicar(estado, { tipo: 'entrar_turno', dados: { papel: 'medico', nome: 'Dra. Ana' } });
  assert.equal(r1.ok, true);
  assert.equal(estado.equipe.medico.nome, 'Dra. Ana');

  ACOES.aplicar(estado, { tipo: 'entrar_turno', dados: { papel: 'medico', nome: 'Dr. Beto' } });
  assert.equal(estado.equipe.medico.nome, 'Dr. Beto');
  assert.equal(estado.turnos.length, 2);
  assert.ok(estado.turnos[0].saida, 'turno anterior deve ser encerrado');
});

test('entrar_turno valida função e nome', () => {
  const estado = ACOES.estadoInicial();
  assert.equal(ACOES.aplicar(estado, { tipo: 'entrar_turno', dados: { papel: 'cirurgiao', nome: 'X' } }).ok, false);
  assert.equal(ACOES.aplicar(estado, { tipo: 'entrar_turno', dados: { papel: 'medico', nome: '  ' } }).ok, false);
});

test('sair_turno fecha o turno com horário de saída', () => {
  const estado = comEquipe();
  const r = ACOES.aplicar(estado, { tipo: 'sair_turno', dados: { papel: 'medico' } });
  assert.equal(r.ok, true);
  assert.equal(r.nome, 'Dra. Ana');
  assert.equal(estado.equipe.medico, undefined);
  assert.equal(ACOES.aplicar(estado, { tipo: 'sair_turno', dados: { papel: 'medico' } }).ok, false);
});

/* ------------------------------ Protocolo ------------------------------ */

test('abrir_protocolo exige membro em plantão (líder não abre)', () => {
  const estado = ACOES.estadoInicial();
  assert.equal(ACOES.aplicar(estado, {
    tipo: 'abrir_protocolo',
    dados: { responsavelPapel: 'medico', paciente: { nome: 'José', prontuario: '1' } }
  }).ok, false);

  ACOES.aplicar(estado, { tipo: 'entrar_turno', dados: { papel: 'lider', nome: 'Dr. Gestor' } });
  assert.equal(ACOES.aplicar(estado, {
    tipo: 'abrir_protocolo',
    dados: { responsavelPapel: 'lider', paciente: { nome: 'José', prontuario: '1' } }
  }).ok, false);
});

test('abrir_protocolo cria protocolo com evento de abertura', () => {
  const { estado, protocoloId } = comProtocolo();
  const p = estado.protocolos[0];
  assert.equal(p.id, protocoloId);
  assert.equal(p.status, 'aberto');
  assert.equal(p.eventos.length, 1);
  assert.equal(p.eventos[0].tipo, 'abertura');
});

/* ------------------------------ Etapas ------------------------------ */

test('concluir_etapa registra horário, responsável e evento', () => {
  const { estado, protocoloId } = comProtocolo();
  const r = ACOES.aplicar(estado, {
    tipo: 'concluir_etapa',
    dados: { protocoloId, etapaId: 'enf_coleta_kit', membroPapel: 'enfermeiro', observacao: '2 pares' }
  });
  assert.equal(r.ok, true);
  const etapa = estado.protocolos[0].etapas.enf_coleta_kit;
  assert.equal(etapa.status, 'concluida');
  assert.equal(etapa.por.nome, 'Carlos');
  assert.ok(etapa.em);
});

test('concluir_etapa recusa membro de função não elegível ou fora de plantão', () => {
  const { estado, protocoloId } = comProtocolo();
  // médico não coleta o kit
  assert.equal(ACOES.aplicar(estado, {
    tipo: 'concluir_etapa',
    dados: { protocoloId, etapaId: 'enf_coleta_kit', membroPapel: 'medico' }
  }).ok, false);
  // analista não está em plantão
  assert.equal(ACOES.aplicar(estado, {
    tipo: 'concluir_etapa',
    dados: { protocoloId, etapaId: 'lab_recebimento', membroPapel: 'analista' }
  }).ok, false);
});

test('concluir_etapa não sobrescreve registro existente', () => {
  const { estado, protocoloId } = comProtocolo();
  const dados = { protocoloId, etapaId: 'med_avaliacao_inicial', membroPapel: 'medico' };
  assert.equal(ACOES.aplicar(estado, { tipo: 'concluir_etapa', dados }).ok, true);
  assert.equal(ACOES.aplicar(estado, { tipo: 'concluir_etapa', dados }).ok, false);
});

test('nao_indicada vale apenas para etapas opcionais', () => {
  const { estado, protocoloId } = comProtocolo();
  assert.equal(ACOES.aplicar(estado, {
    tipo: 'nao_indicada',
    dados: { protocoloId, etapaId: 'med_ressuscitacao', membroPapel: 'medico' }
  }).ok, true);
  assert.equal(ACOES.aplicar(estado, {
    tipo: 'nao_indicada',
    dados: { protocoloId, etapaId: 'med_avaliacao_inicial', membroPapel: 'medico' }
  }).ok, false);
});

test('desfazer_etapa remove o registro e grava correção na trilha', () => {
  const { estado, protocoloId } = comProtocolo();
  ACOES.aplicar(estado, {
    tipo: 'concluir_etapa',
    dados: { protocoloId, etapaId: 'med_avaliacao_inicial', membroPapel: 'medico' }
  });
  const r = ACOES.aplicar(estado, {
    tipo: 'desfazer_etapa',
    dados: { protocoloId, etapaId: 'med_avaliacao_inicial', membroPapel: 'medico', motivo: 'engano' }
  });
  assert.equal(r.ok, true);
  const p = estado.protocolos[0];
  assert.equal(p.etapas.med_avaliacao_inicial, undefined);
  assert.equal(p.eventos[p.eventos.length - 1].tipo, 'correcao');
});

/* ------------------------------ SOFA ------------------------------ */

test('salvar_sofa exige médico em plantão e calcula no servidor', () => {
  const { estado, protocoloId } = comProtocolo();
  ACOES.aplicar(estado, { tipo: 'sair_turno', dados: { papel: 'medico' } });
  assert.equal(ACOES.aplicar(estado, {
    tipo: 'salvar_sofa', dados: { protocoloId, entradas: { plaquetas: 90 } }
  }).ok, false);

  ACOES.aplicar(estado, { tipo: 'entrar_turno', dados: { papel: 'medico', nome: 'Dra. Ana' } });
  const r = ACOES.aplicar(estado, {
    tipo: 'salvar_sofa', dados: { protocoloId, entradas: { plaquetas: 90, glasgow: 12 } }
  });
  assert.equal(r.ok, true);
  assert.equal(r.total, 4); // plaquetas <100 = 2 + glasgow 10-12 = 2
  assert.equal(r.rotulo, 'Sepse');
});

test('salvar_sofa classifica choque séptico pela etapa de norepinefrina', () => {
  const { estado, protocoloId } = comProtocolo();
  ACOES.aplicar(estado, {
    tipo: 'concluir_etapa',
    dados: { protocoloId, etapaId: 'med_norepinefrina', membroPapel: 'medico' }
  });
  const r = ACOES.aplicar(estado, {
    tipo: 'salvar_sofa', dados: { protocoloId, entradas: { plaquetas: 90 } }
  });
  assert.equal(r.rotulo, 'Choque Séptico');
});

/* ------------------------------ Encerramento ------------------------------ */

test('encerrar_protocolo exige médico ou líder e confirmação de pendências', () => {
  const { estado, protocoloId } = comProtocolo();
  // enfermeiro não encerra
  assert.equal(ACOES.aplicar(estado, {
    tipo: 'encerrar_protocolo',
    dados: { protocoloId, responsavelPapel: 'enfermeiro', desfecho: 'Melhora clínica' }
  }).ok, false);
  // com pendências obrigatórias, sem confirmação → recusa
  assert.equal(ACOES.aplicar(estado, {
    tipo: 'encerrar_protocolo',
    dados: { protocoloId, responsavelPapel: 'medico', desfecho: 'Melhora clínica' }
  }).ok, false);
  // com confirmação → encerra
  const r = ACOES.aplicar(estado, {
    tipo: 'encerrar_protocolo',
    dados: { protocoloId, responsavelPapel: 'medico', desfecho: 'Melhora clínica', confirmarPendencias: true }
  });
  assert.equal(r.ok, true);
  const p = estado.protocolos[0];
  assert.equal(p.status, 'encerrado');
  assert.equal(p.encerramento.desfecho, 'Melhora clínica');
  // não encerra duas vezes
  assert.equal(ACOES.aplicar(estado, {
    tipo: 'encerrar_protocolo',
    dados: { protocoloId, responsavelPapel: 'medico', desfecho: 'Outro', confirmarPendencias: true }
  }).ok, false);
});

test('etapas em protocolo encerrado são recusadas', () => {
  const { estado, protocoloId } = comProtocolo();
  ACOES.aplicar(estado, {
    tipo: 'encerrar_protocolo',
    dados: { protocoloId, responsavelPapel: 'medico', desfecho: 'Óbito', confirmarPendencias: true }
  });
  assert.equal(ACOES.aplicar(estado, {
    tipo: 'concluir_etapa',
    dados: { protocoloId, etapaId: 'enf_coleta_kit', membroPapel: 'enfermeiro' }
  }).ok, false);
});

test('ação desconhecida é recusada sem alterar o estado', () => {
  const estado = ACOES.estadoInicial();
  const antes = JSON.stringify(estado);
  assert.equal(ACOES.aplicar(estado, { tipo: 'apagar_tudo' }).ok, false);
  assert.equal(JSON.stringify(estado), antes);
});
