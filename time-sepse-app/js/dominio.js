/*
 * Time Sepse App — regras de negócio puras.
 * SOFA-score, classificação (sepse / choque séptico), catálogo de etapas
 * por membro do time e metas de tempo do laboratório.
 *
 * UMD: funciona como <script> no navegador (window.TimeSepse) e como
 * módulo CommonJS nos testes (node --test).
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) {
    module.exports = fabrica();
  } else {
    raiz.TimeSepse = fabrica();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Papéis (membros do Time Sepse)
   * ------------------------------------------------------------------ */

  var PAPEIS = {
    medico:         { id: 'medico',         nome: 'Médico',                     icone: '🩺' },
    enfermeiro:     { id: 'enfermeiro',     nome: 'Enfermeiro',                 icone: '💉' },
    tecnico:        { id: 'tecnico',        nome: 'Técnico de Enfermagem',      icone: '🩹' },
    fisioterapeuta: { id: 'fisioterapeuta', nome: 'Fisioterapeuta',             icone: '🫁' },
    analista:       { id: 'analista',       nome: 'Analista do Laboratório',    icone: '🔬' },
    lider:          { id: 'lider',          nome: 'Líder/Gestor do Time Sepse', icone: '📋' }
  };

  var ORDEM_PAPEIS = ['medico', 'enfermeiro', 'tecnico', 'fisioterapeuta', 'analista', 'lider'];

  /* ------------------------------------------------------------------ *
   * Catálogo de etapas do protocolo
   *
   * opcional = true  → etapa "quando indicado" (pode ser marcada como
   *                    "não indicada" sem impedir o encerramento).
   * metaMin / metaRef → meta de tempo em minutos, contada a partir da
   *                    conclusão da etapa metaRef (ou da abertura do
   *                    protocolo quando metaRef = 'abertura').
   * ------------------------------------------------------------------ */

  var ETAPAS = [
    // Médico
    { id: 'med_avaliacao_inicial',   papeis: ['medico'], titulo: 'Avaliação inicial do caso', opcional: false },
    { id: 'med_prescricao_exames',   papeis: ['medico'], titulo: 'Prescrição dos exames — Kit Sepse + exames adicionais', opcional: false },
    { id: 'med_prescricao_atb',      papeis: ['medico'], titulo: 'Prescrição da antibioticoterapia', opcional: false },
    { id: 'med_ressuscitacao',       papeis: ['medico'], titulo: 'Ressuscitação volêmica', opcional: true },
    { id: 'med_norepinefrina',       papeis: ['medico'], titulo: 'Norepinefrina', opcional: true,
      obs: 'Quando indicado — se registrada, a classificação do caso passa a Choque Séptico.' },
    { id: 'med_avaliacao_resultados', papeis: ['medico'], titulo: 'Avaliação dos resultados dos exames', opcional: false },
    { id: 'med_reavaliacao',         papeis: ['medico'], titulo: 'Reavaliação do caso — status volêmico/hemodinâmico', opcional: false },

    // Enfermeiro e Técnico de Enfermagem
    { id: 'enf_coleta_kit',      papeis: ['enfermeiro', 'tecnico'], titulo: 'Coleta dos exames do Kit Sepse — culturas/hemoculturas + lactato arterial', opcional: false },
    { id: 'enf_monitorizacao',   papeis: ['enfermeiro', 'tecnico'], titulo: 'Monitorização', opcional: false },
    { id: 'enf_instalacao_atb',  papeis: ['enfermeiro', 'tecnico'], titulo: 'Instalação da antibioticoterapia', opcional: false,
      metaMin: 60, metaRef: 'abertura', metaDesc: 'Meta do pacote: dentro da 1ª hora do protocolo' },
    { id: 'enf_segundo_lactato', papeis: ['enfermeiro', 'tecnico'], titulo: 'Coleta do 2º lactato', opcional: true },

    // Analista do Laboratório
    { id: 'lab_recebimento', papeis: ['analista'], titulo: 'Recebimento dos exames do protocolo Sepse', opcional: false },
    { id: 'lab_lactato',     papeis: ['analista'], titulo: 'Liberação do lactato arterial', opcional: false,
      metaMin: 30, metaRef: 'lab_recebimento', metaDesc: 'Meta: liberação em até 30 minutos' },
    { id: 'lab_demais',      papeis: ['analista'], titulo: 'Liberação dos demais exames laboratoriais (exceto culturas)', opcional: false,
      metaMin: 120, metaRef: 'lab_recebimento', metaDesc: 'Meta: liberação em até 2 horas' },

    // Fisioterapeuta
    { id: 'fisio_suporte', papeis: ['fisioterapeuta'], titulo: 'Suporte ventilatório', opcional: true }
  ];

  function etapaPorId(id) {
    for (var i = 0; i < ETAPAS.length; i++) {
      if (ETAPAS[i].id === id) return ETAPAS[i];
    }
    return null;
  }

  function etapasDoPapel(papel) {
    return ETAPAS.filter(function (e) { return e.papeis.indexOf(papel) !== -1; });
  }

  /* ------------------------------------------------------------------ *
   * SOFA-score (Sequential Organ Failure Assessment)
   * Seis sistemas, 0–4 pontos cada (total 0–24).
   * Campo não informado → sistema não pontuado (considerado 0 no total,
   * mas sinalizado em `naoAvaliados`).
   * ------------------------------------------------------------------ */

  function numeroOuNulo(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v);
    return isNaN(n) ? null : n;
  }

  // Respiratório: PaO2/FiO2 (mmHg). Pontos 3–4 exigem suporte ventilatório.
  function sofaRespiratorio(relacaoPF, suporteVentilatorio) {
    var pf = numeroOuNulo(relacaoPF);
    if (pf === null) return null;
    if (pf < 100) return suporteVentilatorio ? 4 : 2;
    if (pf < 200) return suporteVentilatorio ? 3 : 2;
    if (pf < 300) return 2;
    if (pf < 400) return 1;
    return 0;
  }

  // Coagulação: plaquetas ×10³/µL.
  function sofaCoagulacao(plaquetas) {
    var p = numeroOuNulo(plaquetas);
    if (p === null) return null;
    if (p < 20) return 4;
    if (p < 50) return 3;
    if (p < 100) return 2;
    if (p < 150) return 1;
    return 0;
  }

  // Hepático: bilirrubina total mg/dL.
  function sofaHepatico(bilirrubina) {
    var b = numeroOuNulo(bilirrubina);
    if (b === null) return null;
    if (b >= 12) return 4;
    if (b >= 6) return 3;
    if (b >= 2) return 2;
    if (b >= 1.2) return 1;
    return 0;
  }

  // Cardiovascular: PAM (mmHg) e droga vasoativa (dose em µg/kg/min).
  // droga ∈ {'nenhuma','dopamina','dobutamina','norepinefrina','adrenalina'}
  function sofaCardiovascular(entrada) {
    entrada = entrada || {};
    var droga = entrada.droga || 'nenhuma';
    var dose = numeroOuNulo(entrada.dose);
    var pam = numeroOuNulo(entrada.pam);

    if (droga === 'norepinefrina' || droga === 'adrenalina') {
      return (dose !== null && dose > 0.1) ? 4 : 3;
    }
    if (droga === 'dopamina') {
      if (dose !== null && dose > 15) return 4;
      if (dose !== null && dose > 5) return 3;
      return 2;
    }
    if (droga === 'dobutamina') return 2;
    if (pam === null) return null;
    return pam < 70 ? 1 : 0;
  }

  // Neurológico: Escala de Coma de Glasgow (3–15).
  function sofaNeurologico(glasgow) {
    var g = numeroOuNulo(glasgow);
    if (g === null) return null;
    if (g < 6) return 4;
    if (g <= 9) return 3;
    if (g <= 12) return 2;
    if (g <= 14) return 1;
    return 0;
  }

  // Renal: creatinina mg/dL e/ou diurese mL/24h (vale a maior pontuação).
  function sofaRenal(creatinina, diurese) {
    var c = numeroOuNulo(creatinina);
    var d = numeroOuNulo(diurese);
    var porCreatinina = null;
    var porDiurese = null;

    if (c !== null) {
      if (c >= 5) porCreatinina = 4;
      else if (c >= 3.5) porCreatinina = 3;
      else if (c >= 2) porCreatinina = 2;
      else if (c >= 1.2) porCreatinina = 1;
      else porCreatinina = 0;
    }
    if (d !== null) {
      if (d < 200) porDiurese = 4;
      else if (d < 500) porDiurese = 3;
      else porDiurese = 0;
    }
    if (porCreatinina === null && porDiurese === null) return null;
    return Math.max(porCreatinina === null ? 0 : porCreatinina,
                    porDiurese === null ? 0 : porDiurese);
  }

  var ROTULOS_ORGAOS = {
    respiratorio:   'Respiratório (PaO₂/FiO₂)',
    coagulacao:     'Coagulação (plaquetas)',
    hepatico:       'Hepático (bilirrubina)',
    cardiovascular: 'Cardiovascular (PAM / vasoativos)',
    neurologico:    'Neurológico (Glasgow)',
    renal:          'Renal (creatinina / diurese)'
  };

  /*
   * entradas: { pao2, fio2, relacaoPF, suporteVentilatorio,
   *             plaquetas, bilirrubina, pam, droga, dose,
   *             glasgow, creatinina, diurese }
   */
  function calcularSofa(entradas) {
    entradas = entradas || {};

    var pf = numeroOuNulo(entradas.relacaoPF);
    var pao2 = numeroOuNulo(entradas.pao2);
    var fio2 = numeroOuNulo(entradas.fio2);
    if (pf === null && pao2 !== null && fio2 !== null && fio2 > 0) {
      pf = pao2 / (fio2 / 100);
    }

    var orgaos = {
      respiratorio:   sofaRespiratorio(pf, !!entradas.suporteVentilatorio),
      coagulacao:     sofaCoagulacao(entradas.plaquetas),
      hepatico:       sofaHepatico(entradas.bilirrubina),
      cardiovascular: sofaCardiovascular({ pam: entradas.pam, droga: entradas.droga, dose: entradas.dose }),
      neurologico:    sofaNeurologico(entradas.glasgow),
      renal:          sofaRenal(entradas.creatinina, entradas.diurese)
    };

    var total = 0;
    var naoAvaliados = [];
    Object.keys(orgaos).forEach(function (chave) {
      if (orgaos[chave] === null) naoAvaliados.push(chave);
      else total += orgaos[chave];
    });

    return { relacaoPF: pf === null ? null : Math.round(pf), orgaos: orgaos, total: total, naoAvaliados: naoAvaliados };
  }

  /*
   * Classificação do caso, conforme regras do protocolo:
   *  - Norepinefrina em uso (etapa registrada) → Choque Séptico
   *  - SOFA ≥ 2 → Sepse
   *  - SOFA < 2 → Sepse excluída (infecção sem sepse ou causa não infecciosa)
   */
  function classificarSofa(total, usoNorepinefrina) {
    if (usoNorepinefrina) {
      return {
        codigo: 'choque_septico',
        rotulo: 'Choque Séptico',
        detalhe: 'Necessidade de infusão de norepinefrina registrada no protocolo.',
        alerta: total < 2
          ? 'Atenção: SOFA < 2 com uso de norepinefrina — reavaliar o caso e os dados inseridos.'
          : null
      };
    }
    if (total >= 2) {
      return { codigo: 'sepse', rotulo: 'Sepse', detalhe: 'SOFA ≥ 2 pontos.', alerta: null };
    }
    return {
      codigo: 'sepse_excluida',
      rotulo: 'Sepse excluída',
      detalhe: 'SOFA < 2 pontos — infecção sem sepse ou outras causas não infecciosas.',
      alerta: null
    };
  }

  /* ------------------------------------------------------------------ *
   * Metas de tempo
   * ------------------------------------------------------------------ */

  // Instante de referência (ISO) para a meta de uma etapa dentro de um protocolo.
  function referenciaDaMeta(defEtapa, protocolo) {
    if (!defEtapa || !defEtapa.metaMin) return null;
    if (defEtapa.metaRef && defEtapa.metaRef !== 'abertura') {
      var ref = protocolo.etapas && protocolo.etapas[defEtapa.metaRef];
      if (ref && ref.status === 'concluida' && ref.em) return ref.em;
    }
    return protocolo.abertoEm;
  }

  /*
   * Avalia a meta de tempo de uma etapa concluída.
   * Retorna null quando a etapa não tem meta ou ainda não foi concluída;
   * caso contrário { minutos, limite, dentro, referencia }.
   */
  function avaliarMeta(defEtapa, protocolo) {
    if (!defEtapa || !defEtapa.metaMin) return null;
    var etapa = protocolo.etapas && protocolo.etapas[defEtapa.id];
    if (!etapa || etapa.status !== 'concluida' || !etapa.em) return null;
    var refIso = referenciaDaMeta(defEtapa, protocolo);
    if (!refIso) return null;
    var minutos = (new Date(etapa.em).getTime() - new Date(refIso).getTime()) / 60000;
    if (minutos < 0) minutos = 0;
    return {
      minutos: Math.round(minutos),
      limite: defEtapa.metaMin,
      dentro: minutos <= defEtapa.metaMin,
      referencia: refIso
    };
  }

  /* ------------------------------------------------------------------ *
   * Regras auxiliares do protocolo
   * ------------------------------------------------------------------ */

  function usoNorepinefrina(protocolo) {
    var etapa = protocolo && protocolo.etapas && protocolo.etapas.med_norepinefrina;
    return !!(etapa && etapa.status === 'concluida');
  }

  // Etapas obrigatórias ainda pendentes (usado no aviso de encerramento).
  function pendenciasObrigatorias(protocolo) {
    return ETAPAS.filter(function (def) {
      if (def.opcional) return false;
      var etapa = protocolo.etapas && protocolo.etapas[def.id];
      return !(etapa && etapa.status === 'concluida');
    });
  }

  function ultimoSofa(protocolo) {
    if (!protocolo || !Array.isArray(protocolo.sofa) || protocolo.sofa.length === 0) return null;
    return protocolo.sofa[protocolo.sofa.length - 1];
  }

  return {
    PAPEIS: PAPEIS,
    ORDEM_PAPEIS: ORDEM_PAPEIS,
    ETAPAS: ETAPAS,
    ROTULOS_ORGAOS: ROTULOS_ORGAOS,
    etapaPorId: etapaPorId,
    etapasDoPapel: etapasDoPapel,
    sofaRespiratorio: sofaRespiratorio,
    sofaCoagulacao: sofaCoagulacao,
    sofaHepatico: sofaHepatico,
    sofaCardiovascular: sofaCardiovascular,
    sofaNeurologico: sofaNeurologico,
    sofaRenal: sofaRenal,
    calcularSofa: calcularSofa,
    classificarSofa: classificarSofa,
    referenciaDaMeta: referenciaDaMeta,
    avaliarMeta: avaliarMeta,
    usoNorepinefrina: usoNorepinefrina,
    pendenciasObrigatorias: pendenciasObrigatorias,
    ultimoSofa: ultimoSofa
  };
});
