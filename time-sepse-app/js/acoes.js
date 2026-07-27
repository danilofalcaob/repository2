/*
 * Time Sepse App — ações de negócio (mutações de estado).
 *
 * Toda alteração no estado do app passa por aplicar(estado, acao), tanto no
 * navegador (modo local, um aparelho) quanto no servidor (modo integrado,
 * vários aparelhos sincronizados). Assim as regras de validação e a trilha
 * de auditoria são idênticas nos dois modos.
 *
 * UMD: window.TimeSepseAcoes no navegador; module.exports no Node.
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) {
    module.exports = fabrica(require('./dominio.js'));
  } else {
    raiz.TimeSepseAcoes = fabrica(raiz.TimeSepse);
  }
})(typeof self !== 'undefined' ? self : this, function (TS) {
  'use strict';

  function agoraIso() { return new Date().toISOString(); }

  function falha(mensagem) { return { ok: false, erro: mensagem }; }

  function estadoInicial() {
    return { versao: 1, equipe: {}, turnos: [], protocolos: [], seq: 1, seqProtocolo: 1 };
  }

  function protocoloPorId(estado, id) {
    for (var i = 0; i < estado.protocolos.length; i++) {
      if (estado.protocolos[i].id === id) return estado.protocolos[i];
    }
    return null;
  }

  function membroEmPlantao(estado, papel) {
    var m = estado.equipe[papel];
    return m ? { nome: m.nome, papel: papel } : null;
  }

  function registrarEvento(protocolo, tipo, titulo, detalhe, por) {
    protocolo.eventos.push({
      em: agoraIso(),
      tipo: tipo,
      titulo: titulo,
      detalhe: detalhe || null,
      por: por ? { nome: por.nome, papel: por.papel } : null
    });
  }

  var TIPOS = {

    entrar_turno: function (estado, d) {
      if (!d.papel || !TS.PAPEIS[d.papel]) return falha('Função inválida.');
      var nome = String(d.nome || '').trim();
      if (!nome) return falha('Informe o nome do profissional.');
      if (estado.equipe[d.papel]) TIPOS.sair_turno(estado, { papel: d.papel });
      var turno = {
        id: 'T' + estado.seq++,
        papel: d.papel,
        nome: nome,
        registro: String(d.registro || '').trim() || null,
        entrada: agoraIso(),
        saida: null
      };
      estado.turnos.push(turno);
      estado.equipe[d.papel] = {
        nome: nome, registro: turno.registro, entrouEm: turno.entrada, turnoId: turno.id
      };
      return { ok: true, entrouEm: turno.entrada };
    },

    sair_turno: function (estado, d) {
      var membro = estado.equipe[d.papel];
      if (!membro) return falha('Não há profissional em plantão nesta função.');
      for (var i = estado.turnos.length - 1; i >= 0; i--) {
        if (estado.turnos[i].id === membro.turnoId) {
          estado.turnos[i].saida = agoraIso();
          break;
        }
      }
      delete estado.equipe[d.papel];
      return { ok: true, nome: membro.nome };
    },

    abrir_protocolo: function (estado, d) {
      var por = membroEmPlantao(estado, d.responsavelPapel);
      if (!por || d.responsavelPapel === 'lider') {
        return falha('Quem abre o protocolo precisa ser um membro do time em plantão.');
      }
      var paciente = d.paciente || {};
      var nome = String(paciente.nome || '').trim();
      var prontuario = String(paciente.prontuario || '').trim();
      if (!nome || !prontuario) return falha('Informe o nome do paciente e o prontuário.');

      var ano = new Date().getFullYear();
      var protocolo = {
        id: 'PS-' + ano + '-' + String(estado.seqProtocolo++).padStart(3, '0'),
        paciente: {
          nome: nome,
          prontuario: prontuario,
          leito: String(paciente.leito || '').trim(),
          setor: String(paciente.setor || '').trim()
        },
        status: 'aberto',
        abertoEm: agoraIso(),
        abertoPor: por,
        etapas: {},
        sofa: [],
        eventos: [],
        encerramento: null
      };
      registrarEvento(protocolo, 'abertura', 'Protocolo Sepse aberto',
        'Paciente ' + nome + (protocolo.paciente.leito ? ' — leito ' + protocolo.paciente.leito : ''), por);
      estado.protocolos.unshift(protocolo);
      return { ok: true, protocoloId: protocolo.id };
    },

    concluir_etapa: function (estado, d) {
      return registrarEtapa(estado, d, 'concluida');
    },

    nao_indicada: function (estado, d) {
      return registrarEtapa(estado, d, 'nao_indicada');
    },

    desfazer_etapa: function (estado, d) {
      var p = protocoloPorId(estado, d.protocoloId);
      var def = TS.etapaPorId(d.etapaId);
      if (!p || !def) return falha('Protocolo ou etapa não encontrados.');
      if (p.status !== 'aberto') return falha('O protocolo não está mais em andamento.');
      if (!p.etapas[d.etapaId]) return falha('Esta etapa não tem registro para desfazer.');
      var membro = membroEmPlantao(estado, d.membroPapel);
      if (!membro || (def.papeis.indexOf(d.membroPapel) === -1 && d.membroPapel !== 'lider')) {
        return falha('Apenas um membro em plantão da função responsável (ou o líder) pode desfazer o registro.');
      }
      delete p.etapas[d.etapaId];
      registrarEvento(p, 'correcao', 'Registro desfeito: ' + def.titulo,
        d.motivo ? 'Motivo: ' + String(d.motivo).trim() : null, membro);
      return { ok: true };
    },

    salvar_sofa: function (estado, d) {
      var p = protocoloPorId(estado, d.protocoloId);
      if (!p) return falha('Protocolo não encontrado.');
      if (p.status !== 'aberto') return falha('O protocolo não está mais em andamento.');
      var medico = membroEmPlantao(estado, 'medico');
      if (!medico) return falha('Apenas o médico em plantão pode registrar o SOFA.');

      var resultado = TS.calcularSofa(d.entradas || {});
      var classificacao = TS.classificarSofa(resultado.total, TS.usoNorepinefrina(p));
      p.sofa.push({
        em: agoraIso(),
        por: medico,
        entradas: d.entradas || {},
        resultado: resultado,
        classificacao: classificacao
      });
      registrarEvento(p, 'sofa',
        'SOFA-score calculado: ' + resultado.total + ' ponto(s)',
        'Classificação: ' + classificacao.rotulo, medico);
      return { ok: true, total: resultado.total, rotulo: classificacao.rotulo };
    },

    encerrar_protocolo: function (estado, d) {
      var p = protocoloPorId(estado, d.protocoloId);
      if (!p) return falha('Protocolo não encontrado.');
      if (p.status !== 'aberto') return falha('O protocolo já foi encerrado.');
      var por = membroEmPlantao(estado, d.responsavelPapel);
      if (!por || (d.responsavelPapel !== 'medico' && d.responsavelPapel !== 'lider')) {
        return falha('O encerramento deve ser registrado pelo médico ou pelo líder/gestor em plantão.');
      }
      var desfecho = String(d.desfecho || '').trim();
      if (!desfecho) return falha('Informe o desfecho do atendimento.');
      if (TS.pendenciasObrigatorias(p).length && !d.confirmarPendencias) {
        return falha('Há etapas obrigatórias sem registro — confirme o encerramento marcando a caixa.');
      }

      var sofaFinal = TS.ultimoSofa(p);
      var observacao = String(d.observacao || '').trim();
      p.status = 'encerrado';
      p.encerramento = {
        em: agoraIso(),
        por: por,
        desfecho: desfecho,
        observacao: observacao || null,
        classificacao: sofaFinal
          ? TS.classificarSofa(sofaFinal.resultado.total, TS.usoNorepinefrina(p))
          : null
      };
      registrarEvento(p, 'encerramento', 'Protocolo encerrado',
        'Desfecho: ' + desfecho + (observacao ? ' — ' + observacao : ''), por);
      return { ok: true };
    }
  };

  function registrarEtapa(estado, d, status) {
    var p = protocoloPorId(estado, d.protocoloId);
    var def = TS.etapaPorId(d.etapaId);
    if (!p || !def) return falha('Protocolo ou etapa não encontrados.');
    if (p.status !== 'aberto') return falha('O protocolo não está mais em andamento.');
    if (p.etapas[d.etapaId]) return falha('Esta etapa já tem registro — desfaça antes de registrar novamente.');
    if (status === 'nao_indicada' && !def.opcional) return falha('Esta etapa é obrigatória no protocolo.');
    var membro = membroEmPlantao(estado, d.membroPapel);
    if (!membro || def.papeis.indexOf(d.membroPapel) === -1) {
      return falha('Apenas ' + def.papeis.map(function (papel) {
        return TS.PAPEIS[papel].nome;
      }).join(' ou ') + ' em plantão pode registrar esta etapa.');
    }
    var observacao = String(d.observacao || '').trim();
    p.etapas[d.etapaId] = {
      status: status,
      em: agoraIso(),
      por: membro,
      observacao: observacao || null
    };
    registrarEvento(p, 'etapa',
      (status === 'concluida' ? 'Etapa concluída: ' : 'Etapa marcada como não indicada: ') + def.titulo,
      observacao || null, membro);
    return { ok: true, em: p.etapas[d.etapaId].em };
  }

  function aplicar(estado, acao) {
    if (!acao || typeof acao !== 'object') return falha('Ação inválida.');
    var executar = TIPOS[acao.tipo];
    if (!executar) return falha('Ação desconhecida: ' + String(acao.tipo));
    try {
      return executar(estado, acao.dados || {});
    } catch (erro) {
      return falha('Falha ao aplicar a ação: ' + erro.message);
    }
  }

  return { aplicar: aplicar, estadoInicial: estadoInicial };
});
