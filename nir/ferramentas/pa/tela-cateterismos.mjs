// Guia: Cateterismos (sufixo CT)
import * as B from "./base.mjs";
const { lbl, titulo, botao, botaoSec, retangulo, dropdown, entrada, galeria, html, c, T, pos, SIGLA, CARD, alternador, datepicker, rotulo, telaManual, janela, DATA_HORA, comTodos } = B;

const CARREGA = `ClearCollect(colCate, Filter(Cateterismos, DataHoraExame >= DateAdd(Today(), -30, TimeUnit.Days)))`;

const ATUALIZA = `
Refresh(Cateterismos);
Refresh(Internacoes);
ClearCollect(colInternados, Filter(Internacoes, Status = "INTERNADO"));
${CARREGA};
Set(varUltimaAtualizacao, Now())`;

const ATIVO = `(Status = "AGENDADO" || Status = "REMARCADO")`;

const HTML_KPIS = `
With(
    {
        hoje: Filter(colCate, ChaveData = Text(Today(), "yyyy-mm-dd") && Status <> "CANCELADO"),
        amanha: Filter(colCate, ChaveData = Text(DateAdd(Today(), 1, TimeUnit.Days), "yyyy-mm-dd") && ${ATIVO}),
        semana: Filter(colCate, DataHoraExame >= Today() && DataHoraExame < DateAdd(Today(), 7, TimeUnit.Days) && ${ATIVO}),
        aguard: Filter(colCate, ${ATIVO} && (Tipo = "INTERNADO_ELETIVO" || Tipo = "INTERNADO_URGENCIA")),
        canc30: Filter(colCate, (Status = "CANCELADO" || Status = "SUSPENSO") && DataHoraExame < Now())
    },
    With(
        {diasAguard: Average(AddColumns(aguard, D, DateDiff(LookUp(colInternados, Title = NrAtendimento, DataInternacao), Today(), TimeUnit.Days)), D)},
        "<div style='display:flex;flex-wrap:wrap;gap:12px;font-family:Segoe UI,Arial,sans-serif'>" &
        ${CARD("Cateterismos hoje", "CountRows(hoje)", "hexTexto", `Concat(tblTiposCate As t, t.Value & ": " & CountRows(Filter(hoje, Tipo = t.Codigo)), " · ")`)} &
        ${CARD("Amanhã", "CountRows(amanha)", "hexTexto", `"próximos 7 dias: " & CountRows(semana)`)} &
        ${CARD("Internados aguardando", "CountRows(aguard)", `If(CountRows(aguard) > 0, hexAmarelo, hexTexto)`, `If(CountRows(aguard) = 0, "nenhum", "internados há " & IfError(Text(diasAguard, "0"), "–") & " dias em média")`)} &
        ${CARD("Cancelados/suspensos (30 d)", "CountRows(canc30)", "hexTexto", `"no período"`)} &
        "</div>"
    )
)`;

const ITENS = `
Sort(
    Filter(
        colCate,
        Switch(
            varCatePeriodo,
            "DIA", ChaveData = Text(varDiaCate, "yyyy-mm-dd"),
            "SEMANA", DataHoraExame >= Today() && DataHoraExame < DateAdd(Today(), 7, TimeUnit.Days),
            "AGUARDANDO", ${ATIVO} && (Tipo = "INTERNADO_ELETIVO" || Tipo = "INTERNADO_URGENCIA"),
            true
        ) &&
        (drpTipoFiltroCT.Selected.Codigo = "TODOS" || Tipo = drpTipoFiltroCT.Selected.Codigo) &&
        (drpStatusFiltroCT.Selected.Codigo = "TODOS" || Status = drpStatusFiltroCT.Selected.Codigo)
    ),
    DataHoraExame
)`;

const ACAO = (campos, msg) => `
With(
    {id: ThisItem.ID, nome: ThisItem.Title},
    Patch(Cateterismos, LookUp(Cateterismos, ID = id), {${campos}, AtualizadoPorNome: gUsuarioNome});
    ${CARREGA};
    Notify(nome & ": ${msg}.", NotificationType.Success)
)`;

