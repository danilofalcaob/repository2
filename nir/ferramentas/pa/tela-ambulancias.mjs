// Guia: Ambulâncias (sufixo AM)
import * as B from "./base.mjs";
const { lbl, titulo, botao, botaoSec, retangulo, dropdown, entrada, galeria, html, c, T, pos, SIGLA, CARD, alternador, datepicker, rotulo, telaManual, janela, DATA_HORA } = B;

const CHECK = [
  ["ChkAutorizacao", "Autorização"],
  ["ChkRelatorio", "Relatório"],
  ["ChkExames", "Exames"],
  ["ChkContatoDestino", "Contato destino"],
  ["ChkAgendaConfirmada", "Agenda confirm."],
  ["ChkAcompanhante", "Acompanhante"],
  ["ChkEquipamentos", "Equip./O2"],
  ["ChkDocumentos", "Documentos"],
  ["ChkFamilia", "Família avisada"],
];
const CHK_SOMA = (p = "") => "(" + CHECK.map(([f]) => `If(${p}${f}, 1, 0)`).join(" + ") + ")";

const CARREGA = `
ClearCollect(
    colTransp,
    Filter(Transportes, Status = "AGENDADO" || Status = "SOLICITADA" || Status = "CONFIRMADA" || Status = "NO_LOCAL" || Status = "SAIU")
);
ClearCollect(
    colTranspHist,
    Filter(Transportes, AgendadoPara >= DateAdd(Today(), -30, TimeUnit.Days) && (Status = "RETORNOU" || Status = "CONCLUIDO" || Status = "CANCELADO"))
)`;

const ATUALIZA = `
Refresh(Transportes);
Refresh(Internacoes);
ClearCollect(colInternados, Filter(Internacoes, Status = "INTERNADO"));
${CARREGA.trim()};
Set(varUltimaAtualizacao, Now())`;

const HTML_KPIS = `
With(
    {agora: varUltimaAtualizacao},
    With(
        {
            h24: Filter(colTransp, Status <> "SAIU" && AgendadoPara <= DateAdd(agora, 24, TimeUnit.Hours)),
            h48: Filter(colTransp, Status <> "SAIU" && AgendadoPara > DateAdd(agora, 24, TimeUnit.Hours) && AgendadoPara <= DateAdd(agora, 48, TimeUnit.Hours)),
            andamento: Filter(colTransp, Status = "SOLICITADA" || Status = "CONFIRMADA" || Status = "NO_LOCAL"),
            radar: Filter(colTransp, Status = "SAIU"),
            atras: Filter(colTransp, (Status = "AGENDADO" || Status = "SOLICITADA" || Status = "CONFIRMADA") && AgendadoPara < agora)
        },
        With(
            {incompletos: CountRows(Filter(h24, ${CHK_SOMA()} < ${CHECK.length}))},
            "<div style='display:flex;flex-wrap:wrap;gap:12px;font-family:Segoe UI,Arial,sans-serif'>" &
            ${CARD("Próximas 24 h", "CountRows(h24)", "hexTexto", `"24–48 h: " & CountRows(h48)`)} &
            ${CARD("Em andamento", "CountRows(andamento)", "hexPrimaria", `"ambulância pedida, confirmada ou no hospital"`)} &
            ${CARD("Checklist incompleto (24 h)", "incompletos", `If(incompletos > 0, hexAmarelo, hexVerde)`, `"transportes com itens pendentes"`)} &
            ${CARD("Atrasados", "CountRows(atras)", `If(CountRows(atras) > 0, hexVermelho, hexVerde)`, `"horário passou e o paciente não saiu"`)} &
            ${CARD("No radar", "CountRows(radar)", "hexTexto", `"fora do hospital, podem retornar"`)} &
            "</div>"
        )
    )
)`;

const ITENS = `
Sort(
    Filter(
        If(varAbaAmb = "HIST", colTranspHist, colTransp),
        Switch(
            varAbaAmb,
            "24H", Status <> "SAIU" && AgendadoPara <= DateAdd(varUltimaAtualizacao, 24, TimeUnit.Hours),
            "48H", Status <> "SAIU" && AgendadoPara > DateAdd(varUltimaAtualizacao, 24, TimeUnit.Hours) && AgendadoPara <= DateAdd(varUltimaAtualizacao, 48, TimeUnit.Hours),
            "ANDAMENTO", Status = "SOLICITADA" || Status = "CONFIRMADA" || Status = "NO_LOCAL",
            "RADAR", Status = "SAIU",
            true
        )
    ),
    AgendadoPara,
    If(varAbaAmb = "HIST", SortOrder.Descending, SortOrder.Ascending)
)`;

