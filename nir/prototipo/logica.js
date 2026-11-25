/*
 * NIR · Command Center — regras de negócio do protótipo.
 *
 * É a mesma lógica das fórmulas do Power Apps (telas/2-RotinaAtualizacao e
 * 3-GestaoVagas), escrita em JavaScript para o protótipo visual e para os
 * testes automáticos (nir/ferramentas/testar-importacao.mjs).
 * Funciona no navegador (window.NIR) e no Node (module.exports).
 */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.NIR = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Mesmos parâmetros de App.Formulas
  const PARAM = {
    horaInicioDia: 7,
    toleranciaRotinaMin: 60,
    slaAlerta: 0.7,
    slaPadraoMin: 120,
    diasPermanencia: 15,
  };

  const JANELAS = [
    { codigo: "MANHA", rotulo: "Manhã", horaPrevista: 9, ini: 0, fim: 6, ordem: 1 },
    { codigo: "TARDE", rotulo: "Tarde", horaPrevista: 17, ini: 6, fim: 13, ordem: 2 },
    { codigo: "NOITE", rotulo: "Noite", horaPrevista: 23, ini: 13, fim: 20, ordem: 3 },
    { codigo: "MADRUGADA", rotulo: "Madrugada", horaPrevista: 5, ini: 20, fim: 24, ordem: 4 },
  ];

  // Mesmos sinônimos de tblMapaColunas (o teste confere que as duas listas são iguais)
  const MAPA_COLUNAS = {
    NrAtendimento: ["atendimento", "nr atendimento", "nr. atendimento", "nº atendimento", "n° atendimento", "número do atendimento", "numero do atendimento", "atend.", "nr_atendimento"],
    Paciente: ["paciente", "nome do paciente", "nome paciente", "nome"],
    Prontuario: ["prontuário", "prontuario", "pront.", "nr. prontuário", "cód. pessoa"],
    Leito: ["leito", "unidade", "unidade/leito", "quarto/leito"],
    DataInternacao: ["data internação", "data internacao", "data de internação", "dt. internação", "dt internação", "data entrada", "dt. entrada", "dt entrada", "entrada", "data de entrada"],
    Medico: ["médico", "medico", "médico responsável", "medico responsavel", "médico assistente"],
    Especialidade: ["especialidade", "clínica", "clinica"],
    Convenio: ["convênio", "convenio"],
    Diagnostico: ["diagnóstico", "diagnostico", "cid", "hipótese diagnóstica"],
    Idade: ["idade"],
    Sexo: ["sexo"],
    SetorTasy: ["setor", "setor atendimento", "setor de atendimento"],
    PrevisaoAlta: ["previsão de alta", "previsao de alta", "previsão alta", "dt. prev. alta", "data prevista alta"],
  };
  const OBRIGATORIOS = ["NrAtendimento", "Paciente", "Leito", "DataInternacao"];

  // ---------------------------------------------------------------- datas
  function parseDataBR(txt) {
    const m = String(txt || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!m) return null;
    const d = new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    return isNaN(d) ? null : d;
  }
  const doisDig = (n) => String(n).padStart(2, "0");
  const chaveDia = (d) => `${d.getFullYear()}-${doisDig(d.getMonth() + 1)}-${doisDig(d.getDate())}`;
  const diasEntre = (a, b) => Math.floor((b - a) / 86400000);

  /** Dia do NIR (07:00 → 06:59) e rotina atual para um instante. */
  function janelaDe(agora) {
    const h = agora.getHours();
    const offset = (h - PARAM.horaInicioDia + 24) % 24;
    const dataRef = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    if (h < PARAM.horaInicioDia) dataRef.setDate(dataRef.getDate() - 1);
    const j = JANELAS.find((x) => offset >= x.ini && offset < x.fim);
    return { offset, dataRef, chaveData: chaveDia(dataRef), janela: j.codigo, janelaChave: chaveDia(dataRef) + "|" + j.codigo };
  }

  // ------------------------------------------------------- leitura do censo
  /** Lê o texto colado do Excel (separado por tabulação). */
  function lerCenso(texto) {
    const linhas = String(texto || "").replace(/\r/g, "").split("\n");
    const sinAt = MAPA_COLUNAS.NrAtendimento;
    const idxCab = linhas.findIndex((l) => l.toLowerCase().split("\t").some((c) => sinAt.includes(c.trim())));
    if (idxCab < 0) return { ok: false, erro: "Não encontrei a linha de cabeçalho com a coluna de atendimento." };

    const cab = linhas[idxCab].split("\t").map((c) => c.trim().toLowerCase());
    const mapa = {};
    for (const [campo, sins] of Object.entries(MAPA_COLUNAS)) {
      const i = cab.findIndex((nome) => sins.includes(nome));
      mapa[campo] = i >= 0 ? i : null;
    }
    const cel = (cols, campo) => (mapa[campo] == null ? "" : String(cols[mapa[campo]] ?? "").trim());

    const brutas = linhas.slice(idxCab + 1).filter((l) => l.trim());
    const lidas = brutas.map((l) => {
      const c = l.split("\t");
      return {
        NrAtendimento: cel(c, "NrAtendimento").replace(/[.\s]/g, ""),
        Paciente: cel(c, "Paciente"),
        Prontuario: cel(c, "Prontuario"),
        Leito: cel(c, "Leito"),
        DataInternacao: parseDataBR(cel(c, "DataInternacao")),
        Medico: cel(c, "Medico"),
        Especialidade: cel(c, "Especialidade"),
        Convenio: cel(c, "Convenio"),
        Diagnostico: cel(c, "Diagnostico"),
        Idade: cel(c, "Idade"),
        Sexo: cel(c, "Sexo"),
        SetorTasy: cel(c, "SetorTasy"),
        PrevisaoAlta: parseDataBR(cel(c, "PrevisaoAlta")),
      };
    });
    const validas = lidas.filter((r) => /^[0-9]+$/.test(r.NrAtendimento));
    const unicas = [];
    const vistos = new Set();
    for (const r of validas) if (!vistos.has(r.NrAtendimento)) { vistos.add(r.NrAtendimento); unicas.push(r); }

    const faltando = OBRIGATORIOS.filter((c) => mapa[c] == null);
    return { ok: true, linhaCab: idxCab + 1, mapa, censo: unicas, ignoradas: lidas.length - validas.length, colunasFaltando: faltando };
  }

  // ------------------------------------------------- comparação com a base
  /**
   * internacoes: array de {NrAtendimento, SetorCodigo, Leito, Status, DataInternacao, ...}
   * Retorna a prévia (com classe de cada paciente) e os ausentes do setor.
   */
  function classificar(censo, setor, internacoes, agora) {
    const porAt = new Map(internacoes.map((i) => [i.NrAtendimento, i]));
    const previa = censo.map((r) => {
      const ant = porAt.get(r.NrAtendimento);
      let classe;
      if (!ant) classe = "NOVO";
      else if (ant.SetorCodigo !== setor) classe = "TRANSFERENCIA";
      else if (ant.Status !== "INTERNADO") classe = "RETORNO";
      else if (r.Leito && ant.Leito !== r.Leito) classe = "TROCA_LEITO";
      else classe = "SEM_MUDANCA";
      const dataEf = r.DataInternacao || (ant && ant.DataInternacao) || null;
      return {
        ...r,
        Classe: classe,
        SetorAnterior: ant ? ant.SetorCodigo : "",
        LeitoAnterior: ant ? ant.Leito : "",
        DataIntEfetiva: dataEf,
        Dias: dataEf ? diasEntre(dataEf, agora) : null,
      };
    });
    const noCenso = new Set(censo.map((r) => r.NrAtendimento));
    const ausentes = internacoes.filter(
      (i) => i.SetorCodigo === setor && i.Status === "INTERNADO" && !noCenso.has(i.NrAtendimento)
    );
    return { previa, ausentes };
  }

  // ------------------------------------------------------ gravação (estado)
  /**
   * estado = { internacoes: [], movimentacoes: [], censoResumo: {}, importacoes: [], solicitacoes: [] }
   * setoresRotina = códigos dos setores que entram na rotina
   */
  function aplicarImportacao(estado, { setor, chaveData, janela, previa, ausentes, leitos, agora, setoresRotina, por }) {
    const janelaChave = chaveData + "|" + janela;
    const porAt = new Map(estado.internacoes.map((i) => [i.NrAtendimento, i]));

    for (const p of previa) {
      const atual = porAt.get(p.NrAtendimento);
      if (!atual) {
        const nova = {
          NrAtendimento: p.NrAtendimento, Paciente: p.Paciente, Prontuario: p.Prontuario, Leito: p.Leito,
          SetorCodigo: setor, DataInternacao: p.DataInternacao, Medico: p.Medico, Especialidade: p.Especialidade,
          Convenio: p.Convenio, Status: "INTERNADO", PrimeiraVezVistoEm: agora, UltimaVezVistoEm: agora,
          UltimaJanelaChave: janelaChave, PrevisaoAlta: p.PrevisaoAlta || null, SaidaDetectadaEm: null,
        };
        estado.internacoes.push(nova);
        porAt.set(nova.NrAtendimento, nova);
      } else {
        Object.assign(atual, {
          Paciente: p.Paciente || atual.Paciente,
          Leito: p.Leito || atual.Leito,
          DataInternacao: p.DataInternacao || atual.DataInternacao,
          Medico: p.Medico || atual.Medico,
          SetorCodigo: setor,
          Status: "INTERNADO",
          UltimaVezVistoEm: agora,
          UltimaJanelaChave: janelaChave,
          SaidaDetectadaEm: null,
          PrevisaoAlta: p.PrevisaoAlta || atual.PrevisaoAlta,
        });
      }
      if (p.Classe !== "SEM_MUDANCA") {
        estado.movimentacoes.push({
          NrAtendimento: p.NrAtendimento, Paciente: p.Paciente,
          SetorDe: p.Classe === "NOVO" ? "" : p.SetorAnterior, LeitoDe: p.Classe === "NOVO" ? "" : p.LeitoAnterior,
          SetorPara: setor, LeitoPara: p.Leito, Tipo: p.Classe === "NOVO" ? "ADMISSAO" : p.Classe,
          DetectadoEm: agora, JanelaChave: janelaChave,
        });
      }
    }

    for (const a of ausentes) {
      const reg = porAt.get(a.NrAtendimento);
      reg.Status = "SAIDA_VERIFICAR";
      reg.SaidaDetectadaEm = agora;
      estado.movimentacoes.push({
        NrAtendimento: a.NrAtendimento, Paciente: a.Paciente, SetorDe: a.SetorCodigo, LeitoDe: a.Leito,
        SetorPara: "", LeitoPara: "", Tipo: "SAIDA_VERIFICAR", DetectadoEm: agora, JanelaChave: janelaChave,
      });
    }

    // leito cedido + paciente chegou ao destino → transferência concluída
    for (const p of previa.filter((x) => x.Classe === "TRANSFERENCIA")) {
      const s = (estado.solicitacoes || []).find(
        (x) => x.NrAtendimento === p.NrAtendimento && x.Status === "LEITO_CEDIDO" && x.SetorDestino === setor
      );
      if (s) { s.Status = "CONCLUIDA"; s.ConcluidoEm = agora; }
    }

    const n = previa.length;
    const comDias = previa.filter((p) => p.Dias != null);
    estado.censoResumo[janelaChave + "|" + setor] = {
      ChaveData: chaveData, Janela: janela, SetorCodigo: setor, Pacientes: n, Leitos: leitos || 0,
      OcupacaoPct: leitos > 0 ? Math.round((n / leitos) * 1000) / 10 : null,
      Perm15d: comDias.filter((p) => p.Dias >= PARAM.diasPermanencia).length,
      PermMediaDias: comDias.length ? Math.round((comDias.reduce((s, p) => s + p.Dias, 0) / comDias.length) * 10) / 10 : 0,
      ImportadoEm: agora,
    };

    estado.importacoes = estado.importacoes.filter((i) => !(i.JanelaChave === janelaChave && i.SetorCodigo === setor && i.TipoGuia === "CENSO"));
    estado.importacoes.push({
      ChaveData: chaveData, Janela: janela, JanelaChave: janelaChave, TipoGuia: "CENSO", SetorCodigo: setor,
      Linhas: n, Novos: previa.filter((p) => p.Classe === "NOVO").length,
      Transferidos: previa.filter((p) => p.Classe === "TRANSFERENCIA").length,
      TrocasLeito: previa.filter((p) => p.Classe === "TROCA_LEITO").length,
      Retornos: previa.filter((p) => p.Classe === "RETORNO").length,
      Saidas: ausentes.length, Status: "PROCESSADO", ImportadoEm: agora, EnviadoPorNome: por || "",
    });

    // rotina completa → quem ficou como saída a verificar vira alta presumida
    let altasPresumidas = 0;
    const recebidos = new Set(estado.importacoes.filter((i) => i.JanelaChave === janelaChave && i.TipoGuia === "CENSO").map((i) => i.SetorCodigo));
    const completa = setoresRotina.every((s) => recebidos.has(s));
    if (completa) {
      for (const i of estado.internacoes.filter((x) => x.Status === "SAIDA_VERIFICAR")) {
        i.Status = "ALTA_PRESUMIDA";
        altasPresumidas++;
        estado.movimentacoes.push({
          NrAtendimento: i.NrAtendimento, Paciente: i.Paciente, SetorDe: i.SetorCodigo, LeitoDe: i.Leito,
          SetorPara: "", LeitoPara: "", Tipo: "ALTA_PRESUMIDA", DetectadoEm: agora, JanelaChave: janelaChave,
        });
      }
    }
    return { rotinaCompleta: completa, altasPresumidas, proximoSetor: setoresRotina.find((s) => !recebidos.has(s)) || null };
  }

  // ----------------------------------------------------------- rotina do dia
  function statusRotina(importacoes, setoresRotina, agora) {
    const { offset, chaveData } = janelaDe(agora);
    const minAgora = offset * 60 + agora.getMinutes();
    return JANELAS.map((j) => {
      const rec = new Set(
        importacoes.filter((i) => i.ChaveData === chaveData && i.Janela === j.codigo && i.TipoGuia === "CENSO").map((i) => i.SetorCodigo)
      );
      const recebidos = setoresRotina.filter((s) => rec.has(s)).length;
      const esperados = setoresRotina.length;
      const minPrev = ((j.horaPrevista - PARAM.horaInicioDia + 24) % 24) * 60;
      let situacao;
      if (esperados > 0 && recebidos >= esperados) situacao = "Concluída";
      else if (minAgora < j.ini * 60) situacao = "Aguardando";
      else if (minAgora >= j.fim * 60) situacao = "Incompleta";
      else if (minAgora - minPrev > PARAM.toleranciaRotinaMin) situacao = "Atrasada";
      else if (minAgora >= minPrev) situacao = "Em andamento";
      else situacao = "Aberta";
      return { ...j, recebidos, esperados, pct: esperados ? recebidos / esperados : 0, situacao, faltam: setoresRotina.filter((s) => !rec.has(s)) };
    });
  }

  // --------------------------------------------------------------------- SLA
  function slaPct(sol, agora) {
    const fim = sol.LeitoCedidoEm || agora;
    return (fim - sol.SolicitadoEm) / 60000 / (sol.SLAMinutos || PARAM.slaPadraoMin);
  }
  function nivelSla(pct) {
    return pct >= 1 ? "vermelho" : pct >= PARAM.slaAlerta ? "amarelo" : "verde";
  }
  function crono(seg) {
    seg = Math.max(0, Math.floor(seg));
    return `${doisDig(Math.floor(seg / 3600))}:${doisDig(Math.floor((seg % 3600) / 60))}:${doisDig(seg % 60)}`;
  }
  function minutosTexto(m) {
    if (m == null || isNaN(m)) return "–";
    m = Math.round(m);
    return m >= 60 ? `${Math.floor(m / 60)}h ${doisDig(m % 60)}min` : `${m} min`;
  }

  // --------------------------------------------- metas e agenda de cateterismos
  // Mesmos sinônimos de tblMapaMetas e tblMapaCate (App.Formulas)
  const MAPA_METAS = {
    Indicador: ["indicador", "código", "codigo"],
    Competencia: ["competência", "competencia", "mês", "mes", "mês/ano"],
    Meta: ["meta"],
    Realizado: ["realizado", "resultado", "valor"],
  };
  const MAPA_CATE = {
    Data: ["data", "data do exame", "data exame", "dt. exame"],
    Hora: ["hora", "horário", "horario"],
    Paciente: ["paciente", "nome", "nome do paciente"],
    Tipo: ["tipo", "classificação", "classificacao", "tipo de paciente"],
    Atendimento: ["atendimento", "nr atendimento", "nº atendimento"],
    Prontuario: ["prontuário", "prontuario"],
    Idade: ["idade"],
    Procedimento: ["procedimento", "exame"],
    Medico: ["médico", "medico", "médico solicitante", "solicitante"],
    Convenio: ["convênio", "convenio"],
    Procedencia: ["procedência", "procedencia", "origem", "serviço de origem"],
    Observacao: ["observação", "observacao", "obs", "obs."],
  };

  function tabelaColada(texto, mapa, campoChave) {
    const linhas = String(texto || "").replace(/\r/g, "").split("\n");
    const idx = linhas.findIndex((l) => l.toLowerCase().split("\t").some((c) => mapa[campoChave].includes(c.trim())));
    if (idx < 0) return null;
    const cab = linhas[idx].split("\t").map((c) => c.trim().toLowerCase());
    const pos = {};
    for (const [campo, sins] of Object.entries(mapa)) { const i = cab.findIndex((n) => sins.includes(n)); pos[campo] = i >= 0 ? i : null; }
    const ler = (cols, campo) => (pos[campo] == null ? "" : String(cols[pos[campo]] ?? "").trim());
    return linhas.slice(idx + 1).filter((l) => l.trim()).map((l) => { const c = l.split("\t"); const r = {}; for (const k of Object.keys(mapa)) r[k] = ler(c, k); return r; });
  }

  /** "2026-10", "10/2026", "01/10/2026" → "2026-10" */
  function competencia(txt) {
    const t = String(txt || "").trim();
    let m;
    if ((m = t.match(/^(\d{4})-(\d{1,2})$/))) return `${m[1]}-${doisDig(+m[2])}`;
    if ((m = t.match(/^(\d{1,2})\/(\d{4})$/))) return `${m[2]}-${doisDig(+m[1])}`;
    if ((m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return `${m[3]}-${doisDig(+m[2])}`;
    return "";
  }
  const numeroBR = (t) => { const s = String(t || "").trim().replace(/\./g, "").replace(",", "."); return s === "" || isNaN(+s) ? null : +s; };

  /** Lê o modelo de metas colado. cadastro = [{Codigo, Title, MetaPadrao}] */
  function lerMetas(texto, cadastro) {
    const linhas = tabelaColada(texto, MAPA_METAS, "Competencia");
    if (!linhas) return { ok: false, erro: "Não encontrei o cabeçalho do modelo de metas (Indicador, Competência, Meta, Realizado)." };
    const itens = linhas.map((r) => {
      const ind = r.Indicador.toLowerCase();
      const cad = cadastro.find((m) => m.Codigo.toLowerCase() === ind || m.Title.toLowerCase() === ind);
      const comp = competencia(r.Competencia);
      const real = numeroBR(r.Realizado);
      const meta = numeroBR(r.Meta);
      return {
        Indicador: r.Indicador, Codigo: cad ? cad.Codigo : null, Nome: cad ? cad.Title : null, Competencia: comp,
        Meta: meta != null ? meta : cad ? cad.MetaPadrao : null, Realizado: real,
        Problema: !cad ? "indicador não cadastrado" : !comp ? "competência inválida" : real == null ? "realizado vazio" : "",
      };
    });
    return { ok: true, itens };
  }

  /** Tipo do cateterismo a partir do texto da planilha */
  function tipoCate(tipoTxt, atendimento) {
    const t = String(tipoTxt || "").toLowerCase();
    if (t.includes("intern") && t.includes("urg")) return "INTERNADO_URGENCIA";
    if (t.includes("intern")) return "INTERNADO_ELETIVO";
    if (t.includes("urg")) return "EXTERNO_URGENCIA_RELATIVA";
    if (t.includes("extern") || t.includes("eletiv")) return "EXTERNO_ELETIVO";
    return atendimento ? "INTERNADO_ELETIVO" : "EXTERNO_ELETIVO";
  }

  /** Lê a agenda de cateterismos colada. existentes = [{Title, DataHoraExame}] */
  function lerAgendaCate(texto, existentes = []) {
    const linhas = tabelaColada(texto, MAPA_CATE, "Paciente");
    if (!linhas) return { ok: false, erro: "Não encontrei o cabeçalho da planilha (coluna Paciente)." };
    const itens = linhas.map((r) => {
      const quando = parseDataBR(r.Data + (r.Hora ? " " + r.Hora : "")) || parseDataBR(r.Data);
      const at = r.Atendimento.replace(/\./g, "");
      const dup = quando && existentes.some((e) => chaveDia(e.DataHoraExame) === chaveDia(quando) && e.Title.toLowerCase() === r.Paciente.toLowerCase());
      return {
        Paciente: r.Paciente, DataHora: quando, Tipo: tipoCate(r.Tipo, at), TipoLido: r.Tipo, Atendimento: at,
        Procedimento: r.Procedimento, Medico: r.Medico, Procedencia: r.Procedencia, Observacao: r.Observacao,
        Problema: !r.Paciente ? "sem paciente" : !quando ? "data inválida" : dup ? "já está na agenda" : "",
      };
    });
    return { ok: true, itens };
  }

  /** Valor de uma meta num mês: automática (média/soma dos indicadores diários) ou de planilha */
  function valorMeta(meta, comp, indicadoresDiarios, valores) {
    if (meta.Fonte === "AUTOMATICA") {
      const f = indicadoresDiarios.filter((i) => i.Indicador === meta.IndicadorDiario && i.ChaveData.slice(0, 7) === comp);
      if (!f.length) return null;
      const soma = f.reduce((a, i) => a + i.Valor, 0);
      return meta.Agregacao === "SOMA" ? soma : Math.round((soma / f.length) * 10) / 10;
    }
    const v = valores.find((x) => x.Codigo === meta.Codigo && x.Competencia === comp);
    return v ? v.Realizado : null;
  }
  const atingiu = (v, alvo, sentido) => (v == null || alvo == null ? null : sentido === "MAIOR" ? v >= alvo : v <= alvo);

  return { PARAM, JANELAS, MAPA_COLUNAS, MAPA_METAS, MAPA_CATE, OBRIGATORIOS, parseDataBR, chaveDia, diasEntre, janelaDe, lerCenso, classificar, aplicarImportacao, statusRotina, slaPct, nivelSla, crono, minutosTexto, competencia, lerMetas, tipoCate, lerAgendaCate, valorMeta, atingiu };
});