const REMARCAR = `
With(
    {id: ThisItem.ID, nome: ThisItem.Title, antiga: ThisItem.DataHoraExame, nova: dpRemarcarCT.SelectedDate},
    If(
        IsBlank(nova),
        Notify("Escolha a nova data.", NotificationType.Warning),
        With(
            {quando: DateAdd(nova, Hour(antiga) * 60 + Minute(antiga), TimeUnit.Minutes)},
            Patch(
                Cateterismos,
                LookUp(Cateterismos, ID = id),
                {
                    DataHoraExame: quando,
                    ChaveData: Text(quando, "yyyy-mm-dd"),
                    Status: "REMARCADO",
                    Observacao: "Remarcado de " & Text(antiga, "dd/mm hh:mm") & " por " & gUsuarioNome,
                    AtualizadoPorNome: gUsuarioNome
                }
            );
            If(!IsBlank(LookUp(Cateterismos, ID = id, RecepcaoId)), Patch(Recepcoes, LookUp(Recepcoes, ID = LookUp(Cateterismos, ID = id, RecepcaoId)), {DataCateterismo: quando}));
            ${CARREGA};
            Notify(nome & ": remarcado para " & Text(quando, "dd/mm hh:mm") & ".", NotificationType.Success)
        )
    )
)`;

const SALVAR = `
With(
    {
        quando: ${DATA_HORA("dpDataCT", "txtHoraCT").trim()},
        internado: LookUp(colInternados, Title = Trim(txtAtendCT.Text))
    },
    If(
        IsBlank(Coalesce(Trim(txtPacCT.Text), internado.Paciente)),
        Notify("Informe o paciente (nome ou nº de atendimento de um internado).", NotificationType.Warning),
        IsBlank(drpTipoCT.Selected.Codigo),
        Notify("Escolha o tipo do paciente.", NotificationType.Warning),
        IsBlank(dpDataCT.SelectedDate),
        Notify("Informe a data do exame.", NotificationType.Warning),
        Patch(
            Cateterismos,
            If(IsBlank(varEditCT), Defaults(Cateterismos), LookUp(Cateterismos, ID = varEditCT.ID)),
            {
                Title: Coalesce(Trim(txtPacCT.Text), internado.Paciente),
                NrAtendimento: Trim(txtAtendCT.Text),
                Idade: txtIdadeCT.Text,
                DataHoraExame: quando,
                ChaveData: Text(quando, "yyyy-mm-dd"),
                Tipo: drpTipoCT.Selected.Codigo,
                Procedimento: txtProcCT.Text,
                MedicoSolicitante: txtMedicoCT.Text,
                Convenio: txtConvCT.Text,
                ServicoOrigem: txtOrigemCT.Text,
                Status: If(IsBlank(varEditCT), "AGENDADO", varEditCT.Status),
                Origem: If(IsBlank(varEditCT), "MANUAL", varEditCT.Origem),
                Observacao: txtObsCT.Text,
                AtualizadoPorNome: gUsuarioNome
            }
        );
        ${CARREGA};
        Set(varFormCate, false);
        Set(varEditCT, Blank());
        Notify("Cateterismo salvo na agenda.", NotificationType.Success)
    )
)`;