const ETAPA = (status, campos, msg) => `
With(
    {id: ThisItem.ID, nome: ThisItem.Title},
    Patch(Transportes, LookUp(Transportes, ID = id), {Status: ${status}${campos}, AtualizadoPorNome: gUsuarioNome});
    ${CARREGA.trim()};
    Notify(nome & ": ${msg}.", NotificationType.Success)
)`;

const TOGGLE_CHK = (f) => `
With(
    {id: ThisItem.ID, v: !ThisItem.${f}},
    Patch(Transportes, LookUp(Transportes, ID = id), {${f}: v, AtualizadoPorNome: gUsuarioNome});
    Patch(colTransp, LookUp(colTransp, ID = id), {${f}: v})
)`;

const CAMPOS_FORM = `
                TipoTransporte: drpTipoAM.Selected.Codigo,
                Motivo: drpMotivoAM.Selected.Codigo,
                Destino: Trim(txtDestinoAM.Text),
                Empresa: Trim(txtEmpresaAM.Text),
                AgendadoPara: quando,
                PodeRetornar: varRetornaAM,
                Observacao: txtObsFormAM.Text,
                AtualizadoPorNome: gUsuarioNome`;

const SALVAR = `
If(
    IsBlank(varEditAM) && IsBlank(drpPacAM.Selected.Title),
    Notify("Escolha o paciente.", NotificationType.Warning),
    IsBlank(Trim(txtDestinoAM.Text)),
    Notify("Informe o destino (serviço ou hospital).", NotificationType.Warning),
    IsBlank(dpDataAM.SelectedDate),
    Notify("Informe a data do transporte.", NotificationType.Warning),
    With(
        {quando: ${DATA_HORA("dpDataAM", "txtHoraAM").trim()}},
        If(
            IsBlank(varEditAM),
            Patch(
                Transportes,
                Defaults(Transportes),
                {
                    Title: drpPacAM.Selected.Paciente,
                    NrAtendimento: drpPacAM.Selected.Title,
                    SetorOrigem: drpPacAM.Selected.SetorCodigo,
                    Leito: drpPacAM.Selected.Leito,
                    Status: "AGENDADO",
${CHECK.map(([f]) => `                    ${f}: false,`).join("\n")}
${CAMPOS_FORM}
                }
            ),
            Patch(
                Transportes,
                LookUp(Transportes, ID = varEditAM.ID),
                {
${CAMPOS_FORM}
                }
            )
        );
        ${CARREGA.trim()};
        Set(varFormAmb, false);
        Set(varEditAM, Blank());
        Notify("Transporte salvo.", NotificationType.Success)
    )
)`;

const ABAS = [
  ["24H", "Próximas 24 h"],
  ["48H", "24 a 48 h"],
  ["ANDAMENTO", "Em andamento"],
  ["RADAR", "Radar (fora)"],
  ["TODOS", "Todos ativos"],
  ["HIST", "Histórico 30 d"],
];

const PASSOS = [
  ["AGENDADO", "Ambulância solicitada", `"SOLICITADA"`, ", SolicitadoEm: Now()", "ambulância solicitada"],
  ["SOLICITADA", "Ambulância confirmada", `"CONFIRMADA"`, ", ConfirmadoEm: Now()", "ambulância confirmada"],
  ["CONFIRMADA", "Ambulância chegou", `"NO_LOCAL"`, ", ChegadaAmbulanciaEm: Now()", "ambulância no hospital"],
  ["NO_LOCAL", "Paciente saiu", `If(ThisItem.PodeRetornar, "SAIU", "CONCLUIDO")`, ", SaidaPacienteEm: Now()", "saída registrada"],
  ["SAIU", "Paciente retornou", `"RETORNOU"`, ", RetornouEm: Now()", "retorno registrado"],
];

