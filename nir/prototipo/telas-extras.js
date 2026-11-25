/*
 * NIR · Command Center — protótipo: guias Previsões de Alta, Gestão da Permanência,
 * Ambulâncias, Cateterismos, Previsão de Recepção, Passagem de Plantão e Metas.
 * Usa as funções e dados da página principal (index.html) e as regras de logica.js.
 * Dados fictícios.
 */
(function () {
  "use strict";
  const NX = window.NIR;
  const q = (s, el = document) => el.querySelector(s);
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const dd = (n) => String(n).padStart(2, "0");
  const dataBR = (d) => (d ? d.toLocaleDateString("pt-BR") : "–");
  const dataHoraBR = (d) => (d ? d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "–");
  const diaSemana = (d) => d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
  const hoje0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const difDias = (d) => (d ? Math.round((new Date(d).setHours(0, 0, 0, 0) - hoje0()) / 86400000) : null);
  const isoDia = (d) => `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`;
  const deInput = (data, hora) => { if (!data) return null; const [y, m, d] = data.split("-").map(Number); const [hh, mm] = (hora || "08:00").split(":").map(Number); return new Date(y, m - 1, d, hh || 0, mm || 0); };
  const eu = () => NOME_USUARIO[perfil] || "Você";
  const ehNIR = () => perfil === "NIR";
  const podePerm = () => perfil === "NIR" || perfil === "PERMANENCIA";
  const kpi = (rot, val, sub, cls = "") => `<div class="kpi ${cls}"><span class="rot">${rot}</span><span class="val">${val}</span><span class="sub">${sub}</span></div>`;
  let seq = 5000;
  const novoId = () => ++seq;

  // ------------------------------------------------------------- tabelas
  const ESPEC = [["MEDICO", "PendMedico", "Médico"], ["ENFERMAGEM", "PendEnfermagem", "Enfermagem"], ["SERVICO_SOCIAL", "PendServicoSocial", "Serviço Social"], ["FISIOTERAPIA", "PendFisioterapia", "Fisioterapia"]];
  const ST_TOPICO = { PLANEJADO: "Planejado", EM_ANDAMENTO: "Em andamento", CONCLUIDO: "Concluído" };
  const DESTINOS_ALTA = ["Domicílio", "Domicílio com apoio/cuidador", "Home care", "ILPI", "Hospital de retaguarda", "Outro hospital", "A definir"];
  const TIPOS_TR = { USA: "Ambulância USA (avançada)", USB: "Ambulância USB (básica)", REMOCAO: "Remoção simples", OUTRO: "Outro" };
  const MOTIVOS_TR = { EXAME_EXTERNO: ["Exame externo", true], PROCEDIMENTO: ["Procedimento/cirurgia externa", true], CONSULTA: ["Consulta/avaliação externa", true], TRANSFERENCIA: ["Transferência definitiva", false], ALTA: ["Alta com transporte", false], OUTRO: ["Outro", false] };
  const ST_TR = { AGENDADO: "Agendado", SOLICITADA: "Ambulância solicitada", CONFIRMADA: "Ambulância confirmada", NO_LOCAL: "Ambulância no hospital", SAIU: "Paciente saiu", RETORNOU: "Retornou ao hospital", CONCLUIDO: "Concluído (não retorna)", CANCELADO: "Cancelado" };
  const ATIVOS_TR = ["AGENDADO", "SOLICITADA", "CONFIRMADA", "NO_LOCAL", "SAIU"];
  const CHECK = [["ChkAutorizacao", "Autorização"], ["ChkRelatorio", "Relatório"], ["ChkExames", "Exames"], ["ChkContatoDestino", "Contato destino"], ["ChkAgendaConfirmada", "Agenda confirm."], ["ChkAcompanhante", "Acompanhante"], ["ChkEquipamentos", "Equip./O2"], ["ChkDocumentos", "Documentos"], ["ChkFamilia", "Família avisada"]];
  const PASSOS_TR = { AGENDADO: ["Ambulância solicitada", "SOLICITADA", "SolicitadoEm"], SOLICITADA: ["Ambulância confirmada", "CONFIRMADA", "ConfirmadoEm"], CONFIRMADA: ["Ambulância chegou", "NO_LOCAL", "ChegadaAmbulanciaEm"], NO_LOCAL: ["Paciente saiu", "SAIU", "SaidaPacienteEm"], SAIU: ["Paciente retornou", "RETORNOU", "RetornouEm"] };
  const TIPOS_CATE = { EXTERNO_ELETIVO: ["Externo Eletivo", "#0B4F8A"], EXTERNO_URGENCIA_RELATIVA: ["Externo Urgência Relativa", "#B7791F"], INTERNADO_ELETIVO: ["Internado Eletivo", "#0F7C80"], INTERNADO_URGENCIA: ["Internado Urgência", "#A23E48"] };
  const ST_CATE = { AGENDADO: "Agendado", REALIZADO: "Realizado", REMARCADO: "Remarcado", SUSPENSO: "Suspenso", CANCELADO: "Cancelado" };
  const DEST_POS_CATE = ["Alta", "Retorna ao setor de origem", "UCO/UTI", "Enfermaria", "Cirurgia cardíaca", "Transferência"];
  const SECOES = { AMBULATORIAL: "Ambulatoriais", ELETIVA: "Eletivas" };
  const ST_REC = { PREVISTO: "Previsto", CHEGOU: "Chegou", INTERNADO: "Internado", RETORNOU_ORIGEM: "Avaliado e retornou à origem", NAO_COMPARECEU: "Não compareceu", CANCELADO: "Cancelado" };
  const cateAtivo = (c) => c.Status === "AGENDADO" || c.Status === "REMARCADO";
  const chkSoma = (t) => CHECK.reduce((a, [f]) => a + (t[f] ? 1 : 0), 0);

  // --------------------------------------------------------- dados fictícios
  window.semearExtras = function () {
    const r = prng(77);
    const int = estado.internacoes.filter((i) => i.Status === "INTERNADO");
    const longos = int.filter((i) => NX.diasEntre(i.DataInternacao, new Date()) >= 15);
    estado.previsoesHist = [];
    estado.acomp = {};
    estado.topicos = [];
    const TEMAS = { MEDICO: ["Aguarda parecer da cardiologia", "Definir antibiótico oral para alta", "Aguarda resultado de biópsia"], ENFERMAGEM: ["Treinar cuidador para curativo", "Orientar uso de insulina", "Providenciar material de ostomia"], SERVICO_SOCIAL: ["Aguarda vaga em ILPI", "Contato com família para cuidador", "Transporte para domicílio"], FISIOTERAPIA: ["Treino de marcha", "Avaliar necessidade de O2 domiciliar", "Desmame de ventilação"] };
    longos.forEach((p, k) => {
      const a = { PendMedico: r() < 0.5, PendEnfermagem: r() < 0.35, PendServicoSocial: r() < 0.45, PendFisioterapia: r() < 0.3, DestinoAltaPrevisto: DESTINOS_ALTA[Math.floor(r() * DESTINOS_ALTA.length)], PlanoTerapeutico: "", Observacao: "", UltimaRevisaoEm: new Date(Date.now() - r() * 4 * 86400000), UltimaRevisaoPor: "Enf. NIR (exemplo)" };
      estado.acomp[p.NrAtendimento] = a;
      ESPEC.forEach(([cod, campo]) => {
        if (!a[campo]) return;
        const n = 1 + Math.floor(r() * 2);
        for (let i = 0; i < n; i++) {
          const st = ["PLANEJADO", "EM_ANDAMENTO", "CONCLUIDO"][Math.floor(r() * 3)];
          const prazo = new Date(); prazo.setDate(prazo.getDate() + Math.floor(r() * 8) - 3);
          estado.topicos.push({ ID: novoId(), NrAtendimento: p.NrAtendimento, Paciente: p.Paciente, Especialidade: cod, Titulo: TEMAS[cod][(k + i) % 3], Status: st, Responsavel: ["Dra. B. Lima", "Enf. Sofia", "A.S. Marina", "Ft. Rafael"][ESPEC.findIndex((e) => e[0] === cod)], Prazo: prazo, CriadoEm: new Date(Date.now() - 5 * 86400000), ConcluidoEm: st === "CONCLUIDO" ? new Date(Date.now() - r() * 5 * 86400000) : null });
        }
      });
      if (r() < 0.6 && !p.PrevisaoAlta) { const d = hoje0(); d.setDate(d.getDate() + Math.floor(r() * 7)); p.PrevisaoAlta = d; p.PrevisaoAltaOrigem = "EQUIPE"; p.PrevisaoAltaPor = "Dr. A. Ramos"; }
    });
    int.forEach((i) => { if (i.PrevisaoAlta && !i.PrevisaoAltaOrigem) i.PrevisaoAltaOrigem = "TASY"; });
    int.filter((i) => i.PrevisaoAlta).slice(0, 6).forEach((i, k) => { if (k < 3) { const d = hoje0(); d.setDate(d.getDate() - 1 - k); i.PrevisaoAlta = d; } });
    // saídas dos últimos 30 dias para a acurácia
    estado.saidasHist = Array.from({ length: 60 }, (_, k) => { const saiu = new Date(Date.now() - r() * 30 * 86400000); const prev = new Date(saiu); prev.setDate(prev.getDate() + Math.round((r() - 0.5) * 4)); return { PrevisaoAlta: r() < 0.8 ? prev : null, SaidaDetectadaEm: saiu }; });

    // transportes
    const agora = Date.now();
    const tr = (p, hrs, motivo, status, destino, extra = {}) => ({ ID: novoId(), Title: p.Paciente, NrAtendimento: p.NrAtendimento, SetorOrigem: p.SetorCodigo, Leito: p.Leito, TipoTransporte: ["USB", "USA", "REMOCAO"][Math.floor(r() * 3)], Motivo: motivo, Destino: destino, Empresa: ["Remoções Exemplo", "Ambulâncias Modelo"][Math.floor(r() * 2)], AgendadoPara: new Date(agora + hrs * 3600000), Status: status, PodeRetornar: MOTIVOS_TR[motivo][1], Observacao: "", ...Object.fromEntries(CHECK.map(([f]) => [f, r() < 0.65])), ...extra });
    const ui = int.filter((i) => SETOR[i.SetorCodigo].grupo === "UI");
    estado.transportes = [
      tr(ui[2], 2.5, "EXAME_EXTERNO", "CONFIRMADA", "Clínica de Imagem (ressonância)"), tr(ui[7], 5, "CONSULTA", "AGENDADO", "Ambulatório de especialidades"),
      tr(ui[11], 20, "TRANSFERENCIA", "AGENDADO", "Hospital de retaguarda"), tr(ui[15], 30, "PROCEDIMENTO", "AGENDADO", "Centro de oncologia (radioterapia)"),
      tr(ui[20], 40, "EXAME_EXTERNO", "AGENDADO", "Hospital regional (cintilografia)"), tr(ui[25], -3, "PROCEDIMENTO", "SAIU", "Hospital de referência (hemodinâmica)", { SaidaPacienteEm: new Date(agora - 3 * 3600000) }),
      tr(ui[30], -0.6, "EXAME_EXTERNO", "SOLICITADA", "Clínica de Imagem (tomografia)"),
    ];
    estado.transportesHist = Array.from({ length: 14 }, (_, k) => ({ ...tr(ui[k + 40] || ui[k], -24 * (k + 1), "EXAME_EXTERNO", k % 4 === 0 ? "CANCELADO" : "RETORNOU", "Clínica de Imagem") }));

    // cateterismos
    const cat = (nome, dia, hora, tipo, extra = {}) => { const d = hoje0(); d.setDate(d.getDate() + dia); d.setHours(hora, hora % 1 ? 30 : 0); return { ID: novoId(), Title: nome, DataHoraExame: d, Tipo: tipo, Procedimento: "Cateterismo cardíaco", MedicoSolicitante: "Dr. C. Souza", Status: "AGENDADO", Origem: "PLANILHA", ServicoOrigem: "", NrAtendimento: "", ...extra }; };
    const uti = int.filter((i) => i.SetorCodigo === "UTI");
    estado.cateterismos = [
      cat("Paciente externo E01", 0, 8, "EXTERNO_ELETIVO", { ServicoOrigem: "UBS Centro" }), cat(uti[0].Paciente, 0, 9.5, "INTERNADO_URGENCIA", { NrAtendimento: uti[0].NrAtendimento }),
      cat("Paciente externo E02", 0, 11, "EXTERNO_URGENCIA_RELATIVA", { ServicoOrigem: "Hospital municipal" }), cat(ui[4].Paciente, 0, 14, "INTERNADO_ELETIVO", { NrAtendimento: ui[4].NrAtendimento }),
      cat(ui[9].Paciente, 1, 8, "INTERNADO_ELETIVO", { NrAtendimento: ui[9].NrAtendimento }), cat("Paciente externo E03", 1, 10, "EXTERNO_ELETIVO", { ServicoOrigem: "AME Cardiologia" }),
      cat("Paciente externo E04", 2, 8, "EXTERNO_ELETIVO", { ServicoOrigem: "UBS Norte" }), cat(ui[14].Paciente, 3, 9, "INTERNADO_ELETIVO", { NrAtendimento: ui[14].NrAtendimento }),
      cat("Paciente externo E05", -2, 8, "EXTERNO_ELETIVO", { Status: "REALIZADO", DestinoPosExame: "Alta" }), cat("Paciente externo E06", -3, 10, "EXTERNO_URGENCIA_RELATIVA", { Status: "CANCELADO" }),
    ];

    // recepções CROSS
    const rec = (nome, secao, dia, hora, extra = {}) => { const d = hoje0(); d.setDate(d.getDate() + dia); d.setHours(hora); return { ID: novoId(), Title: nome, Idade: 40 + Math.floor(r() * 40) + "a", Sexo: r() < 0.5 ? "F" : "M", NrFichaCROSS: String(2026000 + Math.floor(r() * 9999)), Secao: secao, ServicoOrigem: ["Hospital municipal", "UPA Sul", "Santa Casa (exemplo)", "AME Cardiologia"][Math.floor(r() * 4)], MunicipioOrigem: "Município vizinho", Especialidade: ["Cardiologia", "Cirurgia geral", "Clínica médica", "Ortopedia"][Math.floor(r() * 4)], Motivo: "", PrevistoPara: d, SetorPrevisto: "", Status: "PREVISTO", PrecisaCateterismo: false, DataCateterismo: null, CateterismoId: null, ...extra }; };
    estado.recepcoes = [
      rec("Paciente CROSS 01", "AMBULATORIAL", 0, 10), rec("Paciente CROSS 02", "ELETIVA", 0, 14, { SetorPrevisto: "UI6_P2" }), rec("Paciente CROSS 03", "AMBULATORIAL", 1, 8),
      rec("Paciente CROSS 04", "ELETIVA", 1, 9, { SetorPrevisto: "UI7_P1", Especialidade: "Cardiologia" }), rec("Paciente CROSS 05", "ELETIVA", 3, 10), rec("Paciente CROSS 06", "AMBULATORIAL", 4, 13),
      rec("Paciente CROSS 07", "ELETIVA", -1, 10), rec("Paciente CROSS 08", "AMBULATORIAL", 0, 7, { Status: "CHEGOU", ChegadaEm: new Date(agora - 2 * 3600000) }),
    ];
    const r4 = estado.recepcoes[3];
    const c4 = cat(r4.Title, 2, 8, "EXTERNO_ELETIVO", { Origem: "RECEPCAO", RecepcaoId: r4.ID, ServicoOrigem: r4.ServicoOrigem });
    estado.cateterismos.push(c4);
    Object.assign(r4, { PrecisaCateterismo: true, DataCateterismo: c4.DataHoraExame, TipoCateterismo: c4.Tipo, CateterismoId: c4.ID });
    estado.recepcoesHist = Array.from({ length: 22 }, (_, k) => ({ ...rec("Paciente CROSS H" + k, k % 2 ? "ELETIVA" : "AMBULATORIAL", -1 - k, 9), Status: ["INTERNADO", "INTERNADO", "RETORNOU_ORIGEM", "INTERNADO", "NAO_COMPARECEU"][k % 5], DesfechoEm: new Date(agora - (k + 1) * 86400000) }));

    // passagens anteriores
    estado.passagens = [1, 2, 3].map((k) => ({ ID: novoId(), Turno: k % 2 ? "NOTURNO" : "DIURNO", IniciadaEm: new Date(agora - k * 12 * 3600000), PassadoPorNome: "Enf. NIR (exemplo)", RecebidoPorNome: "Enf. NIR B (exemplo)", RecebidaEm: new Date(agora - k * 12 * 3600000 + 1800000), Status: "CONCLUIDA", Snapshot: "PASSAGEM DE PLANTÃO DO NIR (exemplo)\n\n1. PS COM VAGA SOLICITADA (3)\n- PS-01 · Paciente fictício 001 → UTI · Solicitada\n...\n\nOBSERVAÇÕES GERAIS: plantão tranquilo." }));
    estado.passagemAtual = null;

    // metas
    estado.metasCad = [
      { Codigo: "TEMPO_CESSAO", Title: "Tempo médio até a cessão do leito", Unidade: "min", Sentido: "MENOR", MetaPadrao: 120, Fonte: "AUTOMATICA", IndicadorDiario: "TEMPO_MEDIO_CESSAO_MIN", Agregacao: "MEDIA" },
      { Codigo: "CESSAO_NO_SLA", Title: "Cessões de leito dentro do SLA", Unidade: "%", Sentido: "MAIOR", MetaPadrao: 80, Fonte: "AUTOMATICA", IndicadorDiario: "PCT_CESSAO_NO_SLA", Agregacao: "MEDIA" },
      { Codigo: "OCUPACAO", Title: "Taxa de ocupação (censo das 23h)", Unidade: "%", Sentido: "MAIOR", MetaPadrao: 85, Fonte: "AUTOMATICA", IndicadorDiario: "OCUPACAO_PCT", Agregacao: "MEDIA" },
      { Codigo: "PERMANENCIA_15D", Title: "Pacientes com 15 dias ou mais (média diária)", Unidade: "pac.", Sentido: "MENOR", MetaPadrao: 20, Fonte: "AUTOMATICA", IndicadorDiario: "PERMANENCIA_15D", Agregacao: "MEDIA" },
      { Codigo: "VAGAS_CANCELADAS", Title: "Solicitações de vaga canceladas no mês", Unidade: "n", Sentido: "MENOR", MetaPadrao: 30, Fonte: "AUTOMATICA", IndicadorDiario: "VAGAS_CANCELADAS", Agregacao: "SOMA" },
      { Codigo: "MEDIA_PERMANENCIA", Title: "Média de permanência hospitalar", Unidade: "dias", Sentido: "MENOR", MetaPadrao: 6, Fonte: "PLANILHA" },
      { Codigo: "GIRO_LEITO", Title: "Giro de leito", Unidade: "pac./leito", Sentido: "MAIOR", MetaPadrao: 4, Fonte: "PLANILHA" },
      { Codigo: "ALTAS_ATE_12H", Title: "Altas até as 12h", Unidade: "%", Sentido: "MAIOR", MetaPadrao: 40, Fonte: "PLANILHA" },
    ];
    estado.indicadores = [];
    for (let k = 365; k >= 1; k--) {
      const d = new Date(); d.setDate(d.getDate() - k); const ch = isoDia(d); const t = (365 - k) / 365;
      const add = (ind, v) => estado.indicadores.push({ Indicador: ind, ChaveData: ch, Valor: Math.round(v * 10) / 10 });
      add("TEMPO_MEDIO_CESSAO_MIN", 150 - 45 * t + (r() - 0.5) * 40);
      add("PCT_CESSAO_NO_SLA", 55 + 25 * t + (r() - 0.5) * 20);
      add("OCUPACAO_PCT", 82 + 6 * t + (r() - 0.5) * 8);
      add("PERMANENCIA_15D", 30 - 10 * t + (r() - 0.5) * 6);
      add("VAGAS_CANCELADAS", Math.floor(r() * 3));
    }
    estado.metasValores = [];
    for (let k = 12; k >= 1; k--) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - k); const comp = isoDia(d).slice(0, 7); const t = (12 - k) / 12;
      estado.metasValores.push({ Codigo: "MEDIA_PERMANENCIA", Competencia: comp, Meta: 6, Realizado: Math.round((7.4 - 1.3 * t + (r() - 0.5) * 0.6) * 10) / 10 });
      estado.metasValores.push({ Codigo: "GIRO_LEITO", Competencia: comp, Meta: 4, Realizado: Math.round((3.4 + 0.7 * t + (r() - 0.5) * 0.4) * 10) / 10 });
      estado.metasValores.push({ Codigo: "ALTAS_ATE_12H", Competencia: comp, Meta: 40, Realizado: Math.round(28 + 10 * t + (r() - 0.5) * 8) });
    }
  };

  // ============================================================ PREVISÕES DE ALTA
  let filtroPA = { setor: "TODOS", aba: "48H" };
  function linhasPA() {
    return estado.internacoes
      .filter((i) => i.Status === "INTERNADO" && (filtroPA.setor === "TODOS" || i.SetorCodigo === filtroPA.setor))
      .map((i) => ({ i, dif: difDias(i.PrevisaoAlta) }));
  }
  function telaPrevisoes() {
    const base = linhasPA();
    const comPrev = estado.saidasHist.filter((s) => s.PrevisaoAlta);
    const acertos = comPrev.filter((s) => Math.abs(NX.diasEntre(s.PrevisaoAlta, s.SaidaDetectadaEm)) <= 1).length;
    const n = (f) => base.filter(f).length;
    const filtros = { HOJE: (x) => x.dif === 0, AMANHA: (x) => x.dif === 1, "48H": (x) => x.dif != null && x.dif >= 0 && x.dif <= 2, VENCIDAS: (x) => x.dif != null && x.dif < 0, SEM: (x) => x.dif == null, TODOS: () => true };
    const lista = base.filter(filtros[filtroPA.aba]).sort((a, b) => SETOR[a.i.SetorCodigo].ordem - SETOR[b.i.SetorCodigo].ordem || a.i.Leito.localeCompare(b.i.Leito, "pt-BR", { numeric: true }));
    const prox = Array.from({ length: 7 }, (_, k) => ({ k, n: estado.internacoes.filter((i) => i.Status === "INTERNADO" && difDias(i.PrevisaoAlta) === k).length }));
    const mx = Math.max(1, ...prox.map((p) => p.n));
    const sem = n((x) => x.dif == null);
    return `${topo("Previsões de Alta")}
    <div class="kpis">
      ${kpi("Altas previstas hoje", n(filtros.HOJE), "amanhã: " + n(filtros.AMANHA))}
      ${kpi("Próximas 48 h", n(filtros["48H"]), "hoje, amanhã e depois")}
      ${kpi("Previsões vencidas", n(filtros.VENCIDAS), "data passou e segue internado", n(filtros.VENCIDAS) ? "crit" : "good")}
      ${kpi("Sem previsão de alta", sem, base.length ? Math.round((sem / base.length) * 100) + "% dos internados" : "", sem ? "warn" : "good")}
      ${kpi("Acurácia (30 dias)", comPrev.length ? Math.round((acertos / comPrev.length) * 100) + "%" : "–", "alta em até 1 dia da previsão")}
    </div>
    <div class="cartao"><h2>Altas previstas nos próximos 7 dias</h2>
      <svg viewBox="0 0 700 150" role="img" aria-label="Altas previstas por dia">${prox.map((p) => { const x = p.k * 100 + 20, y = 118 - (90 * p.n) / mx; const d = hoje0(); d.setDate(d.getDate() + p.k); return `<rect x="${x}" y="${y}" width="60" height="${118 - y}" rx="4" fill="var(--accent)"/><rect x="${x - 15}" y="10" width="90" height="108" fill="transparent" data-tip="${diaSemana(d)}: ${p.n} alta(s) prevista(s)"/><text x="${x + 30}" y="${y - 6}" font-size="13" font-weight="600" text-anchor="middle" fill="var(--ink)">${p.n}</text><text x="${x + 30}" y="138" font-size="11" text-anchor="middle" fill="var(--ink-2)">${diaSemana(d)}</text>`; }).join("")}<line x1="0" x2="700" y1="118" y2="118" stroke="var(--line)"/></svg></div>
    <div class="cartao">
      <div class="abas" role="tablist"><select id="xpaSetor" data-xc="paSetor" aria-label="Setor" style="padding:6px;border:1px solid var(--line);border-radius:8px;background:var(--surface)"><option value="TODOS">Todos os setores</option>${SETORES.map((s) => `<option value="${s.codigo}" ${filtroPA.setor === s.codigo ? "selected" : ""}>${h(s.nome)}</option>`).join("")}</select>
      ${[["HOJE", "Hoje"], ["AMANHA", "Amanhã"], ["48H", "Próximas 48 h"], ["VENCIDAS", "Vencidas"], ["SEM", "Sem previsão"], ["TODOS", "Todos"]].map(([c, r]) => `<button class="aba" data-x="paAba" data-v="${c}" aria-selected="${filtroPA.aba === c}">${r}</button>`).join("")}</div>
      <div class="tabela-wrap" style="margin-top:10px;max-height:520px"><table><thead><tr><th>Leito</th><th>Paciente</th><th>Setor · dias</th><th>Previsão</th><th>Registrar</th><th></th></tr></thead><tbody>
      ${lista.map(({ i, dif }) => `<tr><td class="num"><b>${h(i.Leito)}</b></td><td>${h(i.Paciente)}</td><td>${sigla(i.SetorCodigo)} · ${NX.diasEntre(i.DataInternacao, new Date())} d</td>
        <td class="${dif == null ? "c-warn" : dif < 0 ? "c-crit" : ""}">${dif == null ? "Sem previsão" : dataBR(i.PrevisaoAlta) + (dif < 0 ? ` (vencida há ${-dif} d)` : dif === 0 ? " (hoje)" : dif === 1 ? " (amanhã)" : "")}<div class="suave">${i.PrevisaoAltaOrigem === "EQUIPE" ? "registrada por " + h(i.PrevisaoAltaPor || "equipe") : i.PrevisaoAltaOrigem === "TASY" ? "vinda do Tasy" : ""}</div></td>
        <td>${podePerm() || ehNIR() ? `<input type="date" id="pa${i.NrAtendimento}" value="${i.PrevisaoAlta ? isoDia(i.PrevisaoAlta) : ""}" aria-label="Nova previsão"> <button class="btn peq" data-x="paSalvar" data-id="${i.NrAtendimento}">Salvar</button>` : "–"}</td>
        <td><button class="btn sec peq" data-x="paHist" data-id="${i.NrAtendimento}">Histórico</button></td></tr>`).join("") || '<tr><td colspan="6" class="suave">Nenhum paciente neste filtro.</td></tr>'}</tbody></table></div></div>`;
  }
  function salvarPrevisao(atend, valor, motivo = "") {
    const i = estado.internacoes.find((x) => x.NrAtendimento === atend);
    if (!valor) return toast("Escolha a data prevista de alta.");
    const nova = deInput(valor, "00:00");
    estado.previsoesHist.push({ NrAtendimento: atend, DataPrevista: nova, DataAnterior: i.PrevisaoAlta, RegistradoEm: new Date(), RegistradoPorNome: eu(), Motivo: motivo });
    Object.assign(i, { PrevisaoAlta: nova, PrevisaoAltaOrigem: "EQUIPE", PrevisaoAltaPor: eu() });
    toast(`${i.Paciente}: previsão de alta em ${dataBR(nova)}.`);
  }

  // ======================================================== GESTÃO DA PERMANÊNCIA
  let pacPM = null, espPM = "MEDICO", filtroPM = { setor: "TODOS", busca: "" };
  const acompDe = (at) => (estado.acomp[at] ||= { PendMedico: false, PendEnfermagem: false, PendServicoSocial: false, PendFisioterapia: false, DestinoAltaPrevisto: "", PlanoTerapeutico: "", Observacao: "" });
  function telaPermanencia() {
    const perm = estado.internacoes.filter((i) => i.Status === "INTERNADO" && NX.diasEntre(i.DataInternacao, new Date()) >= 15).map((i) => ({ i, d: NX.diasEntre(i.DataInternacao, new Date()), a: acompDe(i.NrAtendimento) }));
    const tops = estado.topicos.filter((t) => perm.some((p) => p.i.NrAtendimento === t.NrAtendimento));
    const abertos = tops.filter((t) => t.Status !== "CONCLUIDO");
    const atras = abertos.filter((t) => t.Prazo && t.Prazo < hoje0()).length;
    const semPrev = perm.filter((p) => !p.i.PrevisaoAlta).length;
    const lista = perm.filter((p) => (filtroPM.setor === "TODOS" || p.i.SetorCodigo === filtroPM.setor) && (!filtroPM.busca || (p.i.Paciente + p.i.Leito + p.i.NrAtendimento).toLowerCase().includes(filtroPM.busca.toLowerCase()))).sort((a, b) => b.d - a.d);
    const sel = perm.find((p) => p.i.NrAtendimento === pacPM);
    const campoSel = ESPEC.find((e) => e[0] === espPM)[1];
    return `${topo("Gestão da Permanência")}
    <div class="kpis">
      ${kpi("Pacientes com ≥ 15 dias", perm.length, `15–29 d: ${perm.filter((p) => p.d < 30).length} · 30–59 d: ${perm.filter((p) => p.d >= 30 && p.d < 60).length} · ≥ 60 d: ${perm.filter((p) => p.d >= 60).length}`)}
      ${kpi("Sem previsão de alta", semPrev, "todos devem ter previsão", semPrev ? "crit" : "good")}
      ${kpi("Tópicos em aberto", abertos.length, `${abertos.filter((t) => t.Status === "PLANEJADO").length} planejados · ${abertos.filter((t) => t.Status === "EM_ANDAMENTO").length} em andamento`)}
      ${kpi("Prazo vencido", atras, "tópicos abertos com prazo passado", atras ? "crit" : "good")}
      ${kpi("Concluídos (30 d)", tops.filter((t) => t.Status === "CONCLUIDO").length, "pendências resolvidas", "good")}
    </div>
    <div class="cartao"><h2>Pendências por especialidade</h2><div class="tabela-wrap"><table><thead><tr><th>Especialidade</th><th>Pacientes com pendência</th><th>Planejado</th><th>Em andamento</th><th>Concluído (30 d)</th></tr></thead><tbody>
      ${ESPEC.map(([cod, campo, nome]) => `<tr><td>${nome}</td><td class="num">${perm.filter((p) => p.a[campo]).length}</td>${["PLANEJADO", "EM_ANDAMENTO", "CONCLUIDO"].map((s) => `<td class="num">${tops.filter((t) => t.Especialidade === cod && t.Status === s).length}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>
    <div class="cartao"><h2>Pacientes <small>marque a especialidade que tem pendência para abrir o Kanban</small></h2>
      <div class="campos"><div class="campo"><label for="xpmSetor">Setor</label><select id="xpmSetor" data-xc="pmSetor"><option value="TODOS">Todos os setores</option>${SETORES.map((s) => `<option value="${s.codigo}" ${filtroPM.setor === s.codigo ? "selected" : ""}>${h(s.nome)}</option>`).join("")}</select></div>
      <div class="campo"><label for="xpmBusca">Buscar</label><input id="xpmBusca" data-xc="pmBusca" value="${h(filtroPM.busca)}" placeholder="Paciente, leito ou atendimento"></div></div>
      <div class="lista" style="margin-top:8px;max-height:420px;overflow-y:auto">${lista.map((p) => `<div class="it" style="${p.i.NrAtendimento === pacPM ? "background:var(--accent-soft);" : ""}padding-left:8px">
        <div style="min-width:0;cursor:pointer" data-x="pmSel" data-id="${p.i.NrAtendimento}"><b>${h(p.i.Leito)} · ${h(p.i.Paciente)}</b><div class="suave ${p.d >= 60 ? "c-crit" : p.d >= 30 ? "c-warn" : ""}">${sigla(p.i.SetorCodigo)} · ${p.d} dias · ${p.i.PrevisaoAlta ? "alta prevista " + dataBR(p.i.PrevisaoAlta) : "<span class='c-crit'>sem previsão de alta</span>"}</div></div>
        <div class="acoes">${ESPEC.map(([cod, campo, nome]) => { const nAb = estado.topicos.filter((t) => t.NrAtendimento === p.i.NrAtendimento && t.Especialidade === cod && t.Status !== "CONCLUIDO").length; return `<button class="aba" style="font-size:12px;padding:4px 10px" aria-selected="${p.a[campo]}" data-x="pmFlag" data-id="${p.i.NrAtendimento}" data-v="${campo}" ${podePerm() ? "" : "disabled"}>${p.a[campo] ? "✓ " : ""}${nome}${nAb ? ` (${nAb})` : ""}</button>`; }).join("")}</div></div>`).join("") || '<div class="vazio">Nenhum paciente neste filtro.</div>'}</div></div>
    ${sel ? `<div class="cartao nova"><h2>Plano de ${h(sel.i.Paciente)} <small>${sel.d} dias de internação · ${sigla(sel.i.SetorCodigo)} leito ${h(sel.i.Leito)}</small></h2>
      <div class="passos" style="grid-template-columns:minmax(0,1fr) minmax(0,2.2fr)">
        <div class="campos" style="grid-template-columns:1fr">
          <div class="campo"><label for="xpmPrev">Previsão de alta</label><input type="date" id="xpmPrev" value="${sel.i.PrevisaoAlta ? isoDia(sel.i.PrevisaoAlta) : ""}"></div>
          <div class="campo"><label for="xpmDest">Destino de alta previsto</label><select id="xpmDest"><option value=""></option>${DESTINOS_ALTA.map((d) => `<option ${sel.a.DestinoAltaPrevisto === d ? "selected" : ""}>${d}</option>`).join("")}</select></div>
          <div class="campo"><label for="xpmPlano">Plano / o que falta para a alta</label><textarea id="xpmPlano" rows="4">${h(sel.a.PlanoTerapeutico)}</textarea></div>
          <div class="campo"><label for="xpmObs">Observações</label><textarea id="xpmObs" rows="3">${h(sel.a.Observacao)}</textarea></div>
          ${podePerm() ? `<button class="btn" data-x="pmPlano" data-id="${sel.i.NrAtendimento}">Salvar plano</button>` : ""}
        </div>
        <div style="min-width:0">
          <div class="abas">${ESPEC.map(([cod, campo, nome]) => `<button class="aba" data-x="pmEsp" data-v="${cod}" aria-selected="${espPM === cod}">${nome}${sel.a[campo] ? " ✓" : ""}</button>`).join("")}</div>
          ${sel.a[campoSel] ? `${podePerm() ? `<div class="campos" style="margin-top:10px;grid-template-columns:minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) auto;align-items:end"><div class="campo"><label for="xpmTop">Novo tópico</label><input id="xpmTop" placeholder="Ex.: aguarda vaga em ILPI"></div><div class="campo"><label for="xpmResp">Responsável</label><input id="xpmResp"></div><div class="campo"><label for="xpmPrazo">Prazo</label><input type="date" id="xpmPrazo"></div><button class="btn" data-x="pmTopico">Incluir</button></div>` : ""}
          <div class="kanban">${["PLANEJADO", "EM_ANDAMENTO", "CONCLUIDO"].map((st, k, arr) => { const ts = estado.topicos.filter((t) => t.NrAtendimento === pacPM && t.Especialidade === espPM && t.Status === st); return `<div class="kcol"><div class="khead st-${st === "CONCLUIDO" ? "good" : st === "EM_ANDAMENTO" ? "warn" : "mute"}">${ST_TOPICO[st]} (${ts.length})</div>${ts.map((t) => `<div class="kcard"><b>${h(t.Titulo)}</b><div class="suave ${t.Prazo && t.Prazo < hoje0() && st !== "CONCLUIDO" ? "c-crit" : ""}">${h(t.Responsavel || "sem responsável")}${t.Prazo ? " · prazo " + dataBR(t.Prazo) : ""}</div>${podePerm() ? `<div class="acoes" style="margin-top:6px">${k > 0 ? `<button class="btn sec peq" data-x="pmMove" data-id="${t.ID}" data-v="${arr[k - 1]}">◀</button>` : ""}${k < 2 ? `<button class="btn peq" data-x="pmMove" data-id="${t.ID}" data-v="${arr[k + 1]}">${k === 0 ? "Iniciar ▶" : "Concluir ▶"}</button>` : ""}</div>` : ""}</div>`).join("") || '<div class="suave" style="padding:6px">—</div>'}</div>`; }).join("")}</div>`
          : `<div class="vazio" style="margin-top:10px">Esta especialidade não está marcada com pendência para o paciente. Marque-a na lista acima para abrir o Kanban.</div>`}
        </div></div></div>` : '<div class="cartao suave">Clique em um paciente da lista para ver o plano e o Kanban das pendências.</div>'}`;
  }

  // ================================================================= AMBULÂNCIAS
  let abaAM = "24H", editAM = null;
  function telaAmbulancias() {
    const ag = Date.now();
    const at = estado.transportes.filter((t) => ATIVOS_TR.includes(t.Status));
    const h24 = at.filter((t) => t.Status !== "SAIU" && t.AgendadoPara <= ag + 864e5);
    const h48 = at.filter((t) => t.Status !== "SAIU" && t.AgendadoPara > ag + 864e5 && t.AgendadoPara <= ag + 1728e5);
    const and = at.filter((t) => ["SOLICITADA", "CONFIRMADA", "NO_LOCAL"].includes(t.Status));
    const radar = at.filter((t) => t.Status === "SAIU");
    const atras = at.filter((t) => ["AGENDADO", "SOLICITADA", "CONFIRMADA"].includes(t.Status) && t.AgendadoPara < ag);
    const inc = h24.filter((t) => chkSoma(t) < 9).length;
    const lista = (abaAM === "HIST" ? estado.transportesHist : { "24H": h24, "48H": h48, ANDAMENTO: and, RADAR: radar, TODOS: at }[abaAM]).slice().sort((a, b) => (abaAM === "HIST" ? b.AgendadoPara - a.AgendadoPara : a.AgendadoPara - b.AgendadoPara));
    return `${topo("Ambulâncias", ehNIR() ? '<button class="btn" data-x="amNovo">+ Novo transporte</button>' : "")}
    <div class="kpis">${kpi("Próximas 24 h", h24.length, "24–48 h: " + h48.length)}${kpi("Em andamento", and.length, "ambulância pedida, confirmada ou no hospital")}${kpi("Checklist incompleto (24 h)", inc, "transportes com itens pendentes", inc ? "warn" : "good")}${kpi("Atrasados", atras.length, "horário passou e o paciente não saiu", atras.length ? "crit" : "good")}${kpi("No radar", radar.length, "fora do hospital, podem retornar")}</div>
    ${editAM ? formAmb() : ""}
    <div class="abas">${[["24H", "Próximas 24 h"], ["48H", "24 a 48 h"], ["ANDAMENTO", "Em andamento"], ["RADAR", "Radar (fora)"], ["TODOS", "Todos ativos"], ["HIST", "Histórico 30 d"]].map(([c, r]) => `<button class="aba" data-x="amAba" data-v="${c}" aria-selected="${abaAM === c}">${r}</button>`).join("")}</div>
    <div class="cards-vaga">${lista.map((t) => { const m = Math.round((t.AgendadoPara - ag) / 60000); const n = chkSoma(t); const passo = PASSOS_TR[t.Status]; const nv = t.Status === "SAIU" ? "info" : m < 0 && t.Status !== "NO_LOCAL" ? "crit" : n < 9 ? "warn" : "good"; return `<article class="vaga-card"><span class="faixa bg-${nv}"></span><div class="corpo">
      <div class="l1"><div style="min-width:0"><div class="nome">${h(t.Title)} <span class="suave">· atend. ${t.NrAtendimento}</span></div><div class="rota">${sigla(t.SetorOrigem)} leito ${h(t.Leito)} → <b>${h(t.Destino)}</b> · ${h(t.Empresa)} · ${TIPOS_TR[t.TipoTransporte]} · ${MOTIVOS_TR[t.Motivo][0]}</div></div>
      <div class="crono" style="font-size:14px">${dataHoraBR(t.AgendadoPara)}<small>${t.Status === "SAIU" ? "fora desde " + dataHoraBR(t.SaidaPacienteEm) : abaAM === "HIST" ? ST_TR[t.Status] : m >= 0 ? "em " + NX.minutosTexto(m) : "<span class='c-crit'>atrasado " + NX.minutosTexto(-m) + "</span>"} · ${ST_TR[t.Status]}</small></div></div>
      <div class="ops">${CHECK.map(([f, r]) => `<button class="aba" style="font-size:11.5px;padding:3px 8px" aria-selected="${!!t[f]}" data-x="amChk" data-id="${t.ID}" data-v="${f}" ${ehNIR() && abaAM !== "HIST" ? "" : "disabled"}>${t[f] ? "✓ " : ""}${r}</button>`).join("")}<span class="suave ${n < 9 ? "c-warn" : "c-good"}">checklist ${n}/9</span></div>
      ${ehNIR() && abaAM !== "HIST" ? `<div class="ops">${passo ? `<button class="btn peq" data-x="amPasso" data-id="${t.ID}">${passo[0]}</button>` : ""}${t.Status === "SAIU" ? `<button class="btn sec peq" data-x="amFim" data-id="${t.ID}">Não retornará</button>` : `<button class="btn sec peq" data-x="amEditar" data-id="${t.ID}">Editar</button><button class="btn perigo peq" data-x="amCancelar" data-id="${t.ID}">Cancelar</button>`}</div>` : ""}
      </div></article>`; }).join("") || '<div class="vazio">Nenhum transporte nesta aba.</div>'}</div>`;
  }
  function formAmb() {
    const t = editAM === "novo" ? null : estado.transportes.find((x) => x.ID === editAM);
    const ag = t ? t.AgendadoPara : new Date(Date.now() + 864e5);
    return `<div class="cartao nova"><h2>${t ? "Editar transporte · " + h(t.Title) : "Novo transporte"}</h2><div class="campos">
      ${t ? "" : `<div class="campo" style="grid-column:1/-1"><label for="xamPac">Paciente internado</label><select id="xamPac"><option value="">Escolha…</option>${estado.internacoes.filter((i) => i.Status === "INTERNADO").sort((a, b) => a.Paciente.localeCompare(b.Paciente)).map((i) => `<option value="${i.NrAtendimento}">${h(i.Paciente)} · ${sigla(i.SetorCodigo)} ${h(i.Leito)}</option>`).join("")}</select></div>`}
      <div class="campo"><label for="xamTipo">Tipo</label><select id="xamTipo">${Object.entries(TIPOS_TR).map(([c, r]) => `<option value="${c}" ${(t ? t.TipoTransporte : "USB") === c ? "selected" : ""}>${r}</option>`).join("")}</select></div>
      <div class="campo"><label for="xamMotivo">Motivo</label><select id="xamMotivo">${Object.entries(MOTIVOS_TR).map(([c, r]) => `<option value="${c}" ${(t ? t.Motivo : "EXAME_EXTERNO") === c ? "selected" : ""}>${r[0]}</option>`).join("")}</select></div>
      <div class="campo"><label for="xamDestino">Destino</label><input id="xamDestino" value="${h(t ? t.Destino : "")}"></div>
      <div class="campo"><label for="xamEmpresa">Empresa</label><input id="xamEmpresa" value="${h(t ? t.Empresa : "")}"></div>
      <div class="campo"><label for="xamData">Data</label><input type="date" id="xamData" value="${isoDia(ag)}"></div>
      <div class="campo"><label for="xamHora">Hora</label><input type="time" id="xamHora" value="${dd(ag.getHours())}:${dd(ag.getMinutes())}"></div>
      <div class="campo"><label for="xamRet">Retorno</label><select id="xamRet"><option value="1" ${!t || t.PodeRetornar ? "selected" : ""}>Paciente deve retornar</option><option value="0" ${t && !t.PodeRetornar ? "selected" : ""}>Não retorna</option></select></div>
      <div class="campo" style="grid-column:1/-1"><label for="xamObs">Observação</label><input id="xamObs" value="${h(t ? t.Observacao : "")}"></div></div>
      <div class="linha-acoes"><button class="btn" data-x="amSalvar">Salvar</button><button class="btn sec" data-x="amFechar">Fechar</button></div></div>`;
  }

  // ================================================================= CATETERISMOS
  let periodoCT = "DIA", diaCT = hoje0(), filtroCT = { tipo: "TODOS", status: "TODOS" }, editCT = null, importCT = null;
  function telaCateterismos() {
    const cs = estado.cateterismos;
    const hojeL = cs.filter((c) => NX.chaveDia(c.DataHoraExame) === NX.chaveDia(new Date()) && c.Status !== "CANCELADO");
    const aguard = cs.filter((c) => cateAtivo(c) && c.Tipo.startsWith("INTERNADO"));
    const diasAg = aguard.map((c) => estado.internacoes.find((i) => i.NrAtendimento === c.NrAtendimento)).filter(Boolean).map((i) => NX.diasEntre(i.DataInternacao, new Date()));
    const am = new Date(); am.setDate(am.getDate() + 1);
    const lista = cs.filter((c) => (periodoCT === "DIA" ? NX.chaveDia(c.DataHoraExame) === NX.chaveDia(diaCT) : periodoCT === "SEMANA" ? c.DataHoraExame >= hoje0() && c.DataHoraExame < new Date(hoje0().getTime() + 7 * 864e5) : cateAtivo(c) && c.Tipo.startsWith("INTERNADO")) && (filtroCT.tipo === "TODOS" || c.Tipo === filtroCT.tipo) && (filtroCT.status === "TODOS" || c.Status === filtroCT.status)).sort((a, b) => a.DataHoraExame - b.DataHoraExame);
    return `${topo("Cateterismos", ehNIR() ? '<button class="btn" data-x="ctNovo">+ Novo</button><button class="btn sec" data-x="ctImport">Importar planilha</button>' : "")}
    <div class="kpis">${kpi("Cateterismos hoje", hojeL.length, Object.entries(TIPOS_CATE).map(([c, [r]]) => `${r}: ${hojeL.filter((x) => x.Tipo === c).length}`).join(" · "))}${kpi("Amanhã", cs.filter((c) => NX.chaveDia(c.DataHoraExame) === NX.chaveDia(am) && cateAtivo(c)).length, "próximos 7 dias: " + cs.filter((c) => cateAtivo(c) && c.DataHoraExame >= hoje0() && c.DataHoraExame < new Date(hoje0().getTime() + 7 * 864e5)).length)}${kpi("Internados aguardando", aguard.length, diasAg.length ? `internados há ${Math.round(diasAg.reduce((a, b) => a + b, 0) / diasAg.length)} dias em média` : "nenhum", aguard.length ? "warn" : "")}${kpi("Cancelados/suspensos (30 d)", cs.filter((c) => ["CANCELADO", "SUSPENSO"].includes(c.Status) && c.DataHoraExame < new Date()).length, "no período")}</div>
    ${editCT ? formCate() : ""}${importCT ? blocoImportCate() : ""}
    <div class="abas"><button class="aba" data-x="ctPer" data-v="DIA" aria-selected="${periodoCT === "DIA"}">Dia</button><button class="aba" data-x="ctPer" data-v="SEMANA" aria-selected="${periodoCT === "SEMANA"}">Próximos 7 dias</button><button class="aba" data-x="ctPer" data-v="AGUARDANDO" aria-selected="${periodoCT === "AGUARDANDO"}">Internados aguardando</button>
      <button class="btn sec peq" data-x="ctDia" data-v="-1" aria-label="Dia anterior">◀</button><b style="min-width:120px;text-align:center">${diaSemana(diaCT)}</b><button class="btn sec peq" data-x="ctDia" data-v="1" aria-label="Próximo dia">▶</button><button class="btn sec peq" data-x="ctDia" data-v="0">Hoje</button>
      <select data-xc="ctTipo" aria-label="Tipo" style="padding:6px;border:1px solid var(--line);border-radius:8px;background:var(--surface)"><option value="TODOS">Todos os tipos</option>${Object.entries(TIPOS_CATE).map(([c, [r]]) => `<option value="${c}" ${filtroCT.tipo === c ? "selected" : ""}>${r}</option>`).join("")}</select>
      <select data-xc="ctStatus" aria-label="Status" style="padding:6px;border:1px solid var(--line);border-radius:8px;background:var(--surface)"><option value="TODOS">Todos os status</option>${Object.entries(ST_CATE).map(([c, r]) => `<option value="${c}" ${filtroCT.status === c ? "selected" : ""}>${r}</option>`).join("")}</select></div>
    <div class="legenda">${Object.values(TIPOS_CATE).map(([r, cor]) => `<span><i style="background:${cor}"></i>${r}</span>`).join("")}</div>
    <div class="cards-vaga">${lista.map((c) => { const i = estado.internacoes.find((x) => x.NrAtendimento === c.NrAtendimento && x.Status === "INTERNADO"); const [rot, cor] = TIPOS_CATE[c.Tipo]; return `<article class="vaga-card"><span class="faixa" style="background:${cor}"></span><div class="corpo">
      <div class="l1"><div style="min-width:0"><div class="nome"><span style="font-family:var(--font-num)">${periodoCT === "DIA" ? fmtHora(c.DataHoraExame) : dataHoraBR(c.DataHoraExame)}</span> · ${h(c.Title)}</div><div class="rota" style="color:${cor};font-weight:600">${rot}</div>
      <div class="por">${i ? `Internado em ${sigla(i.SetorCodigo)} leito ${h(i.Leito)} · atend. ${i.NrAtendimento}` : c.ServicoOrigem ? "Procedência: " + h(c.ServicoOrigem) : ""} · ${h(c.Procedimento)} · ${h(c.MedicoSolicitante || "")}</div></div>
      <div class="crono" style="font-size:13px">${ST_CATE[c.Status]}<small>${c.DestinoPosExame ? "destino: " + h(c.DestinoPosExame) : ""}${c.Origem === "RECEPCAO" ? " · veio da Previsão de Recepção" : ""}${c.Observacao ? " · " + h(c.Observacao) : ""}</small></div></div>
      ${ehNIR() ? `<div class="ops">${cateAtivo(c) ? `<select id="ctd${c.ID}" aria-label="Destino após o exame"><option value="">Destino após o exame…</option>${DEST_POS_CATE.map((d) => `<option>${d}</option>`).join("")}</select><button class="btn ok peq" data-x="ctRealizado" data-id="${c.ID}">Realizado</button><input type="date" id="ctr${c.ID}" value="${isoDia(c.DataHoraExame)}" aria-label="Nova data"><button class="btn sec peq" data-x="ctRemarcar" data-id="${c.ID}">Remarcar</button><button class="btn sec peq" data-x="ctSusp" data-id="${c.ID}">Suspender</button><button class="btn perigo peq" data-x="ctCanc" data-id="${c.ID}">Cancelar</button>` : ""}${i ? `<button class="btn sec peq" data-x="ctVaga" data-id="${c.ID}">Solicitar vaga</button>` : ""}<button class="btn sec peq" data-x="ctEditar" data-id="${c.ID}">Editar</button></div>` : ""}
      </div></article>`; }).join("") || '<div class="vazio">Nenhum cateterismo neste filtro.</div>'}</div>`;
  }
  function formCate() {
    const c = editCT === "novo" ? null : estado.cateterismos.find((x) => x.ID === editCT);
    const d = c ? c.DataHoraExame : new Date(hoje0().getTime() + 864e5 + 8 * 36e5);
    return `<div class="cartao nova"><h2>${c ? "Editar cateterismo · " + h(c.Title) : "Novo cateterismo na agenda"}</h2><div class="campos">
      <div class="campo"><label for="xctAt">Nº de atendimento (se internado)</label><input id="xctAt" value="${h(c ? c.NrAtendimento : "")}"></div>
      <div class="campo"><label for="xctPac">Paciente</label><input id="xctPac" value="${h(c ? c.Title : "")}" placeholder="vazio = nome do internado"></div>
      <div class="campo"><label for="xctTipo">Tipo do paciente</label><select id="xctTipo">${Object.entries(TIPOS_CATE).map(([k, [r]]) => `<option value="${k}" ${c && c.Tipo === k ? "selected" : ""}>${r}</option>`).join("")}</select></div>
      <div class="campo"><label for="xctData">Data</label><input type="date" id="xctData" value="${isoDia(d)}"></div><div class="campo"><label for="xctHora">Hora</label><input type="time" id="xctHora" value="${dd(d.getHours())}:${dd(d.getMinutes())}"></div>
      <div class="campo"><label for="xctOrigem">Procedência (externos)</label><input id="xctOrigem" value="${h(c ? c.ServicoOrigem : "")}"></div></div>
      <div class="linha-acoes"><button class="btn" data-x="ctSalvar">Salvar</button><button class="btn sec" data-x="ctFechar">Fechar</button></div></div>`;
  }
  function exemploPlanilhaCate() {
    const d1 = new Date(hoje0().getTime() + 2 * 864e5), d2 = new Date(hoje0().getTime() + 3 * 864e5);
    const ui = estado.internacoes.filter((i) => i.Status === "INTERNADO" && i.SetorCodigo.startsWith("UI7"));
    return ["AGENDA DA HEMODINÂMICA (exemplo)", ["Data", "Hora", "Paciente", "Tipo", "Atendimento", "Procedência", "Médico"].join("\t"),
      [dataBR(d1), "08:00", "Paciente planilha 01", "Externo eletivo", "", "UBS Leste", "Dr. C. Souza"].join("\t"),
      [dataBR(d1), "09:30", ui[0].Paciente, "Internado eletivo", ui[0].NrAtendimento, "", "Dra. D. Prado"].join("\t"),
      [dataBR(d1), "11:00", "Paciente planilha 02", "Urgência relativa", "", "Hospital municipal", "Dr. C. Souza"].join("\t"),
      [dataBR(d2), "08:00", ui[1].Paciente, "Internado - urgência", ui[1].NrAtendimento, "", "Dr. E. Nunes"].join("\t"),
      [dataBR(d2), "", "Paciente planilha 03", "", "", "AME Cardiologia", ""].join("\t"),
      [dataBR(estado.cateterismos[0].DataHoraExame), "08:00", estado.cateterismos[0].Title, "Externo eletivo", "", "UBS Centro", ""].join("\t")].join("\r\n");
  }
  function blocoImportCate() {
    const r = importCT.res;
    return `<div class="cartao nova"><h2>Importar agenda da planilha <small>colunas reconhecidas: Data, Hora, Paciente, Tipo, Atendimento, Prontuário, Idade, Procedimento, Médico, Convênio, Procedência, Observação</small></h2>
      <textarea id="xctTxt" rows="6" placeholder="Cole aqui a tabela do Excel (Ctrl+V)">${h(importCT.texto)}</textarea>
      <div class="linha-acoes"><button class="btn sec peq" data-x="ctExemplo">Gerar planilha de exemplo</button><button class="btn" data-x="ctPrevia">Pré-visualizar</button><button class="btn" data-x="ctIncluir" ${r && r.ok && r.itens.some((i) => !i.Problema) ? "" : "disabled"}>Incluir na agenda</button><button class="btn sec" data-x="ctFecharImp">Fechar</button></div>
      ${r ? (r.ok ? `<div class="tabela-wrap" style="margin-top:10px"><table><thead><tr><th>Data</th><th>Paciente</th><th>Tipo</th><th>Situação</th></tr></thead><tbody>${r.itens.map((i) => `<tr><td class="num">${i.DataHora ? dataHoraBR(i.DataHora) : "–"}</td><td>${h(i.Paciente)}</td><td>${TIPOS_CATE[i.Tipo][0]}${i.TipoLido ? "" : " <span class='suave'>(deduzido)</span>"}</td><td class="${i.Problema ? "c-crit" : "c-good"}">${i.Problema || "ok"}</td></tr>`).join("")}</tbody></table></div>` : `<div class="alerta crit">${h(r.erro)}</div>`) : ""}</div>`;
  }

  // ======================================================== PREVISÃO DE RECEPÇÃO
  let abaRC = "PROXIMOS", editRC = null, cateEditRC = null;
  function telaRecepcao() {
    const rs = estado.recepcoes.filter((r) => r.Status === "PREVISTO" || r.Status === "CHEGOU");
    const hist = estado.recepcoesHist;
    const nh = hist.filter((r) => r.Status !== "CANCELADO").length;
    const f = { HOJE: (r) => difDias(r.PrevistoPara) === 0, AMANHA: (r) => difDias(r.PrevistoPara) === 1, PROXIMOS: (r) => difDias(r.PrevistoPara) >= 0 && difDias(r.PrevistoPara) <= 7, ATRASADOS: (r) => difDias(r.PrevistoPara) < 0 && r.Status === "PREVISTO", HIST: () => true };
    const fonte = abaRC === "HIST" ? hist : rs;
    const col = (sec) => fonte.filter((r) => r.Secao === sec && f[abaRC](r)).sort((a, b) => (abaRC === "HIST" ? b.PrevistoPara - a.PrevistoPara : a.PrevistoPara - b.PrevistoPara));
    return `${topo("Previsão de Recepção · CROSS", ehNIR() ? '<button class="btn" data-x="rcNovo">+ Novo paciente CROSS</button>' : "")}
    <div class="kpis">${kpi("Chegam hoje", rs.filter(f.HOJE).length, "amanhã: " + rs.filter(f.AMANHA).length)}${kpi("Próximos dias", rs.filter(f.PROXIMOS).length, "até 7 dias · " + rs.filter((r) => r.PrecisaCateterismo).length + " com cateterismo")}${kpi("Atrasados", rs.filter(f.ATRASADOS).length, "data passou e não chegaram", rs.filter(f.ATRASADOS).length ? "crit" : "good")}${kpi("Retornaram à origem (30 d)", nh ? Math.round((hist.filter((r) => r.Status === "RETORNOU_ORIGEM").length / nh) * 100) + "%" : "–", hist.filter((r) => r.Status === "INTERNADO").length + " internaram")}${kpi("Não compareceram (30 d)", nh ? Math.round((hist.filter((r) => r.Status === "NAO_COMPARECEU").length / nh) * 100) + "%" : "–", hist.filter((r) => r.Status === "NAO_COMPARECEU").length + " paciente(s)")}</div>
    ${editRC ? formRecep() : ""}
    <div class="abas">${[["HOJE", "Hoje"], ["AMANHA", "Amanhã"], ["PROXIMOS", "Próximos dias"], ["ATRASADOS", "Atrasados"], ["HIST", "Desfechos 30 d"]].map(([c, r]) => `<button class="aba" data-x="rcAba" data-v="${c}" aria-selected="${abaRC === c}">${r}</button>`).join("")}</div>
    <div class="colunas2">${Object.entries(SECOES).map(([sec, rot]) => { const l = col(sec); return `<div style="min-width:0"><h2 style="font-size:15px;margin:4px 0 8px">${rot} (${l.length})</h2><div class="cards-vaga">${l.map(cartaoRecep).join("") || '<div class="vazio">Nenhum paciente.</div>'}</div></div>`; }).join("")}</div>`;
  }
  function cartaoRecep(r) {
    const ativo = r.Status === "PREVISTO" || r.Status === "CHEGOU";
    const atras = r.Status === "PREVISTO" && difDias(r.PrevistoPara) < 0;
    const editando = cateEditRC === r.ID;
    return `<article class="vaga-card"><span class="faixa bg-${r.Status === "CHEGOU" ? "good" : atras ? "crit" : ativo ? "info" : "mute"}"></span><div class="corpo">
      <div class="l1"><div style="min-width:0"><div class="nome">${h(r.Title)}, ${h(r.Idade)}</div><div class="por">${h(r.ServicoOrigem)} (${h(r.MunicipioOrigem)}) · ${h(r.Especialidade)}${r.SetorPrevisto ? " · destino " + sigla(r.SetorPrevisto) : ""}</div><div class="por">CROSS ${h(r.NrFichaCROSS)} · ${ST_REC[r.Status]}</div></div>
      <div class="crono" style="font-size:13px">${dataHoraBR(r.PrevistoPara)}<small class="${atras ? "c-crit" : ""}">${atras ? "atrasado" : ""}</small></div></div>
      <div class="ops"><button class="aba" style="font-size:12px;padding:4px 10px" aria-selected="${!!r.PrecisaCateterismo}" data-x="rcCate" data-id="${r.ID}" ${ehNIR() && ativo ? "" : "disabled"}>${r.PrecisaCateterismo ? "✓ Cateterismo " + dataHoraBR(r.DataCateterismo) : "Cateterismo?"}</button>
      ${editando ? `<input type="date" id="rcd${r.ID}" value="${isoDia(r.DataCateterismo || r.PrevistoPara)}" aria-label="Data do cateterismo"><input type="time" id="rch${r.ID}" value="${r.DataCateterismo ? dd(r.DataCateterismo.getHours()) + ":" + dd(r.DataCateterismo.getMinutes()) : "08:00"}" aria-label="Hora"><select id="rct${r.ID}" aria-label="Tipo"><option value="EXTERNO_ELETIVO">Externo Eletivo</option><option value="EXTERNO_URGENCIA_RELATIVA" ${r.TipoCateterismo === "EXTERNO_URGENCIA_RELATIVA" ? "selected" : ""}>Externo Urgência Relativa</option></select><button class="btn peq" data-x="rcAgendar" data-id="${r.ID}">Agendar</button>${r.PrecisaCateterismo ? `<button class="btn sec peq" data-x="rcDesmarcar" data-id="${r.ID}">Desmarcar</button>` : ""}` : ""}</div>
      ${ehNIR() && ativo && !editando ? `<div class="ops">${r.Status === "PREVISTO" ? `<button class="btn sec peq" data-x="rcDesf" data-v="CHEGOU" data-id="${r.ID}">Chegou</button>` : ""}<input id="rca${r.ID}" placeholder="Atendimento" aria-label="Nº de atendimento"><button class="btn peq" data-x="rcInternar" data-id="${r.ID}">Internado</button><button class="btn sec peq" data-x="rcDesf" data-v="RETORNOU_ORIGEM" data-id="${r.ID}">Retornou à origem</button>${r.Status === "PREVISTO" ? `<button class="btn sec peq" data-x="rcDesf" data-v="NAO_COMPARECEU" data-id="${r.ID}">Não veio</button>` : ""}<button class="btn perigo peq" data-x="rcDesf" data-v="CANCELADO" data-id="${r.ID}">Cancelar</button><button class="btn sec peq" data-x="rcEditar" data-id="${r.ID}">Editar</button></div>` : ""}
      </div></article>`;
  }
  function formRecep() {
    const r = editRC === "novo" ? null : estado.recepcoes.find((x) => x.ID === editRC);
    const d = r ? r.PrevistoPara : new Date(hoje0().getTime() + 864e5 + 9 * 36e5);
    const v = (k) => h(r ? r[k] || "" : "");
    return `<div class="cartao nova"><h2>${r ? "Editar · " + h(r.Title) : "Novo paciente aceito via CROSS"}</h2><div class="campos">
      <div class="campo"><label for="xrcPac">Paciente</label><input id="xrcPac" value="${v("Title")}"></div><div class="campo"><label for="xrcIdade">Idade</label><input id="xrcIdade" value="${v("Idade")}"></div>
      <div class="campo"><label for="xrcFicha">Nº da ficha CROSS</label><input id="xrcFicha" value="${v("NrFichaCROSS")}"></div>
      <div class="campo"><label for="xrcSecao">Seção</label><select id="xrcSecao">${Object.entries(SECOES).map(([c, t]) => `<option value="${c}" ${r && r.Secao === c ? "selected" : ""}>${t}</option>`).join("")}</select></div>
      <div class="campo"><label for="xrcOrigem">Serviço de origem</label><input id="xrcOrigem" value="${v("ServicoOrigem")}"></div><div class="campo"><label for="xrcMun">Município</label><input id="xrcMun" value="${v("MunicipioOrigem")}"></div>
      <div class="campo"><label for="xrcEsp">Especialidade</label><input id="xrcEsp" value="${v("Especialidade")}"></div>
      <div class="campo"><label for="xrcData">Chegada prevista</label><input type="date" id="xrcData" value="${isoDia(d)}"></div><div class="campo"><label for="xrcHora">Hora</label><input type="time" id="xrcHora" value="${dd(d.getHours())}:${dd(d.getMinutes())}"></div>
      <div class="campo"><label for="xrcSetor">Setor previsto</label><select id="xrcSetor"><option value=""></option>${SETORES.map((s) => `<option value="${s.codigo}" ${r && r.SetorPrevisto === s.codigo ? "selected" : ""}>${h(s.nome)}</option>`).join("")}</select></div></div>
      <div class="linha-acoes"><button class="btn" data-x="rcSalvar">Salvar</button><button class="btn sec" data-x="rcFechar">Fechar</button><span class="suave">O cateterismo é marcado no cartão do paciente, depois de salvar.</span></div></div>`;
  }

  // ========================================================= PASSAGEM DE PLANTÃO
  let todosPS = false, obsPP = { ps: "", rec: "", cat: "", tr: "", ger: "" };
  const turnoAtual = () => (new Date().getHours() >= 7 && new Date().getHours() < 19 ? "Diurno (07h–19h)" : "Noturno (19h–07h)");
  function secoesPassagem() {
    const lim = Date.now() + 24 * 36e5;
    const psCod = SETORES.filter((s) => s.grupo === "PS").map((s) => s.codigo);
    const ps = estado.internacoes.filter((i) => i.Status === "INTERNADO" && psCod.includes(i.SetorCodigo)).map((i) => ({ i, s: abertas().find((v) => v.NrAtendimento === i.NrAtendimento) })).filter((x) => todosPS || x.s).sort((a, b) => (a.s ? a.s.SolicitadoEm : 9e15) - (b.s ? b.s.SolicitadoEm : 9e15));
    const rec = estado.recepcoes.filter((r) => (r.Status === "PREVISTO" || r.Status === "CHEGOU") && r.PrevistoPara <= lim).sort((a, b) => a.PrevistoPara - b.PrevistoPara);
    const cat = estado.cateterismos.filter((c) => cateAtivo(c) && c.DataHoraExame <= lim).sort((a, b) => a.DataHoraExame - b.DataHoraExame);
    const tr = estado.transportes.filter((t) => ATIVOS_TR.includes(t.Status) && (t.Status === "SAIU" || t.AgendadoPara <= lim)).sort((a, b) => a.AgendadoPara - b.AgendadoPara);
    return {
      ps: ps.map(({ i, s }) => `${i.Leito} · ${i.Paciente}${s ? ` → ${sigla(s.SetorDestino)} · ${STATUS[s.Status]} · ${CONDICOES[s.CondicaoTransporte]} · aguardando há ${NX.minutosTexto((Date.now() - s.SolicitadoEm) / 60000)}` : " · sem solicitação de vaga"}`),
      rec: rec.map((r) => `${dataHoraBR(r.PrevistoPara)} · ${r.Title} · ${SECOES[r.Secao]} · ${r.ServicoOrigem} · ${ST_REC[r.Status]}${r.PrecisaCateterismo ? " · cateterismo " + dataHoraBR(r.DataCateterismo) : ""}`),
      cat: cat.map((c) => `${dataHoraBR(c.DataHoraExame)} · ${c.Title} · ${TIPOS_CATE[c.Tipo][0]}${c.NrAtendimento ? " · atend. " + c.NrAtendimento : c.ServicoOrigem ? " · " + c.ServicoOrigem : ""}`),
      tr: tr.map((t) => `${dataHoraBR(t.AgendadoPara)} · ${t.Title} → ${t.Destino} · ${ST_TR[t.Status]} · checklist ${chkSoma(t)}/9`),
    };
  }
  function telaPassagem() {
    const s = secoesPassagem();
    const pa = estado.passagemAtual;
    const sec = (num, chave, titulo, origem, extra = "") => `<div class="cartao"><div class="topo" style="align-items:center"><div><h2 style="margin:0">${num}. ${titulo} (${s[chave].length})</h2><div class="suave">${origem}</div></div>${extra}</div>
      <div class="passos"><div class="lista">${s[chave].map((l) => `<div class="it" style="font-size:13px">${h(l)}</div>`).join("") || '<div class="suave" style="padding:8px 0">Nada para o próximo plantão nesta seção.</div>'}</div>
      <div class="campo"><label for="pp${chave}">Observações desta seção</label><textarea id="pp${chave}" data-xc="ppObs" data-v="${chave}" rows="5">${h(obsPP[chave])}</textarea></div></div></div>`;
    return `${topo("Passagem de Plantão do NIR")}
    <div class="aviso-proto" style="background:var(--accent-soft);border-color:var(--accent)">Plantão <b>${turnoAtual()}</b> · ${!pa ? "passagem ainda não registrada" : pa.Status === "RASCUNHO" ? `registrada por ${h(pa.PassadoPorNome)} às ${fmtHora(pa.IniciadaEm)}, aguardando quem assume clicar em Recebi` : `concluída: ${h(pa.PassadoPorNome)} → ${h(pa.RecebidoPorNome)} às ${fmtHora(pa.RecebidaEm)}`}<br>Mostra o que acontece nas próximas 24 h. Tudo vem das outras guias; aqui você só acrescenta observações.</div>
    ${sec(1, "ps", "PS com vaga solicitada", "Da Gestão de Vagas: PS Geral, PS Oncologia e Emergência", `<button class="aba" data-x="ppTodos" aria-selected="${todosPS}">${todosPS ? "Mostrando todos do PS" : "Só com vaga solicitada"}</button>`)}
    ${sec(2, "rec", "Previsão de Recepção", "Pacientes aceitos via CROSS previstos para chegar (inclui atrasados)")}
    ${sec(3, "cat", "Cateterismos", "Agenda de cateterismos nas próximas 24 h")}
    ${sec(4, "tr", "Previsão de transporte", "Da guia Ambulâncias, mais quem está fora do hospital e pode voltar")}
    <div class="cartao"><h2>Registro da passagem</h2><div class="campo"><label for="ppger">Observações gerais do plantão</label><textarea id="ppger" data-xc="ppObs" data-v="ger" rows="3">${h(obsPP.ger)}</textarea></div>
      <div class="linha-acoes">${ehNIR() ? `<button class="btn" data-x="ppRegistrar" ${pa && pa.Status === "CONCLUIDA" ? "disabled" : ""}>${pa ? "Atualizar passagem registrada" : "Registrar passagem"}</button>${pa && pa.Status === "RASCUNHO" ? '<button class="btn ok" data-x="ppRecebi">Recebi o plantão</button><span class="suave">(no app, este botão só aparece para quem assume, logado com a própria conta)</span>' : ""}` : ""}</div></div>
    <div class="cartao"><h2>Passagens anteriores</h2><div class="lista">${estado.passagens.slice().sort((a, b) => b.IniciadaEm - a.IniciadaEm).map((p) => `<div class="it"><span>${dataBR(p.IniciadaEm)} · ${p.Turno === "DIURNO" ? "Diurno" : "Noturno"} · ${h(p.PassadoPorNome)}${p.RecebidoPorNome ? " → " + h(p.RecebidoPorNome) + " às " + fmtHora(p.RecebidaEm) : " (não recebida)"}</span><button class="btn sec peq" data-x="ppVer" data-id="${p.ID}">Ver</button></div>`).join("")}</div></div>`;
  }

  // ======================================================================= METAS
  let compMT = isoDia(new Date()).slice(0, 7), metaSel = null;
  const meses = () => Array.from({ length: 12 }, (_, k) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 11 + k); return { comp: isoDia(d).slice(0, 7), rot: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }) }; });
  const fmtN = (v) => (v == null ? "–" : Number.isInteger(v) ? v.toLocaleString("pt-BR") : v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  const serie = (m) => meses().map((x, i) => ({ ...x, i, v: NX.valorMeta(m, x.comp, estado.indicadores, estado.metasValores), meta: (estado.metasValores.find((y) => y.Codigo === m.Codigo && y.Competencia === x.comp) || {}).Meta ?? m.MetaPadrao }));
  function telaMetas() {
    const ms = meses();
    const ok = estado.metasCad.filter((m) => { const s = serie(m).find((x) => x.comp === compMT); return NX.atingiu(s.v, s.meta, m.Sentido); }).length;
    const sel = estado.metasCad.find((m) => m.Codigo === metaSel);
    return `${topo("Metas institucionais")}
    <div class="abas"><label class="suave" for="xmtComp">Mês de referência</label><select id="xmtComp" data-xc="mtComp" style="padding:6px;border:1px solid var(--line);border-radius:8px;background:var(--surface)">${ms.slice().reverse().map((x) => `<option value="${x.comp}" ${x.comp === compMT ? "selected" : ""}>${x.rot}</option>`).join("")}</select><b>${ok} de ${estado.metasCad.length} metas atingidas</b></div>
    <div class="metas">${estado.metasCad.map((m) => { const s = serie(m); const cur = s.find((x) => x.comp === compMT); const ant = s[s.indexOf(cur) - 1]; const at = NX.atingiu(cur.v, cur.meta, m.Sentido); const pts = s.filter((x) => x.v != null); const vals = pts.map((x) => x.v).concat([cur.meta || 0]); const mx = Math.max(1, ...vals) * 1.1, mn = Math.min(0, ...vals); const y = (v) => 64 - (40 * (v - mn)) / (mx - mn);
      return `<button type="button" class="meta ${metaSel === m.Codigo ? "sel" : ""}" data-x="mtSel" data-id="${m.Codigo}"><div class="suave" style="font-weight:600;color:var(--ink)">${h(m.Title)}</div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><span class="mval">${fmtN(cur.v)} <small>${h(m.Unidade)}</small></span><span class="chip st-${at == null ? "mute" : at ? "good" : "crit"}">${at == null ? "sem dado" : at ? "meta atingida" : "fora da meta"}</span></div>
      <div class="suave">meta ${m.Sentido === "MAIOR" ? "≥" : "≤"} ${fmtN(cur.meta)}${ant && ant.v != null && cur.v != null ? ` · mês anterior ${fmtN(ant.v)} ${cur.v > ant.v ? "▲" : cur.v < ant.v ? "▼" : "="}` : ""} · ${m.Fonte === "AUTOMATICA" ? "automática" : "planilha"}</div>
      ${pts.length > 1 ? `<svg viewBox="0 0 280 70" aria-hidden="true">${cur.meta != null ? `<line x1="4" x2="276" y1="${y(cur.meta)}" y2="${y(cur.meta)}" stroke="var(--ink-2)" stroke-dasharray="4 3"/>` : ""}<polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${pts.map((x) => `${4 + x.i * 24.7},${y(x.v)}`).join(" ")}"/><circle cx="${4 + pts[pts.length - 1].i * 24.7}" cy="${y(pts[pts.length - 1].v)}" r="3.5" fill="var(--accent)"/></svg>` : '<div class="suave">histórico insuficiente</div>'}</button>`; }).join("")}</div>
    ${sel ? detalheMeta(sel) : '<div class="cartao suave">Clique em uma meta para ver o detalhe dos últimos 12 meses.</div>'}
    <p class="suave">Metas automáticas são calculadas a partir dos indicadores diários (fluxo F3). Metas de planilha são importadas na Rotina de Atualização, seção b.</p>`;
  }
  function detalheMeta(m) {
    const s = serie(m); const mx = Math.max(1, ...s.map((x) => x.v || 0), ...s.map((x) => x.meta || 0)) * 1.15;
    const comV = s.filter((x) => x.v != null); const ult = comV.slice(-3), antr = comV.slice(-6, -3);
    const med = (a) => (a.length ? a.reduce((p, x) => p + x.v, 0) / a.length : null);
    const tend = comV.length >= 4 && med(antr) != null ? (med(ult) === med(antr) ? "estável" : (med(ult) > med(antr)) === (m.Sentido === "MAIOR") ? "<span class='c-good'>melhorando</span>" : "<span class='c-crit'>piorando</span>") : "poucos meses com dados";
    return `<div class="cartao"><h2>${h(m.Title)} <small>${m.Sentido === "MAIOR" ? "quanto maior, melhor" : "quanto menor, melhor"} · tendência: ${tend}</small></h2>
      <svg viewBox="0 0 1100 260" role="img" aria-label="Últimos 12 meses">${s.map((x) => { const X = 40 + x.i * 88; const ok = NX.atingiu(x.v, x.meta, m.Sentido); return `${x.v != null ? `<rect x="${X + 10}" y="${220 - (190 * x.v) / mx}" width="40" height="${(190 * x.v) / mx}" rx="4" fill="${ok ? "var(--accent)" : "var(--crit)"}"/><text x="${X + 30}" y="${214 - (190 * x.v) / mx}" font-size="12" font-weight="600" text-anchor="middle" fill="var(--ink)">${fmtN(x.v)}</text><rect x="${X}" y="20" width="60" height="200" fill="transparent" data-tip="${x.rot}: ${fmtN(x.v)} (meta ${fmtN(x.meta)})"/>` : ""}${x.meta != null ? `<line x1="${X + 4}" x2="${X + 56}" y1="${220 - (190 * x.meta) / mx}" y2="${220 - (190 * x.meta) / mx}" stroke="var(--ink)" stroke-width="2" stroke-dasharray="5 3"/>` : ""}<text x="${X + 30}" y="240" font-size="11" text-anchor="middle" fill="var(--ink-2)">${x.rot}</text>`; }).join("")}<line x1="40" x2="1090" y1="220" y2="220" stroke="var(--line)"/></svg>
      <div class="legenda"><span><i style="background:var(--accent)"></i>dentro da meta</span><span><i style="background:var(--crit)"></i>fora da meta</span><span>— — meta do mês</span></div></div>`;
  }

  // ---------------------------------------------------- Rotina: metas (seção b)
  let previaMetas = null;
  window.blocoMetasRotina = function () {
    return `<div class="campo" style="margin-top:10px"><label for="xmtTxt">Cole aqui as linhas do modelo de metas (colunas Indicador, Competência, Meta, Realizado)</label><textarea id="xmtTxt" rows="4" placeholder="Indicador&#9;Competência&#9;Meta&#9;Realizado"></textarea></div>
      <div class="linha-acoes"><button class="btn sec peq" data-x="mtExemplo">Gerar modelo de exemplo</button><button class="btn" data-x="mtPrevia">Pré-visualizar metas</button><button class="btn" data-x="mtGravar" ${previaMetas && previaMetas.ok && previaMetas.itens.some((i) => !i.Problema) && perfil === "NIR" ? "" : "disabled"}>Gravar valores</button></div>
      ${previaMetas ? (previaMetas.ok ? `<div class="tabela-wrap" style="margin-top:8px"><table><thead><tr><th>Indicador</th><th>Competência</th><th>Meta</th><th>Realizado</th><th>Situação</th></tr></thead><tbody>${previaMetas.itens.map((i) => `<tr><td>${h(i.Nome || i.Indicador)}</td><td>${i.Competencia || "–"}</td><td class="num">${fmtN(i.Meta)}</td><td class="num">${fmtN(i.Realizado)}</td><td class="${i.Problema ? "c-crit" : "c-good"}">${i.Problema || "ok"}</td></tr>`).join("")}</tbody></table></div>` : `<div class="alerta crit">${h(previaMetas.erro)}</div>`) : ""}`;
  };

  // ------------------------------------------------------- cards da Principal
  window.cardsOutrasGuias = function () {
    const int = estado.internacoes.filter((i) => i.Status === "INTERNADO");
    const perm = int.filter((i) => NX.diasEntre(i.DataInternacao, new Date()) >= 15);
    const ab = estado.topicos.filter((t) => t.Status !== "CONCLUIDO").length;
    const venc = int.filter((i) => i.PrevisaoAlta && difDias(i.PrevisaoAlta) < 0).length;
    const rs = estado.recepcoes.filter((r) => r.Status === "PREVISTO" || r.Status === "CHEGOU");
    const ch = estado.cateterismos.filter((c) => NX.chaveDia(c.DataHoraExame) === NX.chaveDia(new Date()) && c.Status !== "CANCELADO").length;
    const ag = estado.cateterismos.filter((c) => cateAtivo(c) && c.Tipo.startsWith("INTERNADO")).length;
    const t24 = estado.transportes.filter((t) => ATIVOS_TR.includes(t.Status) && t.Status !== "SAIU" && t.AgendadoPara <= Date.now() + 864e5);
    const comp = isoDia(new Date()).slice(0, 7);
    const comDado = estado.metasCad.filter((m) => NX.valorMeta(m, comp, estado.indicadores, estado.metasValores) != null);
    const okM = comDado.filter((m) => { const s = serie(m).find((x) => x.comp === comp); return NX.atingiu(s.v, s.meta, m.Sentido); }).length;
    const card = (id, t, v, s, cls = "") => `<button type="button" class="fase" style="text-align:left;cursor:pointer;background:var(--surface);border-style:solid" data-ir="${id}"><div class="suave">${t}</div><div class="val ${cls}">${v}</div><div class="suave">${s}</div></button>`;
    return card("permanencia", "Permanência ≥ 15 dias", perm.length, `${ab} tópicos em aberto · ${perm.filter((i) => !i.PrevisaoAlta).length} sem previsão`) +
      card("previsoes", "Altas previstas hoje / amanhã", `${int.filter((i) => difDias(i.PrevisaoAlta) === 0).length} / ${int.filter((i) => difDias(i.PrevisaoAlta) === 1).length}`, `${venc} previsão(ões) vencida(s)`, venc ? "c-crit" : "") +
      card("recepcao", "Recepções CROSS hoje / amanhã", `${rs.filter((r) => difDias(r.PrevistoPara) === 0).length} / ${rs.filter((r) => difDias(r.PrevistoPara) === 1).length}`, `${rs.filter((r) => difDias(r.PrevistoPara) < 0 && r.Status === "PREVISTO").length} atrasada(s)`) +
      card("cateterismos", "Cateterismos hoje", ch, `internados aguardando: ${ag}`) +
      card("ambulancias", "Transportes nas próximas 24 h", t24.length, `no radar: ${estado.transportes.filter((t) => t.Status === "SAIU").length} · checklist incompleto: ${t24.filter((t) => chkSoma(t) < 9).length}`) +
      card("metas", "Metas do mês", comDado.length ? `${okM} / ${comDado.length}` : "–", "atingidas entre as metas com dado no mês");
  };

  window.TELAS_EXTRAS = { previsoes: telaPrevisoes, permanencia: telaPermanencia, ambulancias: telaAmbulancias, cateterismos: telaCateterismos, recepcao: telaRecepcao, passagem: telaPassagem, metas: telaMetas };

  // --------------------------------------------------------------------- ações
  const acoes = {
    paAba: (t) => (filtroPA.aba = t.dataset.v),
    paSalvar: (t) => salvarPrevisao(t.dataset.id, q("#pa" + t.dataset.id).value),
    paHist: (t) => { const i = estado.internacoes.find((x) => x.NrAtendimento === t.dataset.id); const hs = estado.previsoesHist.filter((p) => p.NrAtendimento === t.dataset.id).sort((a, b) => b.RegistradoEm - a.RegistradoEm); abrir(`Previsões registradas · ${h(i.Paciente)}`, hs.length ? `<div class="lista">${hs.map((p) => `<div class="it"><div><b>Alta prevista para ${dataBR(p.DataPrevista)}</b>${p.DataAnterior ? ` <span class="suave">(antes: ${dataBR(p.DataAnterior)})</span>` : ""}<div class="suave">${dataHoraBR(p.RegistradoEm)} · ${h(p.RegistradoPorNome)}</div></div></div>`).join("")}</div>` : '<p class="suave">Nenhuma previsão registrada pela equipe neste protótipo. No app, cada registro fica na lista PrevisoesAlta.</p>'); return false; },
    pmSel: (t) => { pacPM = t.dataset.id; },
    pmFlag: (t) => { const a = acompDe(t.dataset.id); a[t.dataset.v] = !a[t.dataset.v]; pacPM = t.dataset.id; if (a[t.dataset.v]) espPM = ESPEC.find((e) => e[1] === t.dataset.v)[0]; },
    pmEsp: (t) => (espPM = t.dataset.v),
    pmPlano: (t) => { const a = acompDe(t.dataset.id); Object.assign(a, { DestinoAltaPrevisto: q("#xpmDest").value, PlanoTerapeutico: q("#xpmPlano").value, Observacao: q("#xpmObs").value }); const v = q("#xpmPrev").value; const i = estado.internacoes.find((x) => x.NrAtendimento === t.dataset.id); if (v && (!i.PrevisaoAlta || isoDia(i.PrevisaoAlta) !== v)) salvarPrevisao(t.dataset.id, v, "Gestão da Permanência"); else toast("Plano do paciente salvo."); },
    pmTopico: () => { const tit = q("#xpmTop").value.trim(); if (!tit) { toast("Descreva a pendência (tópico)."); return false; } const p = estado.internacoes.find((x) => x.NrAtendimento === pacPM); estado.topicos.push({ ID: novoId(), NrAtendimento: pacPM, Paciente: p.Paciente, Especialidade: espPM, Titulo: tit, Status: "PLANEJADO", Responsavel: q("#xpmResp").value, Prazo: q("#xpmPrazo").value ? deInput(q("#xpmPrazo").value, "00:00") : null, CriadoEm: new Date() }); toast("Tópico incluído em Planejado."); },
    pmMove: (t) => { const tp = estado.topicos.find((x) => x.ID === +t.dataset.id); tp.Status = t.dataset.v; tp.ConcluidoEm = t.dataset.v === "CONCLUIDO" ? new Date() : null; },
    amAba: (t) => (abaAM = t.dataset.v),
    amNovo: () => (editAM = "novo"),
    amEditar: (t) => (editAM = +t.dataset.id),
    amFechar: () => (editAM = null),
    amChk: (t) => { const x = estado.transportes.find((y) => y.ID === +t.dataset.id); x[t.dataset.v] = !x[t.dataset.v]; },
    amPasso: (t) => { const x = estado.transportes.find((y) => y.ID === +t.dataset.id); const [rot, novo, campo] = PASSOS_TR[x.Status]; x.Status = novo === "SAIU" && !x.PodeRetornar ? "CONCLUIDO" : novo; x[campo] = new Date(); if (["RETORNOU", "CONCLUIDO"].includes(x.Status)) estado.transportesHist.push(x); toast(`${x.Title}: ${rot.toLowerCase()}.`); },
    amFim: (t) => { const x = estado.transportes.find((y) => y.ID === +t.dataset.id); x.Status = "CONCLUIDO"; estado.transportesHist.push(x); toast(`${x.Title}: transporte encerrado.`); },
    amCancelar: (t) => { const x = estado.transportes.find((y) => y.ID === +t.dataset.id); x.Status = "CANCELADO"; estado.transportesHist.push(x); toast(`${x.Title}: transporte cancelado.`); },
    amSalvar: () => {
      const dest = q("#xamDestino").value.trim(); if (!dest) { toast("Informe o destino."); return false; }
      const campos = { TipoTransporte: q("#xamTipo").value, Motivo: q("#xamMotivo").value, Destino: dest, Empresa: q("#xamEmpresa").value, AgendadoPara: deInput(q("#xamData").value, q("#xamHora").value), PodeRetornar: q("#xamRet").value === "1", Observacao: q("#xamObs").value };
      if (editAM === "novo") { const at = q("#xamPac").value; if (!at) { toast("Escolha o paciente."); return false; } const p = estado.internacoes.find((i) => i.NrAtendimento === at); estado.transportes.push({ ID: novoId(), Title: p.Paciente, NrAtendimento: at, SetorOrigem: p.SetorCodigo, Leito: p.Leito, Status: "AGENDADO", ...Object.fromEntries(CHECK.map(([f]) => [f, false])), ...campos }); }
      else Object.assign(estado.transportes.find((x) => x.ID === editAM), campos);
      editAM = null; toast("Transporte salvo.");
    },
    ctPer: (t) => (periodoCT = t.dataset.v),
    ctDia: (t) => { const v = +t.dataset.v; diaCT = v === 0 ? hoje0() : new Date(diaCT.getTime() + v * 864e5); periodoCT = "DIA"; },
    ctNovo: () => { editCT = "novo"; importCT = null; },
    ctEditar: (t) => { editCT = +t.dataset.id; importCT = null; },
    ctFechar: () => (editCT = null),
    ctImport: () => { importCT = { texto: "", res: null }; editCT = null; },
    ctFecharImp: () => (importCT = null),
    ctExemplo: () => { importCT.texto = exemploPlanilhaCate(); importCT.res = null; },
    ctPrevia: () => { importCT.texto = q("#xctTxt").value; importCT.res = NX.lerAgendaCate(importCT.texto, estado.cateterismos); },
    ctIncluir: () => { const ok = importCT.res.itens.filter((i) => !i.Problema); ok.forEach((i) => estado.cateterismos.push({ ID: novoId(), Title: i.Paciente, DataHoraExame: i.DataHora, Tipo: i.Tipo, NrAtendimento: i.Atendimento, Procedimento: i.Procedimento || "Cateterismo cardíaco", MedicoSolicitante: i.Medico, ServicoOrigem: i.Procedencia, Status: "AGENDADO", Origem: "PLANILHA", Observacao: i.Observacao })); estado.importacoes.push({ TipoGuia: "CATETERISMOS", Status: "PROCESSADO", Linhas: ok.length, ImportadoEm: new Date(), EnviadoPorNome: eu(), Observacao: "Agenda de cateterismos" }); importCT = null; toast(ok.length + " cateterismo(s) incluídos na agenda."); },
    ctRealizado: (t) => { const c = estado.cateterismos.find((x) => x.ID === +t.dataset.id); c.Status = "REALIZADO"; c.DestinoPosExame = q("#ctd" + c.ID).value; toast(c.Title + ": exame realizado."); },
    ctRemarcar: (t) => { const c = estado.cateterismos.find((x) => x.ID === +t.dataset.id); const v = q("#ctr" + c.ID).value; if (!v) return false; const antiga = c.DataHoraExame; c.DataHoraExame = deInput(v, `${dd(antiga.getHours())}:${dd(antiga.getMinutes())}`); c.Status = "REMARCADO"; c.Observacao = "Remarcado de " + dataHoraBR(antiga); const r = estado.recepcoes.find((x) => x.CateterismoId === c.ID); if (r) r.DataCateterismo = c.DataHoraExame; toast(`${c.Title}: remarcado para ${dataHoraBR(c.DataHoraExame)}.`); },
    ctSusp: (t) => { const c = estado.cateterismos.find((x) => x.ID === +t.dataset.id); c.Status = "SUSPENSO"; toast(c.Title + ": exame suspenso."); },
    ctCanc: (t) => { const c = estado.cateterismos.find((x) => x.ID === +t.dataset.id); c.Status = "CANCELADO"; toast(c.Title + ": exame cancelado."); },
    ctVaga: (t) => { const c = estado.cateterismos.find((x) => x.ID === +t.dataset.id); const i = estado.internacoes.find((x) => x.NrAtendimento === c.NrAtendimento); filtroSetor = i.SetorCodigo; pacSel = i.NrAtendimento; abaVagas = "ABERTAS"; irPara("vagas"); return false; },
    ctSalvar: () => {
      const at = q("#xctAt").value.trim(); const i = estado.internacoes.find((x) => x.NrAtendimento === at && x.Status === "INTERNADO");
      const nome = q("#xctPac").value.trim() || (i && i.Paciente); if (!nome) { toast("Informe o paciente (nome ou atendimento de um internado)."); return false; }
      const campos = { Title: nome, NrAtendimento: at, Tipo: q("#xctTipo").value, DataHoraExame: deInput(q("#xctData").value, q("#xctHora").value), ServicoOrigem: q("#xctOrigem").value };
      if (editCT === "novo") estado.cateterismos.push({ ID: novoId(), Procedimento: "Cateterismo cardíaco", MedicoSolicitante: "", Status: "AGENDADO", Origem: "MANUAL", ...campos });
      else Object.assign(estado.cateterismos.find((x) => x.ID === editCT), campos);
      editCT = null; toast("Cateterismo salvo na agenda.");
    },
    rcAba: (t) => (abaRC = t.dataset.v),
    rcNovo: () => (editRC = "novo"),
    rcEditar: (t) => (editRC = +t.dataset.id),
    rcFechar: () => (editRC = null),
    rcCate: (t) => { cateEditRC = cateEditRC === +t.dataset.id ? null : +t.dataset.id; },
    rcAgendar: (t) => {
      const r = estado.recepcoes.find((x) => x.ID === +t.dataset.id); const v = q("#rcd" + r.ID).value; if (!v) { toast("Escolha a data do cateterismo."); return false; }
      const quando = deInput(v, q("#rch" + r.ID).value); const tipo = q("#rct" + r.ID).value;
      let c = estado.cateterismos.find((x) => x.ID === r.CateterismoId);
      if (!c) { c = { ID: novoId(), Title: r.Title, Procedimento: "Cateterismo cardíaco", ServicoOrigem: r.ServicoOrigem, Origem: "RECEPCAO", RecepcaoId: r.ID, NrAtendimento: r.NrAtendimento || "", Observacao: "Incluído pela Previsão de Recepção (CROSS " + r.NrFichaCROSS + ")" }; estado.cateterismos.push(c); }
      Object.assign(c, { DataHoraExame: quando, Tipo: tipo, Status: "AGENDADO" });
      Object.assign(r, { PrecisaCateterismo: true, DataCateterismo: quando, TipoCateterismo: tipo, CateterismoId: c.ID });
      cateEditRC = null; toast(`${r.Title}: cateterismo em ${dataHoraBR(quando)}, já incluído na guia Cateterismos.`);
    },
    rcDesmarcar: (t) => { const r = estado.recepcoes.find((x) => x.ID === +t.dataset.id); const c = estado.cateterismos.find((x) => x.ID === r.CateterismoId); if (c) { c.Status = "CANCELADO"; c.Observacao = "Desmarcado na Previsão de Recepção"; } r.PrecisaCateterismo = false; cateEditRC = null; toast(r.Title + ": cateterismo desmarcado (cancelado na agenda)."); },
    rcDesf: (t) => { const r = estado.recepcoes.find((x) => x.ID === +t.dataset.id); const st = t.dataset.v; r.Status = st; if (st === "CHEGOU") r.ChegadaEm = new Date(); else { r.DesfechoEm = new Date(); estado.recepcoesHist.push(r); } if (["NAO_COMPARECEU", "CANCELADO"].includes(st) && r.PrecisaCateterismo) { const c = estado.cateterismos.find((x) => x.ID === r.CateterismoId); if (c) c.Status = "CANCELADO"; } toast(`${r.Title}: ${ST_REC[st].toLowerCase()}.`); },
    rcInternar: (t) => { const r = estado.recepcoes.find((x) => x.ID === +t.dataset.id); const at = q("#rca" + r.ID).value.trim(); if (!at) { toast("Informe o nº de atendimento do Tasy."); return false; } Object.assign(r, { Status: "INTERNADO", NrAtendimento: at, DesfechoEm: new Date() }); estado.recepcoesHist.push(r); const c = estado.cateterismos.find((x) => x.ID === r.CateterismoId); if (c && r.PrecisaCateterismo) { c.NrAtendimento = at; c.Tipo = c.Tipo === "EXTERNO_URGENCIA_RELATIVA" ? "INTERNADO_URGENCIA" : "INTERNADO_ELETIVO"; } toast(`${r.Title}: internado (atend. ${at})${c ? "; o cateterismo passou para Internado" : ""}.`); },
    rcSalvar: () => {
      const nome = q("#xrcPac").value.trim(); if (!nome) { toast("Informe o nome do paciente."); return false; }
      const campos = { Title: nome, Idade: q("#xrcIdade").value, NrFichaCROSS: q("#xrcFicha").value, Secao: q("#xrcSecao").value, ServicoOrigem: q("#xrcOrigem").value, MunicipioOrigem: q("#xrcMun").value, Especialidade: q("#xrcEsp").value, PrevistoPara: deInput(q("#xrcData").value, q("#xrcHora").value), SetorPrevisto: q("#xrcSetor").value };
      if (editRC === "novo") estado.recepcoes.push({ ID: novoId(), Status: "PREVISTO", PrecisaCateterismo: false, Motivo: "", ...campos }); else Object.assign(estado.recepcoes.find((x) => x.ID === editRC), campos);
      editRC = null; toast("Paciente salvo na Previsão de Recepção.");
    },
    ppTodos: () => (todosPS = !todosPS),
    ppRegistrar: () => {
      const s = secoesPassagem();
      const snap = `PASSAGEM DE PLANTÃO DO NIR · ${turnoAtual()} · ${new Date().toLocaleString("pt-BR")}\nPassado por: ${eu()}\n\n` + [["ps", "1. PS COM VAGA SOLICITADA"], ["rec", "2. PREVISÃO DE RECEPÇÃO"], ["cat", "3. CATETERISMOS"], ["tr", "4. PREVISÃO DE TRANSPORTE"]].map(([k, t]) => `${t} (${s[k].length})\n${s[k].map((l) => "- " + l).join("\n")}\nObs.: ${obsPP[k]}`).join("\n\n") + `\n\nOBSERVAÇÕES GERAIS: ${obsPP.ger}`;
      estado.passagemAtual = { ID: novoId(), Turno: new Date().getHours() >= 7 && new Date().getHours() < 19 ? "DIURNO" : "NOTURNO", IniciadaEm: new Date(), PassadoPorNome: eu(), Status: "RASCUNHO", Snapshot: snap };
      toast("Passagem registrada. Quem assume deve clicar em Recebi o plantão.");
    },
    ppRecebi: () => { Object.assign(estado.passagemAtual, { Status: "CONCLUIDA", RecebidoPorNome: "Enf. NIR B (quem assume)", RecebidaEm: new Date() }); estado.passagens.push(estado.passagemAtual); toast("Plantão recebido."); },
    ppVer: (t) => { const p = estado.passagens.find((x) => x.ID === +t.dataset.id); abrir("Passagem de " + dataHoraBR(p.IniciadaEm), `<pre style="white-space:pre-wrap;font:12.5px/1.5 var(--font-ui);max-height:60vh;overflow:auto">${h(p.Snapshot)}</pre>`); return false; },
    mtSel: (t) => (metaSel = metaSel === t.dataset.id ? null : t.dataset.id),
    mtExemplo: () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); const comp = isoDia(d).slice(0, 7); q("#xmtTxt").value = ["Modelo de metas (exemplo)", "Indicador\tCompetência\tMeta\tRealizado", `GIRO_LEITO\t${comp}\t4\t4,3`, `Altas até as 12h\t${comp}\t40\t37`, `MEDIA_PERMANENCIA\t${comp.slice(5)}/${comp.slice(0, 4)}\t6\t5,8`, `INDICADOR_INEXISTENTE\t${comp}\t1\t1`].join("\r\n"); return false; },
    mtPrevia: () => { previaMetas = NX.lerMetas(q("#xmtTxt").value, estado.metasCad); },
    mtGravar: () => { const ok = previaMetas.itens.filter((i) => !i.Problema); ok.forEach((i) => { const ex = estado.metasValores.find((v) => v.Codigo === i.Codigo && v.Competencia === i.Competencia); if (ex) Object.assign(ex, { Meta: i.Meta, Realizado: i.Realizado }); else estado.metasValores.push({ Codigo: i.Codigo, Competencia: i.Competencia, Meta: i.Meta, Realizado: i.Realizado }); }); estado.importacoes.push({ TipoGuia: "METAS", Status: "PROCESSADO", Linhas: ok.length, ImportadoEm: new Date(), EnviadoPorNome: eu(), Observacao: "Valores de metas" }); previaMetas = null; toast(ok.length + " valor(es) de metas gravados."); },
  };
  const valoresTexto = {
    paSetor: (t) => (filtroPA.setor = t.value),
    pmSetor: (t) => (filtroPM.setor = t.value),
    pmBusca: (t) => (filtroPM.busca = t.value),
    ctTipo: (t) => (filtroCT.tipo = t.value),
    ctStatus: (t) => (filtroCT.status = t.value),
    mtComp: (t) => (compMT = t.value),
    ppObs: (t) => { obsPP[t.dataset.v] = t.value; return false; },
  };

  // janela genérica
  function abrir(titulo, corpo) {
    let d = q("#dlgExtra");
    if (!d) { d = document.createElement("dialog"); d.id = "dlgExtra"; document.body.appendChild(d); d.addEventListener("click", (e) => { if (e.target.dataset.fechar !== undefined) d.close(); }); }
    d.innerHTML = `<h2 style="margin:0 0 10px;font-size:16px">${titulo}</h2>${corpo}<div class="linha-acoes"><button class="btn sec" data-fechar>Fechar</button></div>`;
    d.showModal();
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-x]");
    if (!t || t.disabled) return;
    const fn = acoes[t.dataset.x];
    if (fn && fn(t) !== false) render();
  });
  document.addEventListener("change", (e) => {
    const t = e.target.closest("[data-xc]");
    if (!t) return;
    const fn = valoresTexto[t.dataset.xc];
    if (fn && fn(t) !== false) render();
  });
})();