// importação da planilha atual da agenda (colar do Excel)
const IDX = (v) => `Trim(IfError(Index(cel, ${v}).Value, ""))`;
const PREVIA_IMPORT = `
Set(varImpCateOk, false);
Set(varImpCateFeita, true);
Set(varTxtCate, Substitute(txtColarCT.Text, Char(13), ""));
ClearCollect(colLinCTmp, Split(varTxtCate, Char(10)));
ClearCollect(colLinC, ForAll(Sequence(CountRows(colLinCTmp)) As n, {N: n.Value, Texto: Index(colLinCTmp, n.Value).Value}));
ClearCollect(colSinPac, Filter(tblMapaCate, Campo = "Paciente"));
Set(varCabC, First(Filter(colLinC, CountRows(Filter(Split(Lower(Texto), Char(9)), Trim(Value) in colSinPac.Sinonimo)) > 0)).N);
If(
    IsBlank(varCabC),
    Notify("Não encontrei o cabeçalho da planilha (coluna Paciente).", NotificationType.Error),
    ClearCollect(colCabCTmp, Split(LookUp(colLinC, N = varCabC, Texto), Char(9)));
    ClearCollect(colCabC, ForAll(Sequence(CountRows(colCabCTmp)) As i, {I: i.Value, Nome: Lower(Trim(Index(colCabCTmp, i.Value).Value))}));
    ClearCollect(colMapaC, ForAll(Distinct(tblMapaCate, Campo) As m, {Campo: m.Value, I: LookUp(colCabC, Nome in Filter(tblMapaCate, Campo = m.Value).Sinonimo, I)}));
    Set(vcData, LookUp(colMapaC, Campo = "Data", I));
    Set(vcHora, LookUp(colMapaC, Campo = "Hora", I));
    Set(vcPac, LookUp(colMapaC, Campo = "Paciente", I));
    Set(vcTipo, LookUp(colMapaC, Campo = "Tipo", I));
    Set(vcAt, LookUp(colMapaC, Campo = "Atendimento", I));
    Set(vcPront, LookUp(colMapaC, Campo = "Prontuario", I));
    Set(vcIdade, LookUp(colMapaC, Campo = "Idade", I));
    Set(vcProc, LookUp(colMapaC, Campo = "Procedimento", I));
    Set(vcMed, LookUp(colMapaC, Campo = "Medico", I));
    Set(vcConv, LookUp(colMapaC, Campo = "Convenio", I));
    Set(vcOrig, LookUp(colMapaC, Campo = "Procedencia", I));
    Set(vcObs, LookUp(colMapaC, Campo = "Observacao", I));
    ClearCollect(
        colCatePrev,
        ForAll(
            Filter(colLinC, N > varCabC && !IsBlank(Trim(Texto))) As l,
            With(
                {cel: Split(l.Texto, Char(9))},
                With(
                    {
                        pac: ${IDX("vcPac")},
                        dataTxt: ${IDX("vcData")},
                        horaTxt: ${IDX("vcHora")},
                        tipoTxt: Lower(${IDX("vcTipo")}),
                        at: Substitute(${IDX("vcAt")}, ".", "")
                    },
                    With(
                        {
                            quando: IfError(DateTimeValue(dataTxt & If(IsBlank(horaTxt), "", " " & horaTxt), "pt-BR"), IfError(DateTimeValue(dataTxt, "pt-BR"), Blank())),
                            tipo: If(
                                ("intern" in tipoTxt) && ("urg" in tipoTxt), "INTERNADO_URGENCIA",
                                "intern" in tipoTxt, "INTERNADO_ELETIVO",
                                "urg" in tipoTxt, "EXTERNO_URGENCIA_RELATIVA",
                                ("extern" in tipoTxt) || ("eletiv" in tipoTxt), "EXTERNO_ELETIVO",
                                !IsBlank(at), "INTERNADO_ELETIVO",
                                "EXTERNO_ELETIVO"
                            )
                        },
                        {
                            Linha: l.N,
                            Paciente: pac,
                            DataHora: quando,
                            Tipo: tipo,
                            TipoLido: tipoTxt,
                            Atendimento: at,
                            Prontuario: ${IDX("vcPront")},
                            Idade: ${IDX("vcIdade")},
                            Procedimento: ${IDX("vcProc")},
                            Medico: ${IDX("vcMed")},
                            Convenio: ${IDX("vcConv")},
                            Procedencia: ${IDX("vcOrig")},
                            Observacao: ${IDX("vcObs")},
                            Problema: If(
                                IsBlank(pac), "sem paciente",
                                IsBlank(quando), "data inválida",
                                !IsBlank(LookUp(colCate, ChaveData = Text(quando, "yyyy-mm-dd") && Lower(Title) = Lower(pac), ID)), "já está na agenda",
                                ""
                            )
                        }
                    )
                )
            )
        )
    );
    Set(varImpCateOk, CountRows(Filter(colCatePrev, IsBlank(Problema))) > 0)
)`;

