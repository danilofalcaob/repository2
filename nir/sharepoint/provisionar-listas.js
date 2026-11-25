/*
 * NIR · Command Center — criação das listas do SharePoint
 * ------------------------------------------------------------------
 * O que faz: cria (ou completa) as 18 listas do projeto com todas as colunas
 * e índices, cadastra os 14 setores e coloca você como perfil "NIR".
 *
 * Como usar (detalhes em nir/docs/01-modelo-de-dados.md):
 *   1. Abra a página inicial do site do SharePoint do NIR no navegador
 *      (ex.: https://SEUTENANT.sharepoint.com/sites/NIR).
 *   2. Pressione F12 e abra a aba "Console".
 *   3. Cole este arquivo inteiro e pressione Enter.
 *   4. Acompanhe as mensagens [NIR]. Ao final aparece "Concluído".
 *
 * Pode rodar quantas vezes quiser: o que já existe é mantido e só o que
 * falta é criado. Nada é apagado.
 *
 * Usa apenas a SUA permissão no site (você precisa ser proprietário do
 * site). Não envia nada para fora do SharePoint do hospital.
 */
(async function provisionarNIR() {
  "use strict";

  // ---------------------------------------------------------------------
  // Definição das listas (mesma especificação de docs/01-modelo-de-dados.md)
  // Tipos: Text | Note | Number | DateTime | Date | Boolean
  // Opções: idx (indexar), unico (valores únicos), padrao (Boolean: "1"/"0")
  // ---------------------------------------------------------------------
  const LISTAS = [
    {
      titulo: "Setores",
      descricao: "NIR · Cadastro dos setores de internação, leitos operacionais e SLA de vaga.",
      campos: [
        ["Codigo", "Text", { idx: true, unico: true }],
        ["Sigla", "Text"],
        ["Grupo", "Text", { idx: true }],
        ["Andar", "Number"],
        ["Posto", "Text"],
        ["NomeTasy", "Text"],
        ["LeitosOperacionais", "Number"],
        ["SLAMinutos", "Number"],
        ["ExigeNaRotina", "Boolean", { padrao: "1" }],
        ["RecebeSolicitacao", "Boolean", { padrao: "1" }],
        ["Ordem", "Number"],
        ["Ativo", "Boolean", { padrao: "1" }],
      ],
    },
    {
      titulo: "Importacoes",
      descricao: "NIR · Log da Rotina de Atualização (cada arquivo/censo importado, com o anexo original).",
      campos: [
        ["ChaveData", "Text", { idx: true }],
        ["DataRef", "Date"],
        ["Janela", "Text"],
        ["JanelaChave", "Text", { idx: true }],
        ["TipoGuia", "Text", { idx: true }],
        ["SetorCodigo", "Text", { idx: true }],
        ["Linhas", "Number"],
        ["Novos", "Number"],
        ["Transferidos", "Number"],
        ["TrocasLeito", "Number"],
        ["Retornos", "Number"],
        ["Saidas", "Number"],
        ["Ignoradas", "Number"],
        ["Status", "Text"],
        ["EnviadoPorEmail", "Text"],
        ["EnviadoPorNome", "Text"],
        ["ImportadoEm", "DateTime", { idx: true }],
        ["Observacao", "Note"],
      ],
    },
    {
      titulo: "Internacoes",
      descricao: "NIR · Estado atual de cada internação (Title = nº de atendimento do Tasy).",
      tituloIdx: true,
      tituloUnico: true,
      campos: [
        ["Prontuario", "Text", { idx: true }],
        ["Paciente", "Text"],
        ["Idade", "Text"],
        ["Sexo", "Text"],
        ["SetorCodigo", "Text", { idx: true }],
        ["Leito", "Text"],
        ["DataInternacao", "DateTime"],
        ["Medico", "Text"],
        ["Especialidade", "Text"],
        ["Convenio", "Text"],
        ["Diagnostico", "Note"],
        ["Status", "Text", { idx: true }],
        ["PrimeiraVezVistoEm", "DateTime"],
        ["UltimaVezVistoEm", "DateTime"],
        ["UltimaJanelaChave", "Text"],
        ["SaidaDetectadaEm", "DateTime", { idx: true }],
        ["SaidaConfirmadaEm", "DateTime"],
        ["PrevisaoAlta", "Date"],
        ["PrevisaoAltaOrigem", "Text"],
        ["PrevisaoAltaEm", "DateTime"],
        ["PrevisaoAltaPor", "Text"],
        ["Observacao", "Note"],
      ],
    },
    {
      titulo: "Movimentacoes",
      descricao: "NIR · Histórico de mudanças detectadas na rotina (admissões, transferências, saídas).",
      tituloIdx: true,
      campos: [
        ["Paciente", "Text"],
        ["SetorDe", "Text"],
        ["LeitoDe", "Text"],
        ["SetorPara", "Text"],
        ["LeitoPara", "Text"],
        ["Tipo", "Text", { idx: true }],
        ["DetectadoEm", "DateTime", { idx: true }],
        ["JanelaChave", "Text"],
        ["PorEmail", "Text"],
      ],
    },
    {
      titulo: "CensoResumo",
      descricao: "NIR · Resumo por setor e janela (base das tendências de ocupação e permanência).",
      tituloIdx: true,
      campos: [
        ["ChaveData", "Text", { idx: true }],
        ["DataRef", "Date", { idx: true }],
        ["Janela", "Text"],
        ["SetorCodigo", "Text", { idx: true }],
        ["Pacientes", "Number"],
        ["Leitos", "Number"],
        ["OcupacaoPct", "Number"],
        ["Perm15d", "Number"],
        ["PermMediaDias", "Number"],
        ["ImportadoEm", "DateTime"],
      ],
    },
    {
      titulo: "SolicitacoesVaga",
      descricao: "NIR · Solicitações de vaga/leito com tempos, condição de transporte e SLA.",
      tituloIdx: true,
      versionamento: true,
      campos: [
        ["Paciente", "Text"],
        ["SetorOrigem", "Text", { idx: true }],
        ["LeitoOrigem", "Text"],
        ["SetorDestino", "Text", { idx: true }],
        ["CondicaoTransporte", "Text"],
        ["Status", "Text", { idx: true }],
        ["SolicitadoEm", "DateTime", { idx: true }],
        ["SolicitadoPorEmail", "Text", { idx: true }],
        ["SolicitadoPorNome", "Text"],
        ["EmAnaliseEm", "DateTime"],
        ["LeitoCedidoEm", "DateTime", { idx: true }],
        ["LeitoCedido", "Text"],
        ["ConcluidoEm", "DateTime"],
        ["CanceladoEm", "DateTime"],
        ["MotivoCancelamento", "Text"],
        ["SLAMinutos", "Number"],
        ["MinutosAteCessao", "Number"],
        ["DentroSLA", "Text"],
        ["AlertaNivel", "Number"],
        ["Observacao", "Note"],
        ["AtualizadoPorEmail", "Text"],
      ],
    },
    {
      titulo: "EventosVaga",
      descricao: "NIR · Log de cada ação nas solicitações de vaga (só inclusão, nunca alteração).",
      campos: [
        ["SolicitacaoId", "Number", { idx: true }],
        ["NrAtendimento", "Text"],
        ["ValorDe", "Text"],
        ["ValorPara", "Text"],
        ["Em", "DateTime", { idx: true }],
        ["PorEmail", "Text"],
        ["PorNome", "Text"],
        ["Observacao", "Note"],
      ],
    },
    {
      titulo: "IndicadoresDiarios",
      descricao: "NIR · Indicadores consolidados por dia (gravados pelo fluxo de fechamento diário).",
      tituloIdx: true,
      campos: [
        ["ChaveData", "Text", { idx: true }],
        ["DataRef", "Date", { idx: true }],
        ["Indicador", "Text", { idx: true }],
        ["SetorCodigo", "Text"],
        ["Valor", "Number"],
      ],
    },
    {
      titulo: "PerfisUsuarios",
      descricao: "NIR · Perfil de acesso de cada usuário no aplicativo (e-mail sempre em minúsculas).",
      campos: [
        ["Email", "Text", { idx: true, unico: true }],
        ["Perfil", "Text"],
        ["Especialidade", "Text"],
        ["SetorCodigo", "Text"],
        ["Ativo", "Boolean", { padrao: "1" }],
      ],
    },

    // ------------------------- guias das fases seguintes -------------------------
    {
      titulo: "PrevisoesAlta",
      descricao: "NIR · Histórico de cada previsão de alta registrada (Title = nº de atendimento).",
      tituloIdx: true,
      campos: [
        ["Paciente", "Text"],
        ["SetorCodigo", "Text"],
        ["DataPrevista", "Date"],
        ["DataAnterior", "Date"],
        ["Motivo", "Text"],
        ["RegistradoEm", "DateTime", { idx: true }],
        ["RegistradoPorEmail", "Text"],
        ["RegistradoPorNome", "Text"],
      ],
    },
    {
      titulo: "PermanenciaAcompanhamento",
      descricao: "NIR · Gestão da Permanência: pendências por especialidade e plano de cada paciente com 15 dias ou mais (Title = nº de atendimento).",
      tituloIdx: true,
      tituloUnico: true,
      campos: [
        ["Paciente", "Text"],
        ["SetorCodigo", "Text"],
        ["PendMedico", "Boolean"],
        ["PendEnfermagem", "Boolean"],
        ["PendServicoSocial", "Boolean"],
        ["PendFisioterapia", "Boolean"],
        ["DestinoAltaPrevisto", "Text"],
        ["PlanoTerapeutico", "Note"],
        ["Observacao", "Note"],
        ["UltimaRevisaoEm", "DateTime"],
        ["UltimaRevisaoPor", "Text"],
      ],
    },
    {
      titulo: "PermanenciaTopicos",
      descricao: "NIR · Kanban da Gestão da Permanência: um tópico por pendência (Planejado, Em andamento, Concluído).",
      campos: [
        ["NrAtendimento", "Text", { idx: true }],
        ["Paciente", "Text"],
        ["Especialidade", "Text", { idx: true }],
        ["Status", "Text", { idx: true }],
        ["Responsavel", "Text"],
        ["Prazo", "Date"],
        ["Descricao", "Note"],
        ["CriadoEm", "DateTime"],
        ["CriadoPorNome", "Text"],
        ["IniciadoEm", "DateTime"],
        ["ConcluidoEm", "DateTime", { idx: true }],
        ["AtualizadoPorNome", "Text"],
      ],
    },
    {
      titulo: "Transportes",
      descricao: "NIR · Ambulâncias: transportes agendados, tempos de cada etapa, checklist e radar de quem pode retornar.",
      versionamento: true,
      campos: [
        ["NrAtendimento", "Text", { idx: true }],
        ["SetorOrigem", "Text"],
        ["Leito", "Text"],
        ["TipoTransporte", "Text"],
        ["Motivo", "Text"],
        ["Destino", "Text"],
        ["Empresa", "Text"],
        ["AgendadoPara", "DateTime", { idx: true }],
        ["Status", "Text", { idx: true }],
        ["PodeRetornar", "Boolean"],
        ["SolicitadoEm", "DateTime"],
        ["ConfirmadoEm", "DateTime"],
        ["ChegadaAmbulanciaEm", "DateTime"],
        ["SaidaPacienteEm", "DateTime", { idx: true }],
        ["RetornoPrevisto", "DateTime"],
        ["RetornouEm", "DateTime"],
        ["ChkAutorizacao", "Boolean"],
        ["ChkRelatorio", "Boolean"],
        ["ChkExames", "Boolean"],
        ["ChkContatoDestino", "Boolean"],
        ["ChkAgendaConfirmada", "Boolean"],
        ["ChkAcompanhante", "Boolean"],
        ["ChkEquipamentos", "Boolean"],
        ["ChkDocumentos", "Boolean"],
        ["ChkFamilia", "Boolean"],
        ["Observacao", "Note"],
        ["AtualizadoPorNome", "Text"],
      ],
    },
    {
      titulo: "Cateterismos",
      descricao: "NIR · Agenda de cateterismos cardíacos (Title = paciente).",
      versionamento: true,
      campos: [
        ["NrAtendimento", "Text", { idx: true }],
        ["Prontuario", "Text"],
        ["Idade", "Text"],
        ["DataHoraExame", "DateTime", { idx: true }],
        ["ChaveData", "Text", { idx: true }],
        ["Tipo", "Text", { idx: true }],
        ["Procedimento", "Text"],
        ["MedicoSolicitante", "Text"],
        ["Convenio", "Text"],
        ["ServicoOrigem", "Text"],
        ["Status", "Text", { idx: true }],
        ["DestinoPosExame", "Text"],
        ["Origem", "Text"],
        ["RecepcaoId", "Number", { idx: true }],
        ["Observacao", "Note"],
        ["AtualizadoPorNome", "Text"],
      ],
    },
    {
      titulo: "Recepcoes",
      descricao: "NIR · Previsão de Recepção: casos aceitos via CROSS que devem chegar nos próximos dias (Title = paciente).",
      versionamento: true,
      campos: [
        ["Idade", "Text"],
        ["Sexo", "Text"],
        ["CNS", "Text"],
        ["NrFichaCROSS", "Text", { idx: true }],
        ["Secao", "Text", { idx: true }],
        ["ServicoOrigem", "Text"],
        ["MunicipioOrigem", "Text"],
        ["Especialidade", "Text"],
        ["Motivo", "Note"],
        ["PrevistoPara", "DateTime", { idx: true }],
        ["SetorPrevisto", "Text"],
        ["PrecisaCateterismo", "Boolean"],
        ["DataCateterismo", "DateTime"],
        ["TipoCateterismo", "Text"],
        ["CateterismoId", "Number"],
        ["Status", "Text", { idx: true }],
        ["ChegadaEm", "DateTime"],
        ["DesfechoEm", "DateTime", { idx: true }],
        ["NrAtendimento", "Text"],
        ["Observacao", "Note"],
        ["RegistradoPorNome", "Text"],
        ["AtualizadoPorNome", "Text"],
      ],
    },
    {
      titulo: "PassagensPlantao",
      descricao: "NIR · Registro de cada passagem de plantão do NIR, com cópia congelada do que foi passado.",
      tituloIdx: true,
      campos: [
        ["ChaveData", "Text", { idx: true }],
        ["Turno", "Text"],
        ["Status", "Text"],
        ["PassadoPorEmail", "Text"],
        ["PassadoPorNome", "Text"],
        ["RecebidoPorEmail", "Text"],
        ["RecebidoPorNome", "Text"],
        ["IniciadaEm", "DateTime", { idx: true }],
        ["RecebidaEm", "DateTime"],
        ["ObsPS", "Note"],
        ["ObsRecepcao", "Note"],
        ["ObsCateterismo", "Note"],
        ["ObsTransporte", "Note"],
        ["ObsGerais", "Note"],
        ["Snapshot", "Note"],
      ],
    },
    {
      titulo: "MetasIndicadores",
      descricao: "NIR · Cadastro das metas institucionais acompanhadas na guia Metas.",
      campos: [
        ["Codigo", "Text", { idx: true, unico: true }],
        ["Unidade", "Text"],
        ["Sentido", "Text"],
        ["MetaPadrao", "Number"],
        ["Fonte", "Text"],
        ["IndicadorDiario", "Text"],
        ["Agregacao", "Text"],
        ["Descricao", "Note"],
        ["Ordem", "Number"],
        ["Ativo", "Boolean", { padrao: "1" }],
      ],
    },
    {
      titulo: "MetasValores",
      descricao: "NIR · Valores mensais das metas que vêm de planilha (Title = código|AAAA-MM).",
      tituloIdx: true,
      campos: [
        ["Codigo", "Text", { idx: true }],
        ["Competencia", "Text", { idx: true }],
        ["Meta", "Number"],
        ["Realizado", "Number"],
        ["Fonte", "Text"],
        ["AtualizadoEm", "DateTime"],
        ["AtualizadoPorNome", "Text"],
      ],
    },
  ];

  // SLA provisório (minutos) até a pactuação por setor — ajuste na lista Setores.
  const SLA_PROVISORIO = 120;
  const SETORES = [
    ["PS_GERAL", "PS Geral", "PS-G", "PS", null, ""],
    ["PS_ONCO", "PS Oncologia", "PS-O", "PS", null, ""],
    ["EMERGENCIA", "Emergência", "EMERG", "PS", null, ""],
    ["UTI", "UTI", "UTI", "UTI", null, ""],
    ["UI4_P1", "UI 4º andar – Posto 1", "UI4-P1", "UI", 4, "Posto 1"],
    ["UI4_SM", "UI 4º andar – Saúde Mental", "UI4-SM", "UI", 4, "Saúde Mental"],
    ["UI6_P1", "UI 6º andar – Posto 1", "UI6-P1", "UI", 6, "Posto 1"],
    ["UI6_P2", "UI 6º andar – Posto 2", "UI6-P2", "UI", 6, "Posto 2"],
    ["UI6_P3", "UI 6º andar – Posto 3", "UI6-P3", "UI", 6, "Posto 3"],
    ["UI6_P4", "UI 6º andar – Posto 4", "UI6-P4", "UI", 6, "Posto 4"],
    ["UI7_P1", "UI 7º andar – Posto 1", "UI7-P1", "UI", 7, "Posto 1"],
    ["UI7_P2", "UI 7º andar – Posto 2", "UI7-P2", "UI", 7, "Posto 2"],
    ["UI7_P3", "UI 7º andar – Posto 3", "UI7-P3", "UI", 7, "Posto 3"],
    ["UI7_P4", "UI 7º andar – Posto 4", "UI7-P4", "UI", 7, "Posto 4"],
  ];

  // ---------------------------------------------------------------------
  // Infraestrutura
  // ---------------------------------------------------------------------
  const SITE = (function () {
    if (window._spPageContextInfo && window._spPageContextInfo.webAbsoluteUrl) {
      return window._spPageContextInfo.webAbsoluteUrl;
    }
    const m = location.pathname.match(/^\/(sites|teams)\/[^/]+/i);
    return location.origin + (m ? m[0] : "");
  })();

  const log = (...a) => console.log("%c[NIR]", "color:#0B4F8A;font-weight:bold", ...a);
  const aviso = (...a) => console.warn("[NIR]", ...a);
  const esc = (s) => String(s).replace(/'/g, "''");

  let digest = "";
  async function renovarDigest() {
    const r = await fetch(SITE + "/_api/contextinfo", {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json;odata=nometadata" },
    });
    if (!r.ok) {
      throw new Error(
        "Não consegui falar com o SharePoint em " + SITE + " (HTTP " + r.status + "). " +
          "Abra a página inicial do site do NIR e rode o script de novo."
      );
    }
    digest = (await r.json()).FormDigestValue;
  }

  async function sp(metodo, caminho, corpo, extras) {
    const headers = Object.assign(
      {
        Accept: "application/json;odata=nometadata",
        "Content-Type": "application/json;odata=verbose",
        "X-RequestDigest": digest,
      },
      extras || {}
    );
    const r = await fetch(SITE + caminho, {
      method: metodo,
      credentials: "include",
      headers,
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    if (r.status === 404) return null;
    if (!r.ok) {
      const t = await r.text();
      throw new Error(metodo + " " + caminho + " → HTTP " + r.status + ": " + t.slice(0, 500));
    }
    const txt = await r.text();
    return txt ? JSON.parse(txt) : {};
  }

  const merge = (caminho, corpo) =>
    sp("POST", caminho, corpo, { "X-HTTP-Method": "MERGE", "IF-MATCH": "*" });
  const lista = (t) => "/_api/web/lists/getbytitle('" + esc(t) + "')";

  function xmlCampo(nome, tipo, o) {
    const base = 'Name="' + nome + '" StaticName="' + nome + '" DisplayName="' + nome + '"';
    switch (tipo) {
      case "Text":
        return '<Field Type="Text" ' + base + ' MaxLength="255" />';
      case "Note":
        return '<Field Type="Note" ' + base + ' NumLines="6" RichText="FALSE" />';
      case "Number":
        return '<Field Type="Number" ' + base + " />";
      case "DateTime":
        return '<Field Type="DateTime" ' + base + ' Format="DateTime" />';
      case "Date":
        return '<Field Type="DateTime" ' + base + ' Format="DateOnly" />';
      case "Boolean":
        return '<Field Type="Boolean" ' + base + "><Default>" + ((o && o.padrao) || "0") + "</Default></Field>";
      default:
        throw new Error("Tipo de coluna desconhecido: " + tipo);
    }
  }

  async function garantirIndice(titulo, campo, unico) {
    const caminho = lista(titulo) + "/fields/getbyinternalnameortitle('" + campo + "')";
    const atual = await sp("GET", caminho + "?$select=Indexed,EnforceUniqueValues");
    if (atual && !atual.Indexed) {
      await merge(caminho, { __metadata: { type: "SP.Field" }, Indexed: true });
    }
    if (unico && atual && !atual.EnforceUniqueValues) {
      await merge(caminho, { __metadata: { type: "SP.Field" }, EnforceUniqueValues: true });
    }
  }

  async function garantirLista(def) {
    let l = await sp("GET", lista(def.titulo) + "?$select=Id,Title,EnableVersioning");
    if (!l) {
      await sp("POST", "/_api/web/lists", {
        __metadata: { type: "SP.List" },
        AllowContentTypes: true,
        BaseTemplate: 100,
        ContentTypesEnabled: false,
        Description: def.descricao,
        Title: def.titulo,
      });
      log("Lista criada:", def.titulo);
      l = await sp("GET", lista(def.titulo) + "?$select=Id,Title,EnableVersioning");
    } else {
      log("Lista já existe:", def.titulo, "(completando o que faltar)");
    }

    if (def.versionamento && !l.EnableVersioning) {
      await merge(lista(def.titulo), { __metadata: { type: "SP.List" }, EnableVersioning: true });
      log("  versionamento ativado");
    }

    const existentes = await sp("GET", lista(def.titulo) + "/fields?$select=InternalName&$top=500");
    const nomes = new Set(((existentes && existentes.value) || []).map((f) => f.InternalName));

    for (const [nome, tipo, opcoes] of def.campos) {
      const o = opcoes || {};
      if (!nomes.has(nome)) {
        await sp("POST", lista(def.titulo) + "/fields/createfieldasxml", {
          parameters: {
            __metadata: { type: "SP.XmlSchemaFieldCreationInformation" },
            SchemaXml: xmlCampo(nome, tipo, o),
            Options: 24, // AddFieldInternalNameHint (8) + AddFieldToDefaultView (16)
          },
        });
        log("  coluna criada:", nome, "(" + tipo + ")");
      }
      if (o.idx || o.unico) await garantirIndice(def.titulo, nome, !!o.unico);
    }

    if (def.tituloIdx || def.tituloUnico) await garantirIndice(def.titulo, "Title", !!def.tituloUnico);
  }

  async function tipoItem(titulo) {
    const l = await sp("GET", lista(titulo) + "?$select=ListItemEntityTypeFullName");
    return l.ListItemEntityTypeFullName;
  }

  async function cadastrarSetores() {
    const existentes = await sp("GET", lista("Setores") + "/items?$select=Codigo&$top=500");
    const codigos = new Set(((existentes && existentes.value) || []).map((i) => i.Codigo));
    const tipo = await tipoItem("Setores");
    let ordem = 0;
    let criados = 0;
    for (const [codigo, nome, sigla, grupo, andar, posto] of SETORES) {
      ordem += 1;
      if (codigos.has(codigo)) continue;
      await sp("POST", lista("Setores") + "/items", {
        __metadata: { type: tipo },
        Title: nome,
        Codigo: codigo,
        Sigla: sigla,
        Grupo: grupo,
        Andar: andar,
        Posto: posto,
        NomeTasy: "",
        LeitosOperacionais: 0,
        SLAMinutos: SLA_PROVISORIO,
        ExigeNaRotina: true,
        RecebeSolicitacao: true,
        Ordem: ordem,
        Ativo: true,
      });
      criados += 1;
    }
    log("Setores: " + criados + " cadastrado(s), " + (SETORES.length - criados) + " já existiam.");
  }

  // Metas iniciais (EXEMPLOS: ajuste nomes, metas e fontes na lista MetasIndicadores).
  // Fonte AUTOMATICA = calculada pelo app a partir de IndicadoresDiarios (fluxo F3).
  // Fonte PLANILHA = valores importados na Rotina de Atualização, seção b.
  const METAS = [
    ["TEMPO_CESSAO", "Tempo médio até a cessão do leito", "min", "MENOR", 120, "AUTOMATICA", "TEMPO_MEDIO_CESSAO_MIN", "MEDIA"],
    ["CESSAO_NO_SLA", "Cessões de leito dentro do SLA", "%", "MAIOR", 80, "AUTOMATICA", "PCT_CESSAO_NO_SLA", "MEDIA"],
    ["OCUPACAO", "Taxa de ocupação (censo das 23h)", "%", "MAIOR", 85, "AUTOMATICA", "OCUPACAO_PCT", "MEDIA"],
    ["PERMANENCIA_15D", "Pacientes com 15 dias ou mais (média diária)", "pac.", "MENOR", 20, "AUTOMATICA", "PERMANENCIA_15D", "MEDIA"],
    ["VAGAS_CANCELADAS", "Solicitações de vaga canceladas no mês", "n", "MENOR", 30, "AUTOMATICA", "VAGAS_CANCELADAS", "SOMA"],
    ["MEDIA_PERMANENCIA", "Média de permanência hospitalar", "dias", "MENOR", 6, "PLANILHA", "", ""],
    ["GIRO_LEITO", "Giro de leito", "pac./leito", "MAIOR", 4, "PLANILHA", "", ""],
    ["ALTAS_ATE_12H", "Altas até as 12h", "%", "MAIOR", 40, "PLANILHA", "", ""],
  ];

  async function cadastrarMetas() {
    const existentes = await sp("GET", lista("MetasIndicadores") + "/items?$select=Codigo&$top=500");
    const codigos = new Set(((existentes && existentes.value) || []).map((i) => i.Codigo));
    const tipo = await tipoItem("MetasIndicadores");
    let criados = 0;
    let ordem = 0;
    for (const [codigo, nome, unidade, sentido, meta, fonte, indicador, agregacao] of METAS) {
      ordem += 1;
      if (codigos.has(codigo)) continue;
      await sp("POST", lista("MetasIndicadores") + "/items", {
        __metadata: { type: tipo },
        Title: nome, Codigo: codigo, Unidade: unidade, Sentido: sentido, MetaPadrao: meta,
        Fonte: fonte, IndicadorDiario: indicador, Agregacao: agregacao,
        Descricao: "Exemplo inicial: ajuste a meta e a descrição.", Ordem: ordem, Ativo: true,
      });
      criados += 1;
    }
    log("Metas: " + criados + " cadastrada(s), " + (METAS.length - criados) + " já existiam.");
  }

  async function cadastrarMeuPerfil() {
    const eu = await sp("GET", "/_api/web/currentuser?$select=Email,Title");
    const email = String((eu && eu.Email) || "").toLowerCase();
    if (!email) {
      aviso("Não consegui ler o seu e-mail. Cadastre-se manualmente na lista PerfisUsuarios (Perfil = NIR).");
      return;
    }
    const ja = await sp(
      "GET",
      lista("PerfisUsuarios") + "/items?$select=Id&$filter=Email eq '" + esc(email) + "'"
    );
    if (ja && ja.value && ja.value.length) {
      log("Perfil de " + email + " já existe.");
      return;
    }
    await sp("POST", lista("PerfisUsuarios") + "/items", {
      __metadata: { type: await tipoItem("PerfisUsuarios") },
      Title: eu.Title || email,
      Email: email,
      Perfil: "NIR",
      Especialidade: "",
      SetorCodigo: "",
      Ativo: true,
    });
    log("Você foi cadastrado(a) como perfil NIR:", email);
  }

  async function conferirFusoHorario() {
    try {
      const tz = await sp("GET", "/_api/web/RegionalSettings/TimeZone?$select=Description");
      const d = (tz && tz.Description) || "";
      if (!/bras[ií]lia/i.test(d)) {
        aviso(
          "O fuso horário do site está como \"" + d + "\". Ajuste para (UTC-03:00) Brasília em " +
            "Configurações do site > Configurações regionais (veja docs/00-verificacao-ambiente.md)."
        );
      } else {
        log("Fuso horário do site OK:", d);
      }
    } catch (e) {
      aviso("Não consegui conferir o fuso horário do site:", e.message);
    }
  }

  // ---------------------------------------------------------------------
  // Execução
  // ---------------------------------------------------------------------
  try {
    log("Site:", SITE);
    await renovarDigest();
    for (const def of LISTAS) {
      await garantirLista(def);
      await renovarDigest(); // o token expira; renovar entre listas evita erro 403
    }
    await cadastrarSetores();
    await cadastrarMetas();
    await cadastrarMeuPerfil();
    await conferirFusoHorario();
    log("Concluído. Próximo passo: preencher LeitosOperacionais, NomeTasy e SLAMinutos na lista Setores.");
    log("Endereço do site para o Power Apps:", SITE);
  } catch (e) {
    console.error("[NIR] Erro:", e);
    console.error(
      "[NIR] Nada foi apagado. Corrija o problema indicado acima e rode o script de novo — " +
        "ele continua de onde parou."
    );
  }
})();
