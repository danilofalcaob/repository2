/*
 * Time Sepse App — interface e persistência (localStorage).
 * Depende de js/dominio.js (window.TimeSepse).
 */
(function () {
  'use strict';

  var TS = window.TimeSepse;
  var CHAVE = 'timeSepseApp.v1';

  var DESFECHOS = [
    'Melhora clínica',
    'Transferência para UTI',
    'Transferência externa',
    'Óbito',
    'Outro'
  ];

  var GRUPOS_ETAPAS = [
    { titulo: 'Médico', papelCor: 'medico', icone: '🩺', papeis: ['medico'] },
    { titulo: 'Enfermeiro / Técnico de Enfermagem', papelCor: 'enfermeiro', icone: '💉', papeis: ['enfermeiro', 'tecnico'] },
    { titulo: 'Analista do Laboratório', papelCor: 'analista', icone: '🔬', papeis: ['analista'] },
    { titulo: 'Fisioterapeuta', papelCor: 'fisioterapeuta', icone: '🫁', papeis: ['fisioterapeuta'] }
  ];

  /* ------------------------------------------------------------------ *
   * Estado persistido
   * ------------------------------------------------------------------ */

  function estadoInicial() {
    return { versao: 1, equipe: {}, turnos: [], protocolos: [], seq: 1, seqProtocolo: 1 };
  }

  function carregarEstado() {
    try {
      var bruto = localStorage.getItem(CHAVE);
      if (!bruto) return estadoInicial();
      var dados = JSON.parse(bruto);
      if (!dados || typeof dados !== 'object') return estadoInicial();
      dados.equipe = (dados.equipe && typeof dados.equipe === 'object') ? dados.equipe : {};
      Object.keys(dados.equipe).forEach(function (papel) {
        var m = dados.equipe[papel];
        if (!m || typeof m !== 'object' || typeof m.nome !== 'string') delete dados.equipe[papel];
      });
      dados.turnos = (Array.isArray(dados.turnos) ? dados.turnos : [])
        .filter(function (t) { return t && typeof t === 'object' && t.nome; });
      dados.protocolos = (Array.isArray(dados.protocolos) ? dados.protocolos : [])
        .filter(function (p) { return p && typeof p === 'object' && p.id; });
      dados.protocolos.forEach(function (p) {
        p.paciente = (p.paciente && typeof p.paciente === 'object') ? p.paciente : {};
        if (!p.paciente.nome) p.paciente.nome = '(sem identificação)';
        p.status = (p.status === 'encerrado' || p.encerramento) ? 'encerrado' : 'aberto';
        p.etapas = (p.etapas && typeof p.etapas === 'object') ? p.etapas : {};
        p.sofa = Array.isArray(p.sofa) ? p.sofa : [];
        p.eventos = Array.isArray(p.eventos) ? p.eventos : [];
        if (!p.abertoEm) p.abertoEm = new Date(0).toISOString();
      });
      dados.seq = typeof dados.seq === 'number' ? dados.seq : 1;
      dados.seqProtocolo = typeof dados.seqProtocolo === 'number'
        ? dados.seqProtocolo
        : dados.protocolos.length + 1;
      return dados;
    } catch (erro) {
      console.error('Falha ao carregar dados salvos:', erro);
      return estadoInicial();
    }
  }

  function salvarEstado() {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(estado));
    } catch (erro) {
      console.error(erro);
      toast('Não foi possível salvar os dados neste navegador (armazenamento indisponível ou cheio).', 'erro');
    }
  }

  var estado = carregarEstado();

  // Estado de interface (não persistido)
  var ui = {
    aba: 'equipe',
    protocoloId: null,   // detalhe aberto na aba Protocolos
    relatorioId: null,   // relatório em exibição (sobrepõe as abas)
    sofaProtocoloId: null,
    sofaResultado: null  // último cálculo ainda não salvo
  };

  /* ------------------------------------------------------------------ *
   * Utilidades
   * ------------------------------------------------------------------ */

  function esc(valor) {
    return String(valor == null ? '' : valor)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function agoraIso() { return new Date().toISOString(); }

  function fmtDataHora(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' às ' +
      d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function fmtHora(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function minutosEntre(inicioIso, fimIso) {
    return Math.max(0, (new Date(fimIso).getTime() - new Date(inicioIso).getTime()) / 60000);
  }

  function duracaoTexto(minutos) {
    minutos = Math.round(minutos);
    if (minutos < 1) return 'menos de 1 min';
    if (minutos < 60) return minutos + ' min';
    var horas = Math.floor(minutos / 60);
    var resto = minutos % 60;
    if (horas < 24) return horas + ' h' + (resto ? ' ' + resto + ' min' : '');
    var dias = Math.floor(horas / 24);
    return dias + ' d ' + (horas % 24) + ' h';
  }

  function primeiroNome(nome) {
    return String(nome || '').trim().split(/\s+/)[0] || '';
  }

  function nomePapel(papel) {
    return TS.PAPEIS[papel] ? TS.PAPEIS[papel].nome : papel;
  }

  function iconePapel(papel) {
    return TS.PAPEIS[papel] ? TS.PAPEIS[papel].icone : '👤';
  }

  function assinatura(por) {
    if (!por) return '—';
    return por.nome + ' (' + nomePapel(por.papel) + ')';
  }

  /* ------------------------------------------------------------------ *
   * Operações de dados
   * ------------------------------------------------------------------ */

  function protocoloPorId(id) {
    for (var i = 0; i < estado.protocolos.length; i++) {
      if (estado.protocolos[i].id === id) return estado.protocolos[i];
    }
    return null;
  }

  function protocolosAbertos() {
    return estado.protocolos.filter(function (p) { return p.status === 'aberto'; });
  }

  function membrosLogados() {
    return TS.ORDEM_PAPEIS
      .filter(function (papel) { return !!estado.equipe[papel]; })
      .map(function (papel) {
        return { papel: papel, nome: estado.equipe[papel].nome };
      });
  }

  function membrosElegiveis(papeis) {
    return membrosLogados().filter(function (m) { return papeis.indexOf(m.papel) !== -1; });
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

  function entrarTurno(papel, nome, registro) {
    if (estado.equipe[papel]) sairTurno(papel);
    var turno = {
      id: 'T' + estado.seq++,
      papel: papel,
      nome: nome,
      registro: registro || null,
      entrada: agoraIso(),
      saida: null
    };
    estado.turnos.push(turno);
    estado.equipe[papel] = { nome: nome, registro: registro || null, entrouEm: turno.entrada, turnoId: turno.id };
    salvarEstado();
  }

  function sairTurno(papel) {
    var membro = estado.equipe[papel];
    if (!membro) return;
    for (var i = estado.turnos.length - 1; i >= 0; i--) {
      if (estado.turnos[i].id === membro.turnoId) {
        estado.turnos[i].saida = agoraIso();
        break;
      }
    }
    delete estado.equipe[papel];
    salvarEstado();
  }

  function abrirProtocolo(dados, por) {
    var ano = new Date().getFullYear();
    var numero = estado.seqProtocolo++;
    var protocolo = {
      id: 'PS-' + ano + '-' + String(numero).padStart(3, '0'),
      paciente: dados,
      status: 'aberto',
      abertoEm: agoraIso(),
      abertoPor: { nome: por.nome, papel: por.papel },
      etapas: {},
      sofa: [],
      eventos: [],
      encerramento: null
    };
    registrarEvento(protocolo, 'abertura', 'Protocolo Sepse aberto',
      'Paciente ' + dados.nome + (dados.leito ? ' — leito ' + dados.leito : ''), por);
    estado.protocolos.unshift(protocolo);
    salvarEstado();
    return protocolo;
  }

  function concluirEtapa(protocolo, etapaId, membro, observacao) {
    var def = TS.etapaPorId(etapaId);
    protocolo.etapas[etapaId] = {
      status: 'concluida',
      em: agoraIso(),
      por: { nome: membro.nome, papel: membro.papel },
      observacao: observacao || null
    };
    registrarEvento(protocolo, 'etapa', 'Etapa concluída: ' + def.titulo, observacao || null, membro);
    salvarEstado();
  }

  function marcarNaoIndicada(protocolo, etapaId, membro, observacao) {
    var def = TS.etapaPorId(etapaId);
    protocolo.etapas[etapaId] = {
      status: 'nao_indicada',
      em: agoraIso(),
      por: { nome: membro.nome, papel: membro.papel },
      observacao: observacao || null
    };
    registrarEvento(protocolo, 'etapa', 'Etapa marcada como não indicada: ' + def.titulo, observacao || null, membro);
    salvarEstado();
  }

  function desfazerEtapa(protocolo, etapaId, membro, motivo) {
    var def = TS.etapaPorId(etapaId);
    delete protocolo.etapas[etapaId];
    registrarEvento(protocolo, 'correcao', 'Registro desfeito: ' + def.titulo,
      motivo ? 'Motivo: ' + motivo : null, membro);
    salvarEstado();
  }

  function salvarSofa(protocolo, calculo, medico) {
    protocolo.sofa.push({
      em: agoraIso(),
      por: { nome: medico.nome, papel: medico.papel },
      entradas: calculo.entradas,
      resultado: calculo.resultado,
      classificacao: calculo.classificacao
    });
    registrarEvento(protocolo, 'sofa',
      'SOFA-score calculado: ' + calculo.resultado.total + ' ponto(s)',
      'Classificação: ' + calculo.classificacao.rotulo, medico);
    salvarEstado();
  }

  function encerrarProtocolo(protocolo, desfecho, observacao, por) {
    var sofaFinal = TS.ultimoSofa(protocolo);
    protocolo.status = 'encerrado';
    protocolo.encerramento = {
      em: agoraIso(),
      por: { nome: por.nome, papel: por.papel },
      desfecho: desfecho,
      observacao: observacao || null,
      classificacao: sofaFinal
        ? TS.classificarSofa(sofaFinal.resultado.total, TS.usoNorepinefrina(protocolo))
        : null
    };
    registrarEvento(protocolo, 'encerramento', 'Protocolo encerrado',
      'Desfecho: ' + desfecho + (observacao ? ' — ' + observacao : ''), por);
    salvarEstado();
  }

  function classificacaoAtual(protocolo) {
    if (protocolo.encerramento && protocolo.encerramento.classificacao) {
      return protocolo.encerramento.classificacao;
    }
    var sofa = TS.ultimoSofa(protocolo);
    if (!sofa) return null;
    return TS.classificarSofa(sofa.resultado.total, TS.usoNorepinefrina(protocolo));
  }

  /* ------------------------------------------------------------------ *
   * Renderização
   * ------------------------------------------------------------------ */

  var elConteudo = document.getElementById('conteudo');
  var elPlantao = document.getElementById('topo-plantao');
  var elAbas = document.getElementById('abas');

  function render() {
    renderPlantaoTopo();
    Array.prototype.forEach.call(elAbas.querySelectorAll('button'), function (botao) {
      botao.classList.toggle('ativa', botao.dataset.aba === ui.aba && !ui.relatorioId);
    });

    if (ui.relatorioId) { renderRelatorio(); return; }
    if (ui.aba === 'equipe') renderEquipe();
    else if (ui.aba === 'protocolos') (ui.protocoloId ? renderProtocoloDetalhe() : renderProtocolos());
    else if (ui.aba === 'sofa') renderSofa();
    else if (ui.aba === 'auditoria') renderAuditoria();
  }

  function renderPlantaoTopo() {
    var logados = membrosLogados();
    if (!logados.length) {
      elPlantao.innerHTML = '<span>Nenhum membro em plantão</span>';
      return;
    }
    elPlantao.innerHTML = logados.map(function (m) {
      return '<span class="chip-papel" title="' + esc(nomePapel(m.papel)) + '">' +
        '<span class="ponto fundo-' + m.papel + '">' + iconePapel(m.papel) + '</span>' +
        esc(primeiroNome(m.nome)) + '</span>';
    }).join('');
  }

  /* ------------------------------ Aba Equipe ------------------------------ */

  function renderEquipe() {
    var cartoes = TS.ORDEM_PAPEIS.map(function (papel) {
      var info = TS.PAPEIS[papel];
      var membro = estado.equipe[papel];
      var etapas = TS.etapasDoPapel(papel);
      var responsabilidades = papel === 'lider'
        ? '<p class="dica">Auditoria dos atendimentos, indicadores do protocolo e exportação dos registros.</p>'
        : '<ul class="dica" style="margin:0;padding-left:18px;">' +
            etapas.map(function (e) {
              return '<li>' + esc(e.titulo) + (e.opcional ? ' <em>(quando indicado)</em>' : '') + '</li>';
            }).join('') + '</ul>';

      var status, acoes;
      if (membro) {
        status = '<strong>' + esc(membro.nome) + '</strong>' +
          (membro.registro ? ' · ' + esc(membro.registro) : '') +
          '<br>Em plantão desde ' + fmtDataHora(membro.entrouEm) +
          ' (<span data-desde="' + esc(membro.entrouEm) + '">' +
          duracaoTexto(minutosEntre(membro.entrouEm, agoraIso())) + '</span>)';
        acoes =
          '<button type="button" class="botao botao-secundario botao-mini" data-acao="iniciar-plantao" data-papel="' + papel + '">Trocar profissional</button>' +
          '<button type="button" class="botao botao-fantasma botao-mini" data-acao="encerrar-plantao" data-papel="' + papel + '">Encerrar turno</button>';
      } else {
        status = 'Fora de plantão';
        acoes = '<button type="button" class="botao botao-primario botao-mini" data-acao="iniciar-plantao" data-papel="' + papel + '">Iniciar plantão</button>';
      }

      return '<article class="cartao cartao-membro cor-' + papel + '">' +
        '<div class="membro-cabecalho">' +
          '<span class="membro-icone" aria-hidden="true">' + info.icone + '</span>' +
          '<div><h3>' + esc(info.nome) + '</h3>' +
          '<div class="membro-status">' + status + '</div></div>' +
        '</div>' +
        responsabilidades +
        '<div class="membro-acoes">' + acoes + '</div>' +
      '</article>';
    }).join('');

    elConteudo.innerHTML =
      '<div class="secao-titulo"><div><h2>Equipe de plantão</h2>' +
      '<p>Cada membro registra a entrada no início do turno. As etapas do protocolo são atribuídas a quem está em plantão.</p></div></div>' +
      '<div class="grade grade-2 grade-3-desktop">' + cartoes + '</div>';
  }

  /* ------------------------------ Aba Protocolos ------------------------------ */

  function seloClassificacao(protocolo) {
    var c = classificacaoAtual(protocolo);
    if (!c) return '';
    var classe = c.codigo === 'choque_septico' ? 'selo-grave' : (c.codigo === 'sepse' ? 'selo-alerta' : 'selo-ok');
    var icone = c.codigo === 'sepse_excluida' ? '✓' : '⚠';
    return '<span class="selo ' + classe + '">' + icone + ' ' + esc(c.rotulo) + '</span>';
  }

  function renderProtocolos() {
    var abertos = protocolosAbertos();
    var encerrados = estado.protocolos.filter(function (p) { return p.status === 'encerrado'; });

    var listaAbertos = abertos.length ? abertos.map(function (p) {
      var obrigatorias = TS.ETAPAS.filter(function (e) { return !e.opcional; });
      var feitas = obrigatorias.filter(function (e) {
        var et = p.etapas[e.id];
        return et && et.status === 'concluida';
      }).length;
      var pct = Math.round((feitas / obrigatorias.length) * 100);
      return '<article class="cartao cartao-protocolo" data-acao="ver-protocolo" data-id="' + esc(p.id) + '" role="button" tabindex="0">' +
        '<div class="protocolo-cabecalho"><h3>' + esc(p.paciente.nome) + '</h3>' +
        '<span class="selo selo-aberto">● Em andamento</span></div>' +
        '<div class="protocolo-meta">' + esc(p.id) +
          (p.paciente.leito ? ' · Leito ' + esc(p.paciente.leito) : '') +
          (p.paciente.setor ? ' · ' + esc(p.paciente.setor) : '') +
          '<br>Aberto ' + fmtDataHora(p.abertoEm) + ' — há <span data-desde="' + esc(p.abertoEm) + '">' +
          duracaoTexto(minutosEntre(p.abertoEm, agoraIso())) + '</span></div>' +
        '<div class="barra-progresso" aria-label="Progresso das etapas obrigatórias"><span style="width:' + pct + '%"></span></div>' +
        '<div class="protocolo-meta">' + feitas + ' de ' + obrigatorias.length + ' etapas obrigatórias concluídas ' +
        seloClassificacao(p) + '</div>' +
      '</article>';
    }).join('') :
      '<div class="cartao vazio"><span class="icone">🚨</span>Nenhum protocolo em andamento.<br>' +
      'Ao identificar suspeita de sepse, abra o protocolo para acionar o time.</div>';

    var listaEncerrados = encerrados.length ?
      '<div class="secao-titulo" style="margin-top:28px;"><div><h2>Encerrados</h2></div></div>' +
      '<div class="grade grade-2">' + encerrados.slice(0, 6).map(function (p) {
        return '<article class="cartao cartao-protocolo" data-acao="ver-relatorio" data-id="' + esc(p.id) + '" role="button" tabindex="0">' +
          '<div class="protocolo-cabecalho"><h3>' + esc(p.paciente.nome) + '</h3>' +
          '<span class="selo selo-neutro">Encerrado</span></div>' +
          '<div class="protocolo-meta">' + esc(p.id) + ' · ' + fmtDataHora(p.abertoEm) +
          (p.encerramento ? '<br>Desfecho: ' + esc(p.encerramento.desfecho) : '') + ' ' +
          seloClassificacao(p) + '</div>' +
        '</article>';
      }).join('') + '</div>'
      : '';

    elConteudo.innerHTML =
      '<div class="secao-titulo"><div><h2>Protocolos Sepse</h2>' +
      '<p>Abertura do protocolo, registro das etapas de cada membro e encerramento com histórico completo.</p></div>' +
      '<button type="button" class="botao botao-primario" data-acao="abrir-protocolo-modal">🚨 Abrir Protocolo Sepse</button></div>' +
      '<div class="grade grade-2">' + listaAbertos + '</div>' +
      listaEncerrados;
  }

  function renderEtapa(protocolo, def) {
    var etapa = protocolo.etapas[def.id];
    var aberto = protocolo.status === 'aberto';
    var corpo = '<div class="etapa-titulo">' + esc(def.titulo) +
      (def.opcional ? ' <span class="selo selo-neutro">quando indicado</span>' : '') + '</div>';
    if (def.obs) corpo += '<div class="etapa-obs">' + esc(def.obs) + '</div>';
    if (def.metaDesc) corpo += '<div class="etapa-obs">⏱ ' + esc(def.metaDesc) + '</div>';

    var classe = '';
    var acoes = '';

    if (etapa && etapa.status === 'concluida') {
      classe = 'concluida';
      corpo += '<div class="etapa-registro">✅ Concluída em <strong>' + fmtDataHora(etapa.em) +
        '</strong> por ' + esc(assinatura(etapa.por)) + '</div>';
      if (etapa.observacao) corpo += '<div class="etapa-registro">📝 ' + esc(etapa.observacao) + '</div>';
      var meta = TS.avaliarMeta(def, protocolo);
      if (meta) {
        if (meta.inconsistente) {
          acoes += '<span class="selo selo-alerta">⚠ ordem dos registros inconsistente</span>';
        } else {
          acoes += meta.dentro
            ? '<span class="selo selo-ok">✓ ' + duracaoTexto(meta.minutos) + ' (meta ' + duracaoTexto(meta.limite) + ')</span>'
            : '<span class="selo selo-grave">⚠ ' + duracaoTexto(meta.minutos) + ' (meta ' + duracaoTexto(meta.limite) + ')</span>';
        }
      }
      if (aberto) {
        acoes += '<button type="button" class="botao botao-fantasma botao-mini" data-acao="desfazer-etapa" data-id="' +
          esc(protocolo.id) + '" data-etapa="' + def.id + '">Desfazer</button>';
      }
    } else if (etapa && etapa.status === 'nao_indicada') {
      classe = 'nao-indicada';
      corpo += '<div class="etapa-registro">➖ Não indicada — registrado em ' + fmtDataHora(etapa.em) +
        ' por ' + esc(assinatura(etapa.por)) + '</div>';
      if (etapa.observacao) corpo += '<div class="etapa-registro">📝 ' + esc(etapa.observacao) + '</div>';
      if (aberto) {
        acoes += '<button type="button" class="botao botao-fantasma botao-mini" data-acao="desfazer-etapa" data-id="' +
          esc(protocolo.id) + '" data-etapa="' + def.id + '">Desfazer</button>';
      }
    } else if (aberto) {
      acoes += '<button type="button" class="botao botao-ok botao-mini" data-acao="concluir-etapa" data-id="' +
        esc(protocolo.id) + '" data-etapa="' + def.id + '">✔ Concluir etapa</button>';
      if (def.opcional) {
        acoes += '<button type="button" class="botao botao-secundario botao-mini" data-acao="nao-indicada" data-id="' +
          esc(protocolo.id) + '" data-etapa="' + def.id + '">Não indicada</button>';
      }
    } else {
      corpo += '<div class="etapa-registro">Não registrada até o encerramento.</div>';
    }

    return '<div class="etapa ' + classe + '">' +
      '<div class="etapa-texto">' + corpo + '</div>' +
      '<div class="etapa-acoes">' + acoes + '</div>' +
    '</div>';
  }

  function renderProtocoloDetalhe() {
    var p = protocoloPorId(ui.protocoloId);
    if (!p) { ui.protocoloId = null; renderProtocolos(); return; }

    var aberto = p.status === 'aberto';
    var grupos = GRUPOS_ETAPAS.map(function (grupo) {
      var defs = TS.ETAPAS.filter(function (e) {
        return e.papeis.join(',') === grupo.papeis.join(',');
      });
      return '<section class="grupo-etapas">' +
        '<h3><span class="ponto fundo-' + grupo.papelCor + '">' + grupo.icone + '</span> ' + esc(grupo.titulo) + '</h3>' +
        defs.map(function (def) { return renderEtapa(p, def); }).join('') +
      '</section>';
    }).join('');

    var sofaResumo = '';
    if (p.sofa.length) {
      sofaResumo = '<section class="grupo-etapas"><h3><span class="ponto fundo-medico">🧮</span> SOFA-score</h3>' +
        '<div class="cartao"><div class="rolagem-x"><table class="tabela"><thead><tr>' +
        '<th>Quando</th><th>Médico</th><th class="direita">Pontuação</th><th>Classificação</th></tr></thead><tbody>' +
        p.sofa.map(function (s) {
          return '<tr><td>' + fmtDataHora(s.em) + '</td><td>' + esc(s.por.nome) + '</td>' +
            '<td class="direita"><strong>' + s.resultado.total + '</strong></td>' +
            '<td>' + esc(s.classificacao.rotulo) + '</td></tr>';
        }).join('') + '</tbody></table></div></div></section>';
    }

    var trilha = '<section class="grupo-etapas"><h3><span class="ponto" style="background:var(--tinta-2)">🕐</span> Trilha do atendimento</h3>' +
      '<div class="cartao"><ol class="linha-tempo">' +
      p.eventos.map(function (ev) {
        var classeEv = ev.tipo === 'abertura' || ev.tipo === 'encerramento' ? 'evento-' + ev.tipo :
          (ev.tipo === 'sofa' ? 'evento-sofa' : (ev.tipo === 'etapa' ? 'evento-etapa' : ''));
        return '<li class="' + classeEv + '">' +
          '<div class="evento-quando">' + fmtDataHora(ev.em) + (ev.por ? ' · ' + esc(assinatura(ev.por)) : '') + '</div>' +
          '<div class="evento-titulo">' + esc(ev.titulo) + '</div>' +
          (ev.detalhe ? '<div class="evento-detalhe">' + esc(ev.detalhe) + '</div>' : '') +
        '</li>';
      }).join('') + '</ol></div></section>';

    var acoes = '<div class="protocolo-acoes">';
    if (aberto) {
      acoes += '<button type="button" class="botao botao-secundario" data-acao="ir-sofa" data-id="' + esc(p.id) + '">🧮 Calcular SOFA</button>' +
        '<button type="button" class="botao botao-primario" data-acao="encerrar-protocolo-modal" data-id="' + esc(p.id) + '">Encerrar protocolo</button>';
    } else {
      acoes += '<button type="button" class="botao botao-primario" data-acao="ver-relatorio" data-id="' + esc(p.id) + '">📄 Relatório do atendimento</button>';
    }
    acoes += '</div>';

    var statusSelo = aberto
      ? '<span class="selo selo-aberto">● Em andamento — há <span data-desde="' + esc(p.abertoEm) + '">' +
        duracaoTexto(minutosEntre(p.abertoEm, agoraIso())) + '</span></span>'
      : '<span class="selo selo-neutro">Encerrado ' + fmtDataHora(p.encerramento && p.encerramento.em) + '</span>';

    elConteudo.innerHTML =
      '<button type="button" class="botao botao-fantasma botao-mini no-print" data-acao="voltar-protocolos">← Voltar aos protocolos</button>' +
      '<div class="cartao" style="margin-top:10px;">' +
        '<div class="protocolo-detalhe-cabecalho">' +
          '<div><h2>' + esc(p.paciente.nome) + '</h2>' +
          '<div class="dados-paciente">' + esc(p.id) +
            (p.paciente.prontuario ? ' · Prontuário ' + esc(p.paciente.prontuario) : '') +
            (p.paciente.leito ? ' · Leito ' + esc(p.paciente.leito) : '') +
            (p.paciente.setor ? ' · ' + esc(p.paciente.setor) : '') +
            '<br>Aberto em ' + fmtDataHora(p.abertoEm) + ' por ' + esc(assinatura(p.abertoPor)) + '</div>' +
          '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">' + statusSelo + ' ' + seloClassificacao(p) + '</div></div>' +
          acoes +
        '</div>' +
        (p.encerramento
          ? '<div class="aviso aviso-info" style="margin-top:12px;">🏁 <span>Desfecho: <strong>' + esc(p.encerramento.desfecho) + '</strong>' +
            (p.encerramento.observacao ? ' — ' + esc(p.encerramento.observacao) : '') +
            ' · Encerrado por ' + esc(assinatura(p.encerramento.por)) + '</span></div>'
          : '') +
      '</div>' +
      grupos + sofaResumo + trilha;
  }

  /* ------------------------------ Aba SOFA ------------------------------ */

  function renderSofa() {
    var abertos = protocolosAbertos();
    if (!abertos.length) {
      elConteudo.innerHTML =
        '<div class="secao-titulo"><div><h2>SOFA-score</h2>' +
        '<p>Calculadora do escore SOFA a partir dos resultados dos exames laboratoriais.</p></div></div>' +
        '<div class="cartao vazio"><span class="icone">🧮</span>Nenhum protocolo em andamento.<br>' +
        'Abra um Protocolo Sepse para calcular o SOFA do paciente.</div>';
      return;
    }

    if (!ui.sofaProtocoloId || !protocoloPorId(ui.sofaProtocoloId) ||
        protocoloPorId(ui.sofaProtocoloId).status !== 'aberto') {
      ui.sofaProtocoloId = abertos[0].id;
    }
    var p = protocoloPorId(ui.sofaProtocoloId);
    if (ui.sofaResultado && ui.sofaResultado.protocoloId !== p.id) ui.sofaResultado = null;
    var nora = TS.usoNorepinefrina(p);

    var opcoes = abertos.map(function (pr) {
      return '<option value="' + esc(pr.id) + '"' + (pr.id === p.id ? ' selected' : '') + '>' +
        esc(pr.paciente.nome) + ' — ' + esc(pr.id) + '</option>';
    }).join('');

    var medico = estado.equipe.medico;

    elConteudo.innerHTML =
      '<div class="secao-titulo"><div><h2>SOFA-score</h2>' +
      '<p>Insira os resultados dos exames — o sistema calcula a pontuação e a classificação do caso.</p></div></div>' +

      '<div class="cartao" style="margin-bottom:14px;">' +
        '<label class="campo" style="margin:0;"><span>Protocolo / paciente</span>' +
        '<select id="sofa-protocolo">' + opcoes + '</select></label>' +
        '<div class="aviso ' + (nora ? 'aviso-grave' : 'aviso-info') + '" style="margin-bottom:0;">' +
          (nora ? '⚠ <span><strong>Norepinefrina em uso</strong> registrada no protocolo — o caso será classificado como <strong>Choque Séptico</strong>.</span>'
                : 'ℹ️ <span>Sem registro de norepinefrina no protocolo. Se iniciada, registre a etapa correspondente do médico.</span>') +
        '</div>' +
      '</div>' +

      '<div class="sofa-grade">' +
        '<div class="cartao sofa-bloco"><h4>🫁 Respiratório</h4>' +
          '<div class="campo-linha">' +
          '<label class="campo"><span>PaO₂ (mmHg)</span><input type="number" id="sofa-pao2" min="0" step="1" inputmode="decimal"></label>' +
          '<label class="campo"><span>FiO₂ (%)</span><input type="number" id="sofa-fio2" min="21" max="100" step="1" value="21" inputmode="numeric"></label></div>' +
          '<label class="campo-caixa"><input type="checkbox" id="sofa-suporte"> Em suporte ventilatório (VM/VNI)</label>' +
          '<p class="dica">Pontuações 3 e 4 exigem suporte ventilatório.</p></div>' +

        '<div class="cartao sofa-bloco"><h4>🩸 Coagulação</h4>' +
          '<label class="campo"><span>Plaquetas (×10³/µL)</span><input type="number" id="sofa-plaquetas" min="0" step="1" inputmode="numeric"></label></div>' +

        '<div class="cartao sofa-bloco"><h4>🟡 Hepático</h4>' +
          '<label class="campo"><span>Bilirrubina total (mg/dL)</span><input type="number" id="sofa-bili" min="0" step="0.1" inputmode="decimal"></label></div>' +

        '<div class="cartao sofa-bloco"><h4>❤️ Cardiovascular</h4>' +
          '<label class="campo"><span>PAM — pressão arterial média (mmHg)</span><input type="number" id="sofa-pam" min="0" step="1" inputmode="numeric"></label>' +
          '<div class="campo-linha">' +
          '<label class="campo"><span>Droga vasoativa</span><select id="sofa-droga">' +
            '<option value="nenhuma">Nenhuma</option>' +
            '<option value="dopamina">Dopamina</option>' +
            '<option value="dobutamina">Dobutamina</option>' +
            '<option value="norepinefrina"' + (nora ? ' selected' : '') + '>Norepinefrina</option>' +
            '<option value="adrenalina">Adrenalina</option></select></label>' +
          '<label class="campo"><span>Dose (µg/kg/min)</span><input type="number" id="sofa-dose" min="0" step="0.01" inputmode="decimal"></label></div></div>' +

        '<div class="cartao sofa-bloco"><h4>🧠 Neurológico</h4>' +
          '<label class="campo"><span>Escala de Coma de Glasgow (3–15)</span><input type="number" id="sofa-glasgow" min="3" max="15" step="1" inputmode="numeric"></label></div>' +

        '<div class="cartao sofa-bloco"><h4>💧 Renal</h4>' +
          '<div class="campo-linha">' +
          '<label class="campo"><span>Creatinina (mg/dL)</span><input type="number" id="sofa-creat" min="0" step="0.1" inputmode="decimal"></label>' +
          '<label class="campo"><span>Diurese (mL/24h)</span><input type="number" id="sofa-diurese" min="0" step="10" inputmode="numeric"></label></div>' +
          '<p class="dica">Preencha um dos dois — vale a maior pontuação.</p></div>' +
      '</div>' +

      '<div style="margin:16px 0;display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button type="button" class="botao botao-primario" data-acao="sofa-calcular">🧮 Calcular SOFA</button>' +
        '<p class="dica" style="align-self:center;margin:0;">Campos em branco não pontuam (constam como não avaliados).</p>' +
      '</div>' +

      '<div id="sofa-resultado">' + (ui.sofaResultado ? htmlResultadoSofa(ui.sofaResultado, !!medico) : '') + '</div>';
  }

  function htmlResultadoSofa(calculo, medicoLogado) {
    var r = calculo.resultado;
    var c = calculo.classificacao;
    var linhas = Object.keys(TS.ROTULOS_ORGAOS).map(function (chave) {
      var pontos = r.orgaos[chave];
      return '<tr><td>' + esc(TS.ROTULOS_ORGAOS[chave]) + '</td>' +
        '<td class="direita">' + (pontos === null ? '<span class="selo selo-neutro">não avaliado</span>' : '<strong>' + pontos + '</strong>') + '</td></tr>';
    }).join('');

    var avisos = '';
    if (r.naoAvaliados.length) {
      avisos += '<div class="aviso aviso-info">ℹ️ <span>Sistemas não avaliados (contam 0 ponto): ' +
        r.naoAvaliados.map(function (k) { return esc(TS.ROTULOS_ORGAOS[k]); }).join('; ') + '.</span></div>';
    }
    if (c.alerta) {
      avisos += '<div class="aviso aviso-alerta">⚠ <span>' + esc(c.alerta) + '</span></div>';
    }
    if (calculo.noraSemEtapa) {
      avisos += '<div class="aviso aviso-alerta">⚠ <span>Norepinefrina informada no cálculo, mas a etapa ' +
        '<strong>Norepinefrina</strong> do médico não está registrada no protocolo. Registre a etapa para o caso ' +
        'ser classificado como <strong>Choque Séptico</strong>.</span></div>';
    }

    return '<div class="cartao">' +
      '<div class="sofa-resultado-total"><div class="numero">' + r.total + '</div>' +
      '<div class="legenda">pontos no SOFA-score' +
      (r.relacaoPF !== null ? ' · PaO₂/FiO₂ = ' + r.relacaoPF : '') + '</div></div>' +
      '<div class="classificacao classificacao-' + c.codigo + '">' +
        (c.codigo === 'sepse_excluida' ? '✅' : '🚨') +
        '<div>' + esc(c.rotulo) + '<div class="detalhe">' + esc(c.detalhe) + '</div></div></div>' +
      avisos +
      '<div class="rolagem-x" style="margin-top:12px;"><table class="tabela"><thead><tr><th>Sistema</th><th class="direita">Pontos</th></tr></thead>' +
      '<tbody>' + linhas + '</tbody></table></div>' +
      '<div class="modal-acoes">' +
        '<button type="button" class="botao botao-ok" data-acao="sofa-salvar" ' + (medicoLogado ? '' : 'disabled') + '>💾 Registrar no protocolo</button>' +
      '</div>' +
      (medicoLogado ? '' : '<p class="dica" style="text-align:right;">Apenas o médico em plantão pode registrar o SOFA. Faça login na aba Equipe.</p>') +
    '</div>';
  }

  /* ------------------------------ Aba Auditoria ------------------------------ */

  function renderAuditoria() {
    if (!estado.equipe.lider) {
      elConteudo.innerHTML =
        '<div class="cartao bloqueio-auditoria">' +
        '<span class="icone">🔒</span>' +
        '<h2>Área do Líder/Gestor do Time Sepse</h2>' +
        '<p style="color:var(--tinta-2);">O histórico completo dos atendimentos e os indicadores do protocolo ficam disponíveis para auditoria após o login do líder/gestor.</p>' +
        '<button type="button" class="botao botao-primario" data-acao="iniciar-plantao" data-papel="lider">Entrar como Líder/Gestor</button>' +
        '</div>';
      return;
    }

    var todos = estado.protocolos;
    var encerrados = todos.filter(function (p) { return p.status === 'encerrado'; });
    var choques = todos.filter(function (p) {
      var c = classificacaoAtual(p);
      return c && c.codigo === 'choque_septico';
    }).length;

    function estatisticaMeta(etapaId) {
      var def = TS.etapaPorId(etapaId);
      var metas = todos.map(function (p) { return TS.avaliarMeta(def, p); })
        .filter(function (m) { return m && !m.inconsistente; });
      return {
        total: metas.length,
        dentro: metas.filter(function (m) { return m.dentro; }).length
      };
    }

    var atb = estatisticaMeta('enf_instalacao_atb');
    var lactato = estatisticaMeta('lab_lactato');
    var demais = estatisticaMeta('lab_demais');

    function kpi(valor, rotulo, apoio) {
      return '<div class="kpi"><div class="kpi-valor">' + valor + '</div>' +
        '<div class="kpi-rotulo">' + esc(rotulo) + '</div>' +
        (apoio ? '<div class="kpi-apoio">' + esc(apoio) + '</div>' : '') + '</div>';
    }

    function fracao(est) {
      return est.total ? est.dentro + '/' + est.total : '—';
    }
    function pct(est) {
      return est.total ? Math.round((est.dentro / est.total) * 100) + '% dentro da meta' : 'sem registros';
    }

    var linhas = todos.map(function (p) {
      var sofa = TS.ultimoSofa(p);
      var c = classificacaoAtual(p);
      var duracao = p.encerramento
        ? duracaoTexto(minutosEntre(p.abertoEm, p.encerramento.em))
        : '<span class="selo selo-aberto">em andamento</span>';
      return '<tr>' +
        '<td>' + esc(p.id) + '</td>' +
        '<td>' + esc(p.paciente.nome) + (p.paciente.leito ? '<br><span class="dica">Leito ' + esc(p.paciente.leito) + '</span>' : '') + '</td>' +
        '<td>' + fmtDataHora(p.abertoEm) + '</td>' +
        '<td>' + (p.encerramento ? fmtDataHora(p.encerramento.em) : '—') + '</td>' +
        '<td>' + duracao + '</td>' +
        '<td class="direita">' + (sofa ? '<strong>' + sofa.resultado.total + '</strong>' : '—') + '</td>' +
        '<td>' + (c ? esc(c.rotulo) : '—') + '</td>' +
        '<td>' + (p.encerramento ? esc(p.encerramento.desfecho) : '—') + '</td>' +
        '<td><button type="button" class="botao botao-secundario botao-mini" data-acao="ver-relatorio" data-id="' + esc(p.id) + '">Relatório</button></td>' +
      '</tr>';
    }).join('');

    var turnos = estado.turnos.slice().reverse().slice(0, 30).map(function (t) {
      return '<tr><td>' + esc(t.nome) + (t.registro ? '<br><span class="dica">' + esc(t.registro) + '</span>' : '') + '</td>' +
        '<td>' + esc(nomePapel(t.papel)) + '</td>' +
        '<td>' + fmtDataHora(t.entrada) + '</td>' +
        '<td>' + (t.saida ? fmtDataHora(t.saida) : '<span class="selo selo-aberto">em plantão</span>') + '</td></tr>';
    }).join('');

    elConteudo.innerHTML =
      '<div class="secao-titulo"><div><h2>Auditoria do Time Sepse</h2>' +
      '<p>Histórico dos atendimentos, indicadores das metas do protocolo e registro de plantões.</p></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button type="button" class="botao botao-secundario" data-acao="exportar-csv">⬇ CSV</button>' +
        '<button type="button" class="botao botao-secundario" data-acao="exportar-tudo-json">⬇ JSON</button>' +
      '</div></div>' +

      '<div class="kpis" style="margin-bottom:16px;">' +
        kpi(todos.length, 'Protocolos abertos no total', '') +
        kpi(encerrados.length, 'Atendimentos encerrados', todos.length - encerrados.length + ' em andamento') +
        kpi(choques, 'Casos de choque séptico', '') +
        kpi(fracao(atb), 'Antibiótico na 1ª hora', pct(atb)) +
        kpi(fracao(lactato), 'Lactato liberado ≤ 30 min', pct(lactato)) +
        kpi(fracao(demais), 'Demais exames ≤ 2 h', pct(demais)) +
      '</div>' +

      '<div class="cartao" style="margin-bottom:16px;">' +
        '<h3 style="margin-top:0;">Atendimentos</h3>' +
        (todos.length
          ? '<div class="rolagem-x"><table class="tabela"><thead><tr>' +
            '<th>Protocolo</th><th>Paciente</th><th>Abertura</th><th>Encerramento</th><th>Duração</th>' +
            '<th class="direita">SOFA</th><th>Classificação</th><th>Desfecho</th><th></th>' +
            '</tr></thead><tbody>' + linhas + '</tbody></table></div>'
          : '<p class="dica">Nenhum protocolo registrado ainda.</p>') +
      '</div>' +

      '<div class="cartao">' +
        '<h3 style="margin-top:0;">Registro de plantões (últimos 30)</h3>' +
        (estado.turnos.length
          ? '<div class="rolagem-x"><table class="tabela"><thead><tr>' +
            '<th>Profissional</th><th>Função</th><th>Entrada</th><th>Saída</th>' +
            '</tr></thead><tbody>' + turnos + '</tbody></table></div>'
          : '<p class="dica">Nenhum plantão registrado ainda.</p>') +
      '</div>';
  }

  /* ------------------------------ Relatório ------------------------------ */

  function renderRelatorio() {
    var p = protocoloPorId(ui.relatorioId);
    if (!p) { ui.relatorioId = null; render(); return; }

    var equipeParticipante = {};
    p.eventos.forEach(function (ev) {
      if (ev.por) equipeParticipante[ev.por.papel + '|' + ev.por.nome] = ev.por;
    });

    var etapasHtml = GRUPOS_ETAPAS.map(function (grupo) {
      var defs = TS.ETAPAS.filter(function (e) { return e.papeis.join(',') === grupo.papeis.join(','); });
      var linhas = defs.map(function (def) {
        var e = p.etapas[def.id];
        var quando = '—', quem = '—', situacao = 'Não registrada';
        var metaTxt = '';
        if (e) {
          quando = fmtDataHora(e.em);
          quem = assinatura(e.por);
          situacao = e.status === 'concluida' ? 'Concluída' : 'Não indicada';
          var meta = TS.avaliarMeta(def, p);
          if (meta) {
            metaTxt = meta.inconsistente
              ? '⚠ ordem dos registros inconsistente'
              : (meta.dentro ? '✓ dentro da meta' : '⚠ fora da meta') + ' (' + duracaoTexto(meta.minutos) + ' / meta ' + duracaoTexto(meta.limite) + ')';
          }
        }
        return '<tr><td>' + esc(def.titulo) + '</td><td>' + esc(situacao) + '</td><td>' + quando + '</td><td>' + esc(quem) + '</td><td>' + esc(metaTxt) + '</td></tr>';
      }).join('');
      return '<div class="relatorio-secao"><h3>' + grupo.icone + ' ' + esc(grupo.titulo) + '</h3>' +
        '<div class="rolagem-x"><table class="tabela"><thead><tr><th>Etapa</th><th>Situação</th><th>Data/horário</th><th>Responsável</th><th>Meta</th></tr></thead>' +
        '<tbody>' + linhas + '</tbody></table></div></div>';
    }).join('');

    var sofaHtml = p.sofa.length
      ? '<div class="rolagem-x"><table class="tabela"><thead><tr><th>Quando</th><th>Médico</th><th class="direita">Total</th><th>Classificação</th></tr></thead><tbody>' +
        p.sofa.map(function (s) {
          return '<tr><td>' + fmtDataHora(s.em) + '</td><td>' + esc(s.por.nome) + '</td>' +
            '<td class="direita"><strong>' + s.resultado.total + '</strong></td><td>' + esc(s.classificacao.rotulo) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
      : '<p class="dica">Nenhum cálculo de SOFA registrado.</p>';

    var trilhaHtml = '<ol class="linha-tempo">' + p.eventos.map(function (ev) {
      return '<li><div class="evento-quando">' + fmtDataHora(ev.em) + (ev.por ? ' · ' + esc(assinatura(ev.por)) : '') + '</div>' +
        '<div class="evento-titulo">' + esc(ev.titulo) + '</div>' +
        (ev.detalhe ? '<div class="evento-detalhe">' + esc(ev.detalhe) + '</div>' : '') + '</li>';
    }).join('') + '</ol>';

    var c = classificacaoAtual(p);

    elConteudo.innerHTML =
      '<div class="no-print" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">' +
        '<button type="button" class="botao botao-fantasma botao-mini" data-acao="fechar-relatorio">← Voltar</button>' +
        '<button type="button" class="botao botao-secundario botao-mini" data-acao="imprimir">🖨 Imprimir / PDF</button>' +
        '<button type="button" class="botao botao-secundario botao-mini" data-acao="exportar-json" data-id="' + esc(p.id) + '">⬇ Exportar JSON</button>' +
      '</div>' +

      '<div class="cartao relatorio">' +
        '<h2>Relatório do atendimento — Protocolo Sepse</h2>' +
        '<p class="dica">Time Sepse App · documento gerado em ' + fmtDataHora(agoraIso()) + '</p>' +

        '<div class="relatorio-secao"><h3>🧾 Identificação</h3>' +
          '<div class="rolagem-x"><table class="tabela"><tbody>' +
          '<tr><th>Protocolo</th><td>' + esc(p.id) + '</td></tr>' +
          '<tr><th>Paciente</th><td>' + esc(p.paciente.nome) + '</td></tr>' +
          (p.paciente.prontuario ? '<tr><th>Prontuário</th><td>' + esc(p.paciente.prontuario) + '</td></tr>' : '') +
          (p.paciente.leito ? '<tr><th>Leito</th><td>' + esc(p.paciente.leito) + '</td></tr>' : '') +
          (p.paciente.setor ? '<tr><th>Setor</th><td>' + esc(p.paciente.setor) + '</td></tr>' : '') +
          '<tr><th>Abertura</th><td>' + fmtDataHora(p.abertoEm) + ' — ' + esc(assinatura(p.abertoPor)) + '</td></tr>' +
          (p.encerramento
            ? '<tr><th>Encerramento</th><td>' + fmtDataHora(p.encerramento.em) + ' — ' + esc(assinatura(p.encerramento.por)) + '</td></tr>' +
              '<tr><th>Duração</th><td>' + duracaoTexto(minutosEntre(p.abertoEm, p.encerramento.em)) + '</td></tr>' +
              '<tr><th>Desfecho</th><td>' + esc(p.encerramento.desfecho) +
                (p.encerramento.observacao ? ' — ' + esc(p.encerramento.observacao) : '') + '</td></tr>'
            : '<tr><th>Situação</th><td>Em andamento</td></tr>') +
          (c ? '<tr><th>Classificação</th><td><strong>' + esc(c.rotulo) + '</strong> — ' + esc(c.detalhe) + '</td></tr>' : '') +
          '</tbody></table></div></div>' +

        etapasHtml +

        '<div class="relatorio-secao"><h3>🧮 SOFA-score</h3>' + sofaHtml + '</div>' +

        '<div class="relatorio-secao"><h3>👥 Equipe participante</h3><ul>' +
          Object.keys(equipeParticipante).map(function (chave) {
            var m = equipeParticipante[chave];
            return '<li>' + esc(m.nome) + ' — ' + esc(nomePapel(m.papel)) + '</li>';
          }).join('') + '</ul></div>' +

        '<div class="relatorio-secao"><h3>🕐 Trilha completa do atendimento</h3>' + trilhaHtml + '</div>' +
      '</div>';
  }

  /* ------------------------------------------------------------------ *
   * Modais
   * ------------------------------------------------------------------ */

  var elModalRaiz = document.getElementById('modal-raiz');

  function abrirModal(html) {
    elModalRaiz.innerHTML = '<div class="modal-fundo" data-acao="fechar-modal-fundo"><div class="modal" role="dialog" aria-modal="true">' + html + '</div></div>';
    var primeiro = elModalRaiz.querySelector('input, select, textarea');
    if (primeiro) primeiro.focus();
  }

  function fecharModal() { elModalRaiz.innerHTML = ''; }

  function botoesModal(rotuloConfirmar, classe) {
    return '<div class="modal-acoes">' +
      '<button type="button" class="botao botao-fantasma" data-acao="fechar-modal">Cancelar</button>' +
      '<button type="submit" class="botao ' + (classe || 'botao-primario') + '">' + rotuloConfirmar + '</button></div>';
  }

  function modalLogin(papel) {
    var info = TS.PAPEIS[papel];
    var atual = estado.equipe[papel];
    var rotuloRegistro = { medico: 'CRM', enfermeiro: 'COREN', tecnico: 'COREN', fisioterapeuta: 'CREFITO', analista: 'Registro (CRF/CRBM)', lider: 'Registro' }[papel] || 'Registro';
    abrirModal(
      '<h3>' + info.icone + ' ' + esc(info.nome) + ' — iniciar plantão</h3>' +
      '<p class="modal-sub">O login registra a entrada no turno com dia e horário.</p>' +
      (atual ? '<div class="aviso aviso-alerta">⚠ <span>' + esc(atual.nome) + ' está em plantão nesta função. Ao confirmar, o turno atual será encerrado.</span></div>' : '') +
      '<form id="form-login" data-papel="' + papel + '">' +
        '<label class="campo"><span>Nome completo</span><input type="text" name="nome" required autocomplete="name" placeholder="Ex.: ' +
          (papel === 'medico' ? 'Dra. Ana Souza' : 'Carlos Lima') + '"></label>' +
        '<label class="campo"><span>' + rotuloRegistro + ' (opcional)</span><input type="text" name="registro" placeholder="Número do conselho"></label>' +
        botoesModal('Iniciar plantão') +
      '</form>'
    );
  }

  function modalAbrirProtocolo() {
    var logados = membrosLogados().filter(function (m) { return m.papel !== 'lider'; });
    if (!logados.length) {
      toast('Nenhum membro do time em plantão. Registre a entrada na aba Equipe antes de abrir o protocolo.', 'erro');
      ui.aba = 'equipe';
      render();
      return;
    }
    var opcoes = logados.map(function (m, i) {
      return '<label><input type="radio" name="responsavel" value="' + m.papel + '"' + (i === 0 ? ' checked' : '') + '> ' +
        iconePapel(m.papel) + ' ' + esc(m.nome) + ' — ' + esc(nomePapel(m.papel)) + '</label>';
    }).join('');
    abrirModal(
      '<h3>🚨 Abrir Protocolo Sepse</h3>' +
      '<p class="modal-sub">A abertura aciona o time e inicia a contagem das metas de tempo.</p>' +
      '<form id="form-protocolo">' +
        '<label class="campo"><span>Nome do paciente</span><input type="text" name="nome" required></label>' +
        '<div class="campo-linha">' +
        '<label class="campo"><span>Prontuário</span><input type="text" name="prontuario" required></label>' +
        '<label class="campo"><span>Leito</span><input type="text" name="leito"></label></div>' +
        '<label class="campo"><span>Setor</span><input type="text" name="setor" placeholder="Ex.: Pronto Atendimento, UTI, Clínica Médica"></label>' +
        '<span class="campo"><span>Quem está abrindo o protocolo</span></span>' +
        '<div class="lista-opcoes">' + opcoes + '</div>' +
        botoesModal('Abrir protocolo') +
      '</form>'
    );
  }

  function modalEtapa(protocoloId, etapaId, naoIndicada) {
    var p = protocoloPorId(protocoloId);
    var def = TS.etapaPorId(etapaId);
    if (!p || !def) return;
    var elegiveis = membrosElegiveis(def.papeis);
    if (!elegiveis.length) {
      var nomes = def.papeis.map(nomePapel).join(' ou ');
      toast('Nenhum(a) ' + nomes + ' em plantão. Registre a entrada na aba Equipe.', 'erro');
      return;
    }
    var opcoes = elegiveis.map(function (m, i) {
      return '<label><input type="radio" name="membro" value="' + m.papel + '"' + (i === 0 ? ' checked' : '') + '> ' +
        iconePapel(m.papel) + ' ' + esc(m.nome) + ' — ' + esc(nomePapel(m.papel)) + '</label>';
    }).join('');

    var avisoNora = (etapaId === 'med_norepinefrina' && !naoIndicada)
      ? '<div class="aviso aviso-grave">⚠ <span>Registrar a infusão de norepinefrina classifica o caso como <strong>Choque Séptico</strong>.</span></div>'
      : '';

    abrirModal(
      '<h3>' + (naoIndicada ? '➖ Marcar como não indicada' : '✔ Concluir etapa') + '</h3>' +
      '<p class="modal-sub">' + esc(def.titulo) + ' · ' + esc(p.paciente.nome) + ' (' + esc(p.id) + ')</p>' +
      avisoNora +
      '<form id="form-etapa" data-id="' + esc(protocoloId) + '" data-etapa="' + etapaId + '" data-nao-indicada="' + (naoIndicada ? '1' : '') + '">' +
        '<span class="campo"><span>Quem está registrando</span></span>' +
        '<div class="lista-opcoes">' + opcoes + '</div>' +
        '<label class="campo"><span>Observação (opcional)</span><textarea name="observacao" placeholder="Ex.: detalhes relevantes do atendimento"></textarea></label>' +
        botoesModal(naoIndicada ? 'Registrar como não indicada' : 'Registrar conclusão', naoIndicada ? 'botao-secundario' : 'botao-ok') +
      '</form>'
    );
  }

  function modalDesfazer(protocoloId, etapaId) {
    var p = protocoloPorId(protocoloId);
    var def = TS.etapaPorId(etapaId);
    if (!p || !def) return;
    var elegiveis = membrosElegiveis(def.papeis.concat(['lider']));
    if (!elegiveis.length) {
      toast('Apenas um membro em plantão da função responsável (ou o líder) pode desfazer o registro.', 'erro');
      return;
    }
    var opcoes = elegiveis.map(function (m, i) {
      return '<label><input type="radio" name="membro" value="' + m.papel + '"' + (i === 0 ? ' checked' : '') + '> ' +
        iconePapel(m.papel) + ' ' + esc(m.nome) + ' — ' + esc(nomePapel(m.papel)) + '</label>';
    }).join('');
    var avisoDependencia = '';
    if (etapaId === 'lab_recebimento') {
      var dependentes = ['lab_lactato', 'lab_demais'].filter(function (id) {
        var e = p.etapas[id];
        return e && e.status === 'concluida';
      });
      if (dependentes.length) {
        avisoDependencia = '<div class="aviso aviso-alerta">⚠ <span>Liberações já registradas usam este recebimento ' +
          'como referência de meta — ao desfazer, as metas passam a contar da abertura do protocolo.</span></div>';
      }
    }
    abrirModal(
      '<h3>↩ Desfazer registro</h3>' +
      '<p class="modal-sub">' + esc(def.titulo) + ' · ' + esc(p.paciente.nome) + '</p>' +
      avisoDependencia +
      '<div class="aviso aviso-info">ℹ️ <span>A correção fica registrada na trilha do atendimento (nada é apagado do histórico).</span></div>' +
      '<form id="form-desfazer" data-id="' + esc(protocoloId) + '" data-etapa="' + etapaId + '">' +
        '<span class="campo"><span>Quem está corrigindo</span></span>' +
        '<div class="lista-opcoes">' + opcoes + '</div>' +
        '<label class="campo"><span>Motivo (opcional)</span><input type="text" name="motivo" placeholder="Ex.: registrado por engano"></label>' +
        botoesModal('Desfazer registro', 'botao-secundario') +
      '</form>'
    );
  }

  function modalEncerrar(protocoloId) {
    var p = protocoloPorId(protocoloId);
    if (!p) return;
    var elegiveis = membrosElegiveis(['medico', 'lider']);
    if (!elegiveis.length) {
      toast('O encerramento deve ser registrado pelo médico ou pelo líder/gestor em plantão.', 'erro');
      return;
    }
    var pendentes = TS.pendenciasObrigatorias(p);
    var avisoPendencias = pendentes.length
      ? '<div class="aviso aviso-alerta">⚠ <span><strong>' + pendentes.length + ' etapa(s) obrigatória(s) sem registro:</strong><br>' +
        pendentes.map(function (e) { return '• ' + esc(e.titulo); }).join('<br>') + '</span></div>' +
        '<label class="campo-caixa"><input type="checkbox" name="confirmar-pendencias" required> Encerrar mesmo com etapas sem registro</label>'
      : '';
    var opcoes = elegiveis.map(function (m, i) {
      return '<label><input type="radio" name="responsavel" value="' + m.papel + '"' + (i === 0 ? ' checked' : '') + '> ' +
        iconePapel(m.papel) + ' ' + esc(m.nome) + ' — ' + esc(nomePapel(m.papel)) + '</label>';
    }).join('');
    var desfechos = DESFECHOS.map(function (d) { return '<option value="' + esc(d) + '">' + esc(d) + '</option>'; }).join('');
    var semSofa = !p.sofa.length
      ? '<div class="aviso aviso-info">ℹ️ <span>Nenhum SOFA-score foi registrado neste protocolo.</span></div>'
      : '';

    abrirModal(
      '<h3>🏁 Encerrar protocolo</h3>' +
      '<p class="modal-sub">' + esc(p.paciente.nome) + ' (' + esc(p.id) + ') — o encerramento gera o relatório do atendimento para auditoria.</p>' +
      semSofa +
      '<form id="form-encerrar" data-id="' + esc(protocoloId) + '">' +
        avisoPendencias +
        '<label class="campo"><span>Desfecho</span><select name="desfecho" required>' + desfechos + '</select></label>' +
        '<label class="campo"><span>Observações (opcional)</span><textarea name="observacao"></textarea></label>' +
        '<span class="campo"><span>Quem está encerrando</span></span>' +
        '<div class="lista-opcoes">' + opcoes + '</div>' +
        botoesModal('Encerrar e gerar relatório') +
      '</form>'
    );
  }

  /* ------------------------------------------------------------------ *
   * Exportação
   * ------------------------------------------------------------------ */

  function baixarArquivo(nome, conteudo, tipo) {
    var blob = new Blob([conteudo], { type: tipo });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function exportarJson(protocolo) {
    baixarArquivo(protocolo.id + '.json', JSON.stringify(protocolo, null, 2), 'application/json');
  }

  function exportarTudoJson() {
    baixarArquivo('time-sepse-atendimentos.json',
      JSON.stringify({ geradoEm: agoraIso(), protocolos: estado.protocolos, turnos: estado.turnos }, null, 2),
      'application/json');
  }

  function csvCampo(v) {
    var s = String(v == null ? '' : v);
    if (/[";\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function exportarCsv() {
    var cab = ['protocolo', 'paciente', 'prontuario', 'leito', 'setor', 'status', 'abertura', 'aberto_por',
      'encerramento', 'encerrado_por', 'duracao_min', 'desfecho', 'sofa_total', 'classificacao',
      'atb_min', 'atb_dentro_meta', 'lactato_min', 'lactato_dentro_meta', 'demais_exames_min', 'demais_dentro_meta'];
    TS.ETAPAS.forEach(function (e) { cab.push(e.id + '_situacao', e.id + '_em', e.id + '_por'); });

    var linhas = estado.protocolos.map(function (p) {
      var sofa = TS.ultimoSofa(p);
      var c = classificacaoAtual(p);
      var mAtb = TS.avaliarMeta(TS.etapaPorId('enf_instalacao_atb'), p);
      var mLac = TS.avaliarMeta(TS.etapaPorId('lab_lactato'), p);
      var mDem = TS.avaliarMeta(TS.etapaPorId('lab_demais'), p);
      var linha = [
        p.id, p.paciente.nome, p.paciente.prontuario || '', p.paciente.leito || '', p.paciente.setor || '',
        p.status, p.abertoEm, assinatura(p.abertoPor),
        p.encerramento ? p.encerramento.em : '', p.encerramento ? assinatura(p.encerramento.por) : '',
        p.encerramento ? Math.round(minutosEntre(p.abertoEm, p.encerramento.em)) : '',
        p.encerramento ? p.encerramento.desfecho : '',
        sofa ? sofa.resultado.total : '', c ? c.rotulo : '',
        mAtb ? mAtb.minutos : '', mAtb ? (mAtb.inconsistente ? 'inconsistente' : (mAtb.dentro ? 'sim' : 'não')) : '',
        mLac ? mLac.minutos : '', mLac ? (mLac.inconsistente ? 'inconsistente' : (mLac.dentro ? 'sim' : 'não')) : '',
        mDem ? mDem.minutos : '', mDem ? (mDem.inconsistente ? 'inconsistente' : (mDem.dentro ? 'sim' : 'não')) : ''
      ];
      TS.ETAPAS.forEach(function (def) {
        var e = p.etapas[def.id];
        linha.push(e ? (e.status === 'concluida' ? 'concluída' : 'não indicada') : '');
        linha.push(e ? e.em : '');
        linha.push(e ? assinatura(e.por) : '');
      });
      return linha.map(csvCampo).join(';');
    });

    baixarArquivo('time-sepse-atendimentos.csv',
      '\uFEFF' + cab.join(';') + '\n' + linhas.join('\n'),
      'text/csv;charset=utf-8');
  }

  /* ------------------------------------------------------------------ *
   * Toast
   * ------------------------------------------------------------------ */

  var elToastRaiz = document.getElementById('toast-raiz');

  function toast(mensagem, tipo) {
    var el = document.createElement('div');
    el.className = 'toast' + (tipo === 'erro' ? ' toast-erro' : (tipo === 'ok' ? ' toast-ok' : ''));
    el.textContent = mensagem;
    elToastRaiz.appendChild(el);
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 4500);
  }

  /* ------------------------------------------------------------------ *
   * Eventos
   * ------------------------------------------------------------------ */

  function membroPorPapel(papel) {
    var m = estado.equipe[papel];
    return m ? { nome: m.nome, papel: papel } : null;
  }

  document.addEventListener('click', function (evento) {
    var alvo = evento.target.closest('[data-acao]');
    if (!alvo) return;
    var acao = alvo.dataset.acao;

    // Fechar modal clicando no fundo (mas não dentro da caixa)
    if (acao === 'fechar-modal-fundo') {
      if (evento.target === alvo) fecharModal();
      return;
    }

    switch (acao) {
      case 'fechar-modal': fecharModal(); break;

      case 'iniciar-plantao': modalLogin(alvo.dataset.papel); break;

      case 'encerrar-plantao': {
        var papel = alvo.dataset.papel;
        var membro = estado.equipe[papel];
        sairTurno(papel);
        toast('Turno de ' + (membro ? membro.nome : '') + ' encerrado.', 'ok');
        render();
        break;
      }

      case 'abrir-protocolo-modal': modalAbrirProtocolo(); break;

      case 'ver-protocolo':
        ui.aba = 'protocolos';
        ui.protocoloId = alvo.dataset.id;
        ui.relatorioId = null;
        render();
        break;

      case 'voltar-protocolos':
        ui.protocoloId = null;
        render();
        break;

      case 'concluir-etapa': modalEtapa(alvo.dataset.id, alvo.dataset.etapa, false); break;
      case 'nao-indicada': modalEtapa(alvo.dataset.id, alvo.dataset.etapa, true); break;
      case 'desfazer-etapa': modalDesfazer(alvo.dataset.id, alvo.dataset.etapa); break;

      case 'ir-sofa':
        ui.aba = 'sofa';
        ui.sofaProtocoloId = alvo.dataset.id;
        ui.sofaResultado = null;
        ui.relatorioId = null;
        render();
        break;

      case 'sofa-calcular': calcularSofaUI(); break;
      case 'sofa-salvar': salvarSofaUI(); break;

      case 'encerrar-protocolo-modal': modalEncerrar(alvo.dataset.id); break;

      case 'ver-relatorio':
        ui.relatorioId = alvo.dataset.id;
        render();
        window.scrollTo(0, 0);
        break;

      case 'fechar-relatorio':
        ui.relatorioId = null;
        render();
        break;

      case 'imprimir': window.print(); break;

      case 'exportar-json': {
        var p = protocoloPorId(alvo.dataset.id);
        if (p) exportarJson(p);
        break;
      }
      case 'exportar-tudo-json': exportarTudoJson(); break;
      case 'exportar-csv': exportarCsv(); break;
    }
  });

  // Cartões clicáveis acessíveis por teclado
  document.addEventListener('keydown', function (evento) {
    if (evento.key === 'Escape') { fecharModal(); return; }
    if ((evento.key === 'Enter' || evento.key === ' ') && evento.target.matches('[role="button"][data-acao]')) {
      evento.preventDefault();
      evento.target.click();
    }
  });

  elAbas.addEventListener('click', function (evento) {
    var botao = evento.target.closest('button[data-aba]');
    if (!botao) return;
    ui.aba = botao.dataset.aba;
    ui.relatorioId = null;
    if (ui.aba !== 'protocolos') ui.protocoloId = null;
    render();
  });

  document.addEventListener('change', function (evento) {
    if (evento.target.id === 'sofa-protocolo') {
      ui.sofaProtocoloId = evento.target.value;
      ui.sofaResultado = null;
      render();
    }
  });

  document.addEventListener('submit', function (evento) {
    var form = evento.target;
    evento.preventDefault();
    var dados = new FormData(form);

    if (form.id === 'form-login') {
      var papel = form.dataset.papel;
      var nome = String(dados.get('nome') || '').trim();
      if (!nome) return;
      entrarTurno(papel, nome, String(dados.get('registro') || '').trim());
      fecharModal();
      toast(nomePapel(papel) + ' ' + nome + ' em plantão. Entrada registrada em ' + fmtDataHora(estado.equipe[papel].entrouEm) + '.', 'ok');
      render();
    }

    else if (form.id === 'form-protocolo') {
      var responsavel = membroPorPapel(String(dados.get('responsavel')));
      if (!responsavel) return;
      var protocolo = abrirProtocolo({
        nome: String(dados.get('nome') || '').trim(),
        prontuario: String(dados.get('prontuario') || '').trim(),
        leito: String(dados.get('leito') || '').trim(),
        setor: String(dados.get('setor') || '').trim()
      }, responsavel);
      fecharModal();
      ui.aba = 'protocolos';
      ui.protocoloId = protocolo.id;
      toast('Protocolo ' + protocolo.id + ' aberto às ' + fmtHora(protocolo.abertoEm) + '. Time Sepse acionado!', 'ok');
      render();
    }

    else if (form.id === 'form-etapa') {
      var p1 = protocoloPorId(form.dataset.id);
      var membro1 = membroPorPapel(String(dados.get('membro')));
      if (!p1 || !membro1 || p1.status !== 'aberto') { fecharModal(); render(); return; }
      var obs = String(dados.get('observacao') || '').trim();
      if (form.dataset.naoIndicada === '1') {
        marcarNaoIndicada(p1, form.dataset.etapa, membro1, obs);
        toast('Etapa registrada como não indicada.', 'ok');
      } else {
        concluirEtapa(p1, form.dataset.etapa, membro1, obs);
        toast('Etapa concluída e registrada às ' + fmtHora(p1.etapas[form.dataset.etapa].em) + '.', 'ok');
      }
      fecharModal();
      render();
    }

    else if (form.id === 'form-desfazer') {
      var p2 = protocoloPorId(form.dataset.id);
      var membro2 = membroPorPapel(String(dados.get('membro')));
      if (!p2 || !membro2 || p2.status !== 'aberto') { fecharModal(); render(); return; }
      desfazerEtapa(p2, form.dataset.etapa, membro2, String(dados.get('motivo') || '').trim());
      fecharModal();
      toast('Registro desfeito. A correção consta na trilha do atendimento.', 'ok');
      render();
    }

    else if (form.id === 'form-encerrar') {
      var p3 = protocoloPorId(form.dataset.id);
      var responsavel3 = membroPorPapel(String(dados.get('responsavel')));
      if (!p3 || !responsavel3 || p3.status !== 'aberto') { fecharModal(); render(); return; }
      if (TS.pendenciasObrigatorias(p3).length && !dados.get('confirmar-pendencias')) {
        toast('Há etapas obrigatórias sem registro — confirme o encerramento marcando a caixa.', 'erro');
        return;
      }
      encerrarProtocolo(p3, String(dados.get('desfecho')), String(dados.get('observacao') || '').trim(), responsavel3);
      fecharModal();
      ui.relatorioId = p3.id;
      toast('Protocolo encerrado. Relatório disponível para auditoria.', 'ok');
      render();
      window.scrollTo(0, 0);
    }
  });

  /* ------------------------------ SOFA (interface) ------------------------------ */

  function valorCampo(id) {
    var el = document.getElementById(id);
    if (!el || el.value === '') return null;
    return el.value;
  }

  function calcularSofaUI() {
    var p = protocoloPorId(ui.sofaProtocoloId);
    if (!p) { toast('Selecione um protocolo em andamento.', 'erro'); return; }

    var glasgow = valorCampo('sofa-glasgow');
    if (glasgow !== null && (Number(glasgow) < 3 || Number(glasgow) > 15)) {
      toast('Glasgow deve estar entre 3 e 15.', 'erro');
      return;
    }
    var fio2 = valorCampo('sofa-fio2');
    var pao2 = valorCampo('sofa-pao2');
    if (pao2 !== null && fio2 !== null && (Number(fio2) < 21 || Number(fio2) > 100)) {
      toast('FiO₂ deve estar entre 21% e 100%.', 'erro');
      return;
    }
    var naoNegativos = [
      ['sofa-pao2', 'PaO₂'], ['sofa-plaquetas', 'Plaquetas'], ['sofa-bili', 'Bilirrubina'],
      ['sofa-pam', 'PAM'], ['sofa-dose', 'Dose da droga vasoativa'],
      ['sofa-creat', 'Creatinina'], ['sofa-diurese', 'Diurese']
    ];
    for (var i = 0; i < naoNegativos.length; i++) {
      var valor = valorCampo(naoNegativos[i][0]);
      if (valor !== null && Number(valor) < 0) {
        toast(naoNegativos[i][1] + ' não pode ser um valor negativo.', 'erro');
        return;
      }
    }

    var entradas = {
      pao2: pao2,
      fio2: fio2,
      suporteVentilatorio: !!(document.getElementById('sofa-suporte') || {}).checked,
      plaquetas: valorCampo('sofa-plaquetas'),
      bilirrubina: valorCampo('sofa-bili'),
      pam: valorCampo('sofa-pam'),
      droga: (document.getElementById('sofa-droga') || {}).value || 'nenhuma',
      dose: valorCampo('sofa-dose'),
      glasgow: glasgow,
      creatinina: valorCampo('sofa-creat'),
      diurese: valorCampo('sofa-diurese')
    };

    var resultado = TS.calcularSofa(entradas);
    // A classificação segue a etapa registrada no protocolo (fonte única da
    // regra "norepinefrina = choque séptico"), não a droga digitada no cálculo.
    var usoNora = TS.usoNorepinefrina(p);
    var classificacao = TS.classificarSofa(resultado.total, usoNora);

    ui.sofaResultado = {
      protocoloId: p.id,
      entradas: entradas,
      resultado: resultado,
      classificacao: classificacao,
      noraSemEtapa: !usoNora && entradas.droga === 'norepinefrina'
    };

    var alvo = document.getElementById('sofa-resultado');
    alvo.innerHTML = htmlResultadoSofa(ui.sofaResultado, !!estado.equipe.medico);
    alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function salvarSofaUI() {
    var calculo = ui.sofaResultado;
    if (!calculo) return;
    var p = protocoloPorId(calculo.protocoloId);
    if (!p || p.status !== 'aberto') { toast('O protocolo não está mais em andamento.', 'erro'); return; }
    var medico = membroPorPapel('medico');
    if (!medico) { toast('Apenas o médico em plantão pode registrar o SOFA.', 'erro'); return; }
    salvarSofa(p, calculo, medico);
    ui.sofaResultado = null;
    ui.aba = 'protocolos';
    ui.protocoloId = p.id;
    toast('SOFA de ' + calculo.resultado.total + ' ponto(s) registrado — ' + calculo.classificacao.rotulo + '.', 'ok');
    render();
  }

  /* ------------------------------------------------------------------ *
   * Relógio (atualiza tempos decorridos sem redesenhar formulários)
   * ------------------------------------------------------------------ */

  setInterval(function () {
    var agora = agoraIso();
    Array.prototype.forEach.call(document.querySelectorAll('[data-desde]'), function (el) {
      el.textContent = duracaoTexto(minutosEntre(el.dataset.desde, agora));
    });
  }, 30000);

  // Sincroniza o estado quando outra aba/janela do navegador salva alterações,
  // evitando que uma aba desatualizada sobrescreva os registros da outra.
  window.addEventListener('storage', function (evento) {
    if (evento.key !== CHAVE) return;
    estado = carregarEstado();
    render();
  });

  /* ------------------------------------------------------------------ */

  render();
})();