const CONFIRMA_IMPORT = `
Collect(
    Cateterismos,
    ForAll(
        Filter(colCatePrev, IsBlank(Problema)) As r,
        {
            Title: r.Paciente,
            NrAtendimento: r.Atendimento,
            Prontuario: r.Prontuario,
            Idade: r.Idade,
            DataHoraExame: r.DataHora,
            ChaveData: Text(r.DataHora, "yyyy-mm-dd"),
            Tipo: r.Tipo,
            Procedimento: r.Procedimento,
            MedicoSolicitante: r.Medico,
            Convenio: r.Convenio,
            ServicoOrigem: r.Procedencia,
            Status: "AGENDADO",
            Origem: "PLANILHA",
            Observacao: r.Observacao,
            AtualizadoPorNome: gUsuarioNome
        }
    )
);
Patch(
    Importacoes,
    Defaults(Importacoes),
    {
        Title: varChaveData & "|CATETERISMOS|" & Text(Now(), "hhmmss"),
        ChaveData: varChaveData,
        DataRef: varDataRef,
        Janela: varJanela,
        JanelaChave: varJanelaChave,
        TipoGuia: "CATETERISMOS",
        SetorCodigo: "",
        Linhas: CountRows(Filter(colCatePrev, IsBlank(Problema))),
        Status: "PROCESSADO",
        EnviadoPorEmail: gUsuarioEmail,
        EnviadoPorNome: gUsuarioNome,
        ImportadoEm: Now(),
        Observacao: "Agenda de cateterismos importada por colagem"
    }
);
Notify(CountRows(Filter(colCatePrev, IsBlank(Problema))) & " cateterismo(s) incluídos na agenda.", NotificationType.Success);
${CARREGA};
Reset(txtColarCT);
Clear(colCatePrev);
Set(varImpCateOk, false);
Set(varImpCateFeita, false);
Set(varImportCate, false)`;

const COR_TIPO = "ColorValue(LookUp(tblTiposCate, Codigo = ThisItem.Tipo, Hex))";