export function telaAmbulancias() {
  const topo = 172;
  const cardFilhos = [
    retangulo("recCardAM", 0, 3, "Parent.TemplateWidth", "Parent.TemplateHeight - 6"),
    c("recFaixaAM", T.rect, {
      ...pos(0, 3, 6, "Parent.TemplateHeight - 6"),
      Fill: `If(ThisItem.Status = "SAIU", corPrimaria, ThisItem.AgendadoPara < varRelogio && ThisItem.Status <> "NO_LOCAL", corVermelho, ${CHK_SOMA("ThisItem.")} < ${CHECK.length}, corAmarelo, corVerde)`,
    }),
    lbl("lblPacAM", `ThisItem.Title & If(IsBlank(ThisItem.NrAtendimento), "", "  ·  atend. " & ThisItem.NrAtendimento)`, 16, 6, 520, 24, {
      FontWeight: "FontWeight.Semibold",
    }),
    lbl(
      "lblRotaAM",
      `${SIGLA("ThisItem.SetorOrigem")} & If(IsBlank(ThisItem.Leito), "", " leito " & ThisItem.Leito) & "  →  " & ThisItem.Destino & If(IsBlank(ThisItem.Empresa), "", " · " & ThisItem.Empresa) & " · " & LookUp(tblTiposTransporte, Codigo = ThisItem.TipoTransporte, Value) & " · " & LookUp(tblMotivosTransporte, Codigo = ThisItem.Motivo, Value)`,
      16,
      30,
      "Parent.TemplateWidth - 300",
      22,
      { Size: 10 }
    ),
    lbl("lblObsAM", `If(IsBlank(ThisItem.Observacao), "", ThisItem.Observacao)`, 16, 52, "Parent.TemplateWidth - 300", 20, { Size: 9, Color: "corTextoSuave" }),
    lbl(
      "lblQuandoAM",
      `Text(ThisItem.AgendadoPara, "ddd dd/mm hh:mm") & "  ·  " &
      With(
          {m: DateDiff(varRelogio, ThisItem.AgendadoPara, TimeUnit.Minutes)},
          If(
              ThisItem.Status = "SAIU", "fora desde " & Text(ThisItem.SaidaPacienteEm, "dd/mm hh:mm"),
              varAbaAmb = "HIST", LookUp(tblStatusTransporte, Codigo = ThisItem.Status, Value),
              m >= 0, "em " & If(m >= 60, RoundDown(m / 60, 0) & "h" & Text(Mod(m, 60), "00"), m & " min"),
              "atrasado " & If(-m >= 60, RoundDown(-m / 60, 0) & "h" & Text(Mod(-m, 60), "00"), -m & " min")
          )
      )`,
      "Parent.TemplateWidth - 300",
      6,
      288,
      24,
      { Align: "Align.Right", FontWeight: "FontWeight.Semibold", Size: 10 }
    ),
    lbl("lblStatusAM", `LookUp(tblStatusTransporte, Codigo = ThisItem.Status, Value)`, "Parent.TemplateWidth - 300", 30, 288, 20, {
      Align: "Align.Right",
      Size: 9,
      Color: "corPrimaria",
    }),
    ...CHECK.map(([f, rot], i) =>
      alternador(`btn${f}AM`, `If(ThisItem.${f}, "✓ ", "") & "${rot}"`, `ThisItem.${f}`, TOGGLE_CHK(f), 16 + (i % 5) * 124, i < 5 ? 78 : 110, 118, 28, {
        Size: 8,
        DisplayMode: `If(gEhNIR && varAbaAmb <> "HIST", DisplayMode.Edit, DisplayMode.View)`,
      })
    ),
    lbl("lblChkAM", `"Checklist " & ${CHK_SOMA("ThisItem.")} & "/${CHECK.length}"`, 640, 112, 120, 24, {
      Size: 9,
      Color: `If(${CHK_SOMA("ThisItem.")} < ${CHECK.length}, corAmarelo, corVerde)`,
    }),
    ...PASSOS.map(([de, rot, para, campos, msg]) =>
      botao(`btnPasso${de}AM`, `"${rot}"`, ETAPA(para, campos, msg), "Parent.TemplateWidth - 268", 76, 256, 32, {
        Size: 9,
        Visible: `gEhNIR && ThisItem.Status = "${de}" && varAbaAmb <> "HIST"`,
      })
    ),
    botaoSec("btnNaoRetornaAM", '"Não retornará"', ETAPA(`"CONCLUIDO"`, "", "transporte encerrado"), "Parent.TemplateWidth - 268", 112, 124, 30, {
      Size: 9,
      Visible: `gEhNIR && ThisItem.Status = "SAIU" && varAbaAmb <> "HIST"`,
    }),
    botaoSec("btnEditarAM", '"Editar"', `Set(varEditAM, ThisItem); Set(varRetornaAM, ThisItem.PodeRetornar); Set(varFormAmb, true)`, "Parent.TemplateWidth - 268", 112, 124, 30, {
      Size: 9,
      Visible: `gEhNIR && ThisItem.Status <> "SAIU" && varAbaAmb <> "HIST"`,
    }),
    botaoSec("btnCancelarAM", '"Cancelar"', ETAPA(`"CANCELADO"`, "", "transporte cancelado"), "Parent.TemplateWidth - 138", 112, 126, 30, {
      Size: 9,
      Color: "corVermelho",
      BorderColor: "corVermelho",
      HoverColor: "corVermelho",
      Visible: `gEhNIR && ThisItem.Status <> "SAIU" && varAbaAmb <> "HIST"`,
    }),
  ];

  const formulario = janela("conFormAM", "varFormAmb", 760, 470, [
    titulo("lblFormTitAM", `If(IsBlank(varEditAM), "Novo transporte", "Editar transporte · " & varEditAM.Title)`, 16, 10, 600, 26),
    rotulo("lblFPacAM", '"Paciente internado"', 16, 46, 400),
    dropdown(
      "drpPacAM",
      `ForAll(Sort(colInternados, Paciente) As i, {Value: i.Paciente & " · " & ${SIGLA("i.SetorCodigo")} & " " & i.Leito, Title: i.Title, Paciente: i.Paciente, SetorCodigo: i.SetorCodigo, Leito: i.Leito})`,
      16,
      64,
      728,
      { AllowEmptySelection: true, Default: "Blank()", Visible: "IsBlank(varEditAM)" }
    ),
    lbl("lblFPacEditAM", `varEditAM.Title & " · " & ${SIGLA("varEditAM.SetorOrigem")} & " " & varEditAM.Leito`, 16, 64, 728, 36, {
      Visible: "!IsBlank(varEditAM)",
      FontWeight: "FontWeight.Semibold",
    }),
    rotulo("lblFTipoAM", '"Tipo de transporte"', 16, 108, 300),
    dropdown("drpTipoAM", "tblTiposTransporte", 16, 126, 356, {
      Default: `If(IsBlank(varEditAM), "Ambulância USB (básica)", LookUp(tblTiposTransporte, Codigo = varEditAM.TipoTransporte, Value))`,
    }),
    rotulo("lblFMotivoAM", '"Motivo"', 388, 108, 300),
    dropdown("drpMotivoAM", "tblMotivosTransporte", 388, 126, 356, {
      Default: `If(IsBlank(varEditAM), "Exame externo", LookUp(tblMotivosTransporte, Codigo = varEditAM.Motivo, Value))`,
      OnChange: "Set(varRetornaAM, Self.Selected.Retorna)",
    }),
    rotulo("lblFDestinoAM", '"Destino (serviço/hospital)"', 16, 170, 356),
    entrada("txtDestinoAM", 16, 188, 356, 36, { Default: "varEditAM.Destino" }),
    rotulo("lblFEmpresaAM", '"Empresa da ambulância"', 388, 170, 356),
    entrada("txtEmpresaAM", 388, 188, 356, 36, { Default: "varEditAM.Empresa" }),
    rotulo("lblFDataAM", '"Data"', 16, 232, 200),
    datepicker("dpDataAM", "Coalesce(varEditAM.AgendadoPara, Today())", 16, 250, 200),
    rotulo("lblFHoraAM", '"Hora (hh:mm)"', 228, 232, 140),
    entrada("txtHoraAM", 228, 250, 140, 36, { Default: `If(IsBlank(varEditAM), "08:00", Text(varEditAM.AgendadoPara, "hh:mm"))` }),
    alternador("btnRetornaAM", `If(varRetornaAM, "✓ Paciente deve retornar", "Não retorna ao hospital")`, "varRetornaAM", "Set(varRetornaAM, !varRetornaAM)", 388, 250, 356, 36),
    rotulo("lblFObsAM", '"Observação"', 16, 296, 400),
    entrada("txtObsFormAM", 16, 314, 728, 80, { Mode: "TextMode.MultiLine", Default: "varEditAM.Observacao" }),
    botao("btnSalvarAM", '"Salvar"', SALVAR, 16, 410, 160, 40),
    botaoSec("btnFecharFormAM", '"Fechar"', "Set(varFormAmb, false); Set(varEditAM, Blank())", 188, 410, 120, 40),
  ]);

  return telaManual(
    "scrAmbulancias",
    "AM",
    "AMBULANCIAS",
    '"Ambulâncias"',
    ATUALIZA,
    [
      html("htmlKpisAM", HTML_KPIS, 20, 66, "Parent.Width - 40", 96),
      ...ABAS.map(([cod, rot], i) =>
        alternador(`btnAba${cod}AM`, `"${rot}"`, `varAbaAmb = "${cod}"`, `Set(varAbaAmb, "${cod}")`, 20 + i * 136, topo, 130, 36)
      ),
      botao("btnNovoAM", '"+ Novo transporte"', "Set(varEditAM, Blank()); Set(varRetornaAM, true); Reset(drpPacAM); Set(varFormAmb, true)", "Parent.Width - 200", topo, 180, 36, {
        Visible: "gEhNIR",
      }),
      galeria("galTranspAM", ITENS, 20, topo + 46, "Parent.Width - 40", `Parent.Height - ${topo + 66}`, 150, cardFilhos),
      lbl("lblVazioAM", '"Nenhum transporte nesta aba."', 20, topo + 60, 400, 30, {
        Color: "corTextoSuave",
        Visible: "CountRows(galTranspAM.AllItems) = 0",
      }),
      formulario,
    ],
    `If(IsBlank(varAbaAmb), Set(varAbaAmb, "24H")); Set(varFormAmb, false); Set(varEditAM, Blank()); Set(varRetornaAM, true)`
  );
}