export function telaCateterismos() {
  const topo = 172;
  const card = [
    retangulo("recCardCT", 0, 3, "Parent.TemplateWidth", "Parent.TemplateHeight - 6"),
    c("recTipoCT", T.rect, { ...pos(0, 3, 6, "Parent.TemplateHeight - 6"), Fill: COR_TIPO }),
    lbl("lblHoraCT", `Text(ThisItem.DataHoraExame, If(varCatePeriodo = "DIA", "hh:mm", "dd/mm hh:mm"))`, 14, 8, 110, 28, {
      Size: 14,
      FontWeight: "FontWeight.Semibold",
    }),
    lbl("lblPacCT", `ThisItem.Title & If(IsBlank(ThisItem.Idade), "", ", " & ThisItem.Idade)`, 130, 6, 440, 24, { FontWeight: "FontWeight.Semibold" }),
    lbl("lblTipoCT", `LookUp(tblTiposCate, Codigo = ThisItem.Tipo, Value)`, 130, 30, 220, 20, { Size: 9, FontWeight: "FontWeight.Semibold", Color: COR_TIPO }),
    lbl(
      "lblLocalCT",
      `With(
          {i: LookUp(colInternados, Title = ThisItem.NrAtendimento)},
          If(
              !IsBlank(i.Title), "Internado em " & ${SIGLA("i.SetorCodigo")} & " leito " & i.Leito & " · atend. " & i.Title,
              !IsBlank(ThisItem.ServicoOrigem), "Procedência: " & ThisItem.ServicoOrigem,
              ""
          )
      ) & If(IsBlank(ThisItem.Procedimento), "", " · " & ThisItem.Procedimento) & If(IsBlank(ThisItem.MedicoSolicitante), "", " · " & ThisItem.MedicoSolicitante)`,
      356,
      30,
      "Parent.TemplateWidth - 640",
      20,
      { Size: 9, Color: "corTextoSuave" }
    ),
    lbl(
      "lblObsCT",
      `LookUp(tblStatusCate, Codigo = ThisItem.Status, Value) & If(IsBlank(ThisItem.DestinoPosExame), "", " · destino: " & ThisItem.DestinoPosExame) & If(ThisItem.Origem = "RECEPCAO", " · veio da Previsão de Recepção", "") & If(IsBlank(ThisItem.Observacao), "", " · " & ThisItem.Observacao)`,
      130,
      52,
      "Parent.TemplateWidth - 420",
      20,
      {
        Size: 9,
        Color: `If(ThisItem.Status = "REALIZADO", corVerde, ThisItem.Status = "CANCELADO" || ThisItem.Status = "SUSPENSO", corVermelho, corPrimaria)`,
      }
    ),
    dropdown("drpDestinoCT", "tblDestinosPosCate", "Parent.TemplateWidth - 560", 72, 190, {
      AllowEmptySelection: true,
      Default: "ThisItem.DestinoPosExame",
      Size: 9,
      Visible: `gEhNIR && ${ATIVO.replace(/Status/g, "ThisItem.Status")}`,
    }),
    botao(
      "btnRealizadoCT",
      '"Realizado"',
      ACAO(`Status: "REALIZADO", DestinoPosExame: drpDestinoCT.Selected.Value`, "exame realizado"),
      "Parent.TemplateWidth - 362",
      72,
      100,
      32,
      { Size: 9, Fill: "corVerde", HoverFill: "corVerde", Visible: `gEhNIR && ${ATIVO.replace(/Status/g, "ThisItem.Status")}` }
    ),
    datepicker("dpRemarcarCT", "ThisItem.DataHoraExame", "Parent.TemplateWidth - 254", 72, 130, {
      Visible: `gEhNIR && ${ATIVO.replace(/Status/g, "ThisItem.Status")}`,
    }),
    botaoSec("btnRemarcarCT", '"Remarcar"', REMARCAR, "Parent.TemplateWidth - 118", 72, 106, 32, {
      Size: 9,
      Visible: `gEhNIR && ${ATIVO.replace(/Status/g, "ThisItem.Status")}`,
    }),
    botaoSec("btnSuspenderCT", '"Suspender"', ACAO(`Status: "SUSPENSO"`, "exame suspenso"), "Parent.TemplateWidth - 362", 8, 100, 30, {
      Size: 9,
      Visible: `gEhNIR && ${ATIVO.replace(/Status/g, "ThisItem.Status")}`,
    }),
    botaoSec("btnCancelarCT", '"Cancelar"', ACAO(`Status: "CANCELADO"`, "exame cancelado"), "Parent.TemplateWidth - 254", 8, 100, 30, {
      Size: 9,
      Color: "corVermelho",
      BorderColor: "corVermelho",
      HoverColor: "corVermelho",
      Visible: `gEhNIR && ${ATIVO.replace(/Status/g, "ThisItem.Status")}`,
    }),
    botaoSec("btnEditarCT", '"Editar"', "Set(varEditCT, ThisItem); Set(varFormCate, true)", "Parent.TemplateWidth - 146", 8, 134, 30, {
      Size: 9,
      Visible: "gEhNIR",
    }),
    botaoSec(
      "btnVagaCT",
      '"Solicitar vaga"',
      `Set(varFiltroSetor, Coalesce(LookUp(colInternados, Title = ThisItem.NrAtendimento, SetorCodigo), "TODOS")); Set(varBuscaVagas, ThisItem.NrAtendimento); Navigate(scrVagas, ScreenTransition.None)`,
      14,
      72,
      110,
      30,
      { Size: 9, Visible: `gEhNIR && !IsBlank(LookUp(colInternados, Title = ThisItem.NrAtendimento, Title))` }
    ),
  ];

  const formulario = janela("conFormCT", "varFormCate", 780, 520, [
    titulo("lblFormTitCT", `If(IsBlank(varEditCT), "Novo cateterismo na agenda", "Editar cateterismo · " & varEditCT.Title)`, 16, 10, 600, 26),
    rotulo("lblFAtendCT", '"Nº de atendimento (se internado)"', 16, 46, 240),
    entrada("txtAtendCT", 16, 64, 240, 36, { Default: "varEditCT.NrAtendimento" }),
    lbl(
      "lblFAtendInfoCT",
      `With({i: LookUp(colInternados, Title = Trim(txtAtendCT.Text))}, If(IsBlank(i.Title), If(IsBlank(txtAtendCT.Text), "", "Atendimento não encontrado entre os internados"), "Internado: " & i.Paciente & " · " & ${SIGLA("i.SetorCodigo")} & " " & i.Leito))`,
      268,
      64,
      496,
      36,
      { Size: 10, Color: "corPrimaria" }
    ),
    rotulo("lblFPacCT", '"Paciente (deixe vazio para usar o nome do internado)"', 16, 106, 500),
    entrada("txtPacCT", 16, 124, 560, 36, { Default: "varEditCT.Title" }),
    rotulo("lblFIdadeCT", '"Idade"', 588, 106, 176),
    entrada("txtIdadeCT", 588, 124, 176, 36, { Default: "varEditCT.Idade" }),
    rotulo("lblFTipoCT", '"Tipo do paciente"', 16, 166, 300),
    dropdown("drpTipoCT", "tblTiposCate", 16, 184, 300, {
      AllowEmptySelection: true,
      Default: `LookUp(tblTiposCate, Codigo = varEditCT.Tipo, Value)`,
    }),
    rotulo("lblFDataCT", '"Data do exame"', 328, 166, 200),
    datepicker("dpDataCT", "Coalesce(varEditCT.DataHoraExame, Today())", 328, 184, 200),
    rotulo("lblFHoraCT", '"Hora (hh:mm)"', 540, 166, 120),
    entrada("txtHoraCT", 540, 184, 120, 36, { Default: `If(IsBlank(varEditCT), "08:00", Text(varEditCT.DataHoraExame, "hh:mm"))` }),
    rotulo("lblFProcCT", '"Procedimento"', 16, 226, 360),
    entrada("txtProcCT", 16, 244, 360, 36, { Default: "Coalesce(varEditCT.Procedimento, \"Cateterismo cardíaco\")" }),
    rotulo("lblFMedicoCT", '"Médico solicitante"', 388, 226, 376),
    entrada("txtMedicoCT", 388, 244, 376, 36, { Default: "varEditCT.MedicoSolicitante" }),
    rotulo("lblFConvCT", '"Convênio"', 16, 286, 240),
    entrada("txtConvCT", 16, 304, 240, 36, { Default: "varEditCT.Convenio" }),
    rotulo("lblFOrigemCT", '"Procedência (externos)"', 268, 286, 496),
    entrada("txtOrigemCT", 268, 304, 496, 36, { Default: "varEditCT.ServicoOrigem" }),
    rotulo("lblFObsCT", '"Observação"', 16, 346, 400),
    entrada("txtObsCT", 16, 364, 748, 80, { Mode: "TextMode.MultiLine", Default: "varEditCT.Observacao" }),
    botao("btnSalvarCT", '"Salvar"', SALVAR, 16, 460, 160, 40),
    botaoSec("btnFecharFormCT", '"Fechar"', "Set(varFormCate, false); Set(varEditCT, Blank())", 188, 460, 120, 40),
  ]);

  const importacao = janela("conImportCT", "varImportCate", 900, 560, [
    titulo("lblImpTitCT", '"Importar agenda da planilha (Excel)"', 16, 10, 600, 26),
    lbl(
      "lblImpDicaCT",
      '"Abra a planilha no Excel, selecione a tabela (com o cabeçalho), Ctrl+C, e cole abaixo. Colunas reconhecidas: Data, Hora, Paciente, Tipo, Atendimento, Prontuário, Idade, Procedimento, Médico, Convênio, Procedência, Observação. Linhas que já estão na agenda (mesmo dia e paciente) são ignoradas."',
      16,
      38,
      868,
      44,
      { Size: 10, Color: "corTextoSuave" }
    ),
    entrada("txtColarCT", 16, 86, 868, 130, { Mode: "TextMode.MultiLine", Size: 9, HintText: '"Cole aqui (Ctrl+V)"', OnChange: "Set(varImpCateOk, false)" }),
    botao("btnPreviaCT", '"Pré-visualizar"', PREVIA_IMPORT, 16, 226, 160, 36),
    botao("btnConfirmaImpCT", '"Incluir na agenda"', CONFIRMA_IMPORT, 188, 226, 180, 36, {
      DisplayMode: "If(varImpCateOk && gEhNIR, DisplayMode.Edit, DisplayMode.Disabled)",
    }),
    botaoSec("btnFecharImpCT", '"Fechar"', "Set(varImportCate, false)", 380, 226, 110, 36),
    lbl(
      "lblImpResumoCT",
      `CountRows(Filter(colCatePrev, IsBlank(Problema))) & " para incluir · " & CountRows(Filter(colCatePrev, !IsBlank(Problema))) & " ignorada(s)"`,
      504,
      232,
      380,
      24,
      { Size: 10, FontWeight: "FontWeight.Semibold", Visible: "varImpCateFeita" }
    ),
    galeria(
      "galImpCT",
      "colCatePrev",
      16,
      272,
      868,
      272,
      32,
      [
        lbl("lblImp1CT", `If(IsBlank(ThisItem.DataHora), "–", Text(ThisItem.DataHora, "dd/mm hh:mm")) & "  ·  " & ThisItem.Paciente`, 0, 3, 420, 26, { Size: 10 }),
        lbl("lblImp2CT", `LookUp(tblTiposCate, Codigo = ThisItem.Tipo, Value) & If(IsBlank(ThisItem.TipoLido), " (deduzido)", "")`, 424, 3, 250, 26, {
          Size: 10,
          Color: "corTextoSuave",
        }),
        lbl("lblImp3CT", `If(IsBlank(ThisItem.Problema), "ok", ThisItem.Problema)`, 678, 3, 190, 26, {
          Size: 10,
          Color: `If(IsBlank(ThisItem.Problema), corVerde, corVermelho)`,
        }),
      ],
      { Visible: "varImpCateFeita" }
    ),
  ]);

  return telaManual(
    "scrCateterismos",
    "CT",
    "CATETERISMOS",
    '"Cateterismos"',
    ATUALIZA,
    [
      html("htmlKpisCT", HTML_KPIS, 20, 66, "Parent.Width - 40", 96),
      alternador("btnPerDiaCT", '"Dia"', `varCatePeriodo = "DIA"`, `Set(varCatePeriodo, "DIA")`, 20, topo, 70, 36),
      alternador("btnPerSemanaCT", '"Próximos 7 dias"', `varCatePeriodo = "SEMANA"`, `Set(varCatePeriodo, "SEMANA")`, 96, topo, 140, 36),
      alternador("btnPerAguardCT", '"Internados aguardando"', `varCatePeriodo = "AGUARDANDO"`, `Set(varCatePeriodo, "AGUARDANDO")`, 242, topo, 180, 36),
      botaoSec("btnDiaAntCT", '"◀"', "Set(varDiaCate, DateAdd(varDiaCate, -1, TimeUnit.Days)); Set(varCatePeriodo, \"DIA\")", 436, topo, 40, 36),
      lbl("lblDiaCT", `Text(varDiaCate, "ddd dd/mm/yyyy")`, 480, topo, 150, 36, { Align: "Align.Center", FontWeight: "FontWeight.Semibold" }),
      botaoSec("btnDiaProxCT", '"▶"', "Set(varDiaCate, DateAdd(varDiaCate, 1, TimeUnit.Days)); Set(varCatePeriodo, \"DIA\")", 634, topo, 40, 36),
      botaoSec("btnHojeCT", '"Hoje"', "Set(varDiaCate, Today()); Set(varCatePeriodo, \"DIA\")", 680, topo, 70, 36),
      dropdown("drpTipoFiltroCT", comTodos("tblTiposCate", "Todos os tipos"), 760, topo, 200, { Size: 10 }),
      dropdown("drpStatusFiltroCT", comTodos("tblStatusCate", "Todos os status"), 968, topo, 160, { Size: 10 }),
      botao("btnNovoCT", '"+ Novo"', "Set(varEditCT, Blank()); Set(varFormCate, true)", "Parent.Width - 300", topo, 120, 36, { Visible: "gEhNIR" }),
      botaoSec("btnImportarCT", '"Importar planilha"', "Set(varImportCate, true)", "Parent.Width - 172", topo, 152, 36, { Visible: "gEhNIR" }),
      galeria("galCateCT", ITENS, 20, topo + 46, "Parent.Width - 40", `Parent.Height - ${topo + 66}`, 112, card),
      lbl("lblVazioCT", '"Nenhum cateterismo neste filtro."', 20, topo + 60, 400, 30, {
        Color: "corTextoSuave",
        Visible: "CountRows(galCateCT.AllItems) = 0",
      }),
      formulario,
      importacao,
    ],
    `If(IsBlank(varCatePeriodo), Set(varCatePeriodo, "DIA")); If(IsBlank(varDiaCate), Set(varDiaCate, Today())); Set(varFormCate, false); Set(varImportCate, false); Set(varEditCT, Blank())`
  );
}
