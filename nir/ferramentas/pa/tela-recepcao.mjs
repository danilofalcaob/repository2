// Guia: Previsão de Recepção — casos aceitos via CROSS (sufixo RC)
import * as B from "./base.mjs";
const { lbl, titulo, botao, botaoSec, retangulo, dropdown, entrada, galeria, html, c, T, pos, SIGLA, CARD, alternador, datepicker, rotulo, telaManual, janela, DATA_HORA } = B;

const CARREGA = `
ClearCollect(colRecep, Filter(Recepcoes, Status = "PREVISTO" || Status = "CHEGOU"));
ClearCollect(colRecepHist, Filter(Recepcoes, DesfechoEm >= DateAdd(Today(), -30, TimeUnit.Days)))`;

const ATUALIZA = `
Refresh(Recepcoes);
Refresh(Cateterismos);
${CARREGA.trim()};
Set(varUltimaAtualizacao, Now())`;

const FILTRO_ABA = `Switch(
            varAbaRecep,
            "HOJE", DateDiff(Today(), PrevistoPara, TimeUnit.Days) = 0,
            "AMANHA", DateDiff(Today(), PrevistoPara, TimeUnit.Days) = 1,
            "PROXIMOS", DateDiff(Today(), PrevistoPara, TimeUnit.Days) >= 0 && DateDiff(Today(), PrevistoPara, TimeUnit.Days) <= gDiasRecepcao,
            "ATRASADOS", PrevistoPara < Today() && Status = "PREVISTO",
            true
        )`;

const ITENS = (secao) => `
Sort(
    Filter(
        If(varAbaRecep = "HIST", colRecepHist, colRecep),
        Secao = "${secao}" && ${FILTRO_ABA}
    ),
    PrevistoPara,
    If(varAbaRecep = "HIST", SortOrder.Descending, SortOrder.Ascending)
)`;

const HTML_KPIS = `
With(
    {
        hoje: CountRows(Filter(colRecep, DateDiff(Today(), PrevistoPara, TimeUnit.Days) = 0)),
        amanha: CountRows(Filter(colRecep, DateDiff(Today(), PrevistoPara, TimeUnit.Days) = 1)),
        prox: CountRows(Filter(colRecep, DateDiff(Today(), PrevistoPara, TimeUnit.Days) >= 0 && DateDiff(Today(), PrevistoPara, TimeUnit.Days) <= gDiasRecepcao)),
        atras: CountRows(Filter(colRecep, PrevistoPara < Today() && Status = "PREVISTO")),
        cate: CountRows(Filter(colRecep, PrecisaCateterismo)),
        h: colRecepHist
    },
    With(
        {n: CountRows(Filter(h, Status <> "CANCELADO"))},
        "<div style='display:flex;flex-wrap:wrap;gap:12px;font-family:Segoe UI,Arial,sans-serif'>" &
        ${CARD("Chegam hoje", "hoje", "hexTexto", `"amanhã: " & amanha`)} &
        ${CARD("Próximos dias", "prox", "hexTexto", `"até " & gDiasRecepcao & " dias à frente · " & cate & " com cateterismo"`)} &
        ${CARD("Atrasados", "atras", `If(atras > 0, hexVermelho, hexVerde)`, `"data prevista passou e não chegaram"`)} &
        ${CARD("Retornaram à origem (30 d)", `If(n = 0, "–", Text(CountRows(Filter(h, Status = "RETORNOU_ORIGEM")) / n * 100, "0") & "%")`, "hexTexto", `CountRows(Filter(h, Status = "INTERNADO")) & " internaram · " & CountRows(Filter(h, Status = "RETORNOU_ORIGEM")) & " retornaram"`)} &
        ${CARD("Não compareceram (30 d)", `If(n = 0, "–", Text(CountRows(Filter(h, Status = "NAO_COMPARECEU")) / n * 100, "0") & "%")`, "hexTexto", `CountRows(Filter(h, Status = "NAO_COMPARECEU")) & " paciente(s)"`)} &
        "</div>"
    )
)`;

// cria ou atualiza o cateterismo ligado ao paciente da recepção
const SALVAR_CATE = (sfx) => `
With(
    {
        r: ThisItem,
        quando: ${DATA_HORA(`dpCate${sfx}`, `txtHoraCate${sfx}`).trim()},
        tipo: Coalesce(drpTipoCate${sfx}.Selected.Codigo, "EXTERNO_ELETIVO")
    },
    If(
        IsBlank(dpCate${sfx}.SelectedDate),
        Notify("Escolha a data do cateterismo.", NotificationType.Warning),
        If(
            IsBlank(r.CateterismoId) || IsBlank(LookUp(Cateterismos, ID = r.CateterismoId, ID)),
            Set(
                varCateRC,
                Patch(
                    Cateterismos,
                    Defaults(Cateterismos),
                    {
                        Title: r.Title,
                        Idade: r.Idade,
                        NrAtendimento: r.NrAtendimento,
                        DataHoraExame: quando,
                        ChaveData: Text(quando, "yyyy-mm-dd"),
                        Tipo: tipo,
                        Procedimento: "Cateterismo cardíaco",
                        ServicoOrigem: r.ServicoOrigem,
                        Status: "AGENDADO",
                        Origem: "RECEPCAO",
                        RecepcaoId: r.ID,
                        Observacao: "Incluído pela Previsão de Recepção (CROSS " & r.NrFichaCROSS & ")",
                        AtualizadoPorNome: gUsuarioNome
                    }
                )
            ),
            Set(
                varCateRC,
                Patch(
                    Cateterismos,
                    LookUp(Cateterismos, ID = r.CateterismoId),
                    {DataHoraExame: quando, ChaveData: Text(quando, "yyyy-mm-dd"), Tipo: tipo, Status: "AGENDADO", AtualizadoPorNome: gUsuarioNome}
                )
            )
        );
        Patch(
            Recepcoes,
            LookUp(Recepcoes, ID = r.ID),
            {PrecisaCateterismo: true, DataCateterismo: quando, TipoCateterismo: tipo, CateterismoId: varCateRC.ID, AtualizadoPorNome: gUsuarioNome}
        );
        Set(varCateEditRC, Blank());
        ${CARREGA.trim()};
        Notify(r.Title & ": cateterismo em " & Text(quando, "dd/mm hh:mm") & ", já incluído na guia Cateterismos.", NotificationType.Success)
    )
)`;

const DESMARCAR_CATE = `
With(
    {r: ThisItem},
    If(
        !IsBlank(r.CateterismoId),
        Patch(
            Cateterismos,
            LookUp(Cateterismos, ID = r.CateterismoId),
            {Status: "CANCELADO", Observacao: "Desmarcado na Previsão de Recepção por " & gUsuarioNome, AtualizadoPorNome: gUsuarioNome}
        )
    );
    Patch(Recepcoes, LookUp(Recepcoes, ID = r.ID), {PrecisaCateterismo: false, AtualizadoPorNome: gUsuarioNome});
    ${CARREGA.trim()};
    Notify(r.Title & ": cateterismo desmarcado (cancelado na agenda).", NotificationType.Information)
)`;

// desfechos
const DESFECHO = (status, extra, cancelaCate, msg) => `
With(
    {r: ThisItem},
    Patch(Recepcoes, LookUp(Recepcoes, ID = r.ID), {Status: "${status}"${extra}, AtualizadoPorNome: gUsuarioNome});
    ${cancelaCate
      ? `If(
        !IsBlank(r.CateterismoId) && r.PrecisaCateterismo,
        Patch(Cateterismos, LookUp(Cateterismos, ID = r.CateterismoId), {Status: "CANCELADO", Observacao: "Paciente da recepção: ${msg}", AtualizadoPorNome: gUsuarioNome})
    );`
      : ""}
    ${CARREGA.trim()};
    Notify(r.Title & ": ${msg}.", NotificationType.Success)
)`;

const INTERNAR = (sfx) => `
With(
    {r: ThisItem, at: Trim(txtAtend${sfx}.Text)},
    If(
        IsBlank(at),
        Notify("Informe o nº de atendimento do Tasy.", NotificationType.Warning),
        Patch(Recepcoes, LookUp(Recepcoes, ID = r.ID), {Status: "INTERNADO", NrAtendimento: at, DesfechoEm: Now(), ChegadaEm: Coalesce(r.ChegadaEm, Now()), AtualizadoPorNome: gUsuarioNome});
        If(
            !IsBlank(r.CateterismoId) && r.PrecisaCateterismo,
            With(
                {cat: LookUp(Cateterismos, ID = r.CateterismoId)},
                Patch(
                    Cateterismos,
                    cat,
                    {
                        NrAtendimento: at,
                        Tipo: If(cat.Tipo = "EXTERNO_URGENCIA_RELATIVA", "INTERNADO_URGENCIA", cat.Tipo = "EXTERNO_ELETIVO", "INTERNADO_ELETIVO", cat.Tipo),
                        AtualizadoPorNome: gUsuarioNome
                    }
                )
            )
        );
        ${CARREGA.trim()};
        Notify(r.Title & ": internado (atend. " & at & ").", NotificationType.Success)
    )
)`;

function cartao(sfx) {
  const ativo = `ThisItem.Status = "PREVISTO" || ThisItem.Status = "CHEGOU"`;
  const editando = `varCateEditRC = ThisItem.ID`;
  return [
    retangulo(`recCard${sfx}`, 0, 3, "Parent.TemplateWidth", "Parent.TemplateHeight - 6"),
    c(`recFaixa${sfx}`, T.rect, {
      ...pos(0, 3, 6, "Parent.TemplateHeight - 6"),
      Fill: `If(ThisItem.Status = "CHEGOU", corVerde, ThisItem.Status = "PREVISTO" && ThisItem.PrevistoPara < Today(), corVermelho, ThisItem.Status = "PREVISTO", corPrimaria, corCinza)`,
    }),
    lbl(`lblPac${sfx}`, `ThisItem.Title & If(IsBlank(ThisItem.Idade), "", ", " & ThisItem.Idade)`, 14, 6, "Parent.TemplateWidth - 150", 24, {
      FontWeight: "FontWeight.Semibold",
    }),
    lbl(`lblQuando${sfx}`, `Text(ThisItem.PrevistoPara, "ddd dd/mm hh:mm")`, "Parent.TemplateWidth - 140", 6, 130, 24, {
      Align: "Align.Right",
      FontWeight: "FontWeight.Semibold",
      Size: 10,
    }),
    lbl(
      `lblOrigem${sfx}`,
      `ThisItem.ServicoOrigem & If(IsBlank(ThisItem.MunicipioOrigem), "", " (" & ThisItem.MunicipioOrigem & ")") & If(IsBlank(ThisItem.Especialidade), "", " · " & ThisItem.Especialidade) & If(IsBlank(ThisItem.SetorPrevisto), "", " · destino " & ${SIGLA("ThisItem.SetorPrevisto")})`,
      14,
      30,
      "Parent.TemplateWidth - 24",
      20,
      { Size: 9 }
    ),
    lbl(
      `lblMotivo${sfx}`,
      `"CROSS " & ThisItem.NrFichaCROSS & " · " & LookUp(tblStatusRecepcao, Codigo = ThisItem.Status, Value) & If(IsBlank(ThisItem.Motivo), "", " · " & ThisItem.Motivo)`,
      14,
      50,
      "Parent.TemplateWidth - 24",
      20,
      { Size: 9, Color: "corTextoSuave" }
    ),
    // cateterismo
    alternador(
      `btnCate${sfx}`,
      `If(ThisItem.PrecisaCateterismo, "✓ Cateterismo " & Text(ThisItem.DataCateterismo, "dd/mm hh:mm"), "Cateterismo?")`,
      "ThisItem.PrecisaCateterismo",
      `If(ThisItem.PrecisaCateterismo, Set(varCateEditRC, If(${editando}, Blank(), ThisItem.ID)), Set(varCateEditRC, ThisItem.ID))`,
      14,
      74,
      200,
      30,
      { Size: 9, DisplayMode: `If(gEhNIR && (${ativo}), DisplayMode.Edit, DisplayMode.View)` }
    ),
    datepicker(`dpCate${sfx}`, "Coalesce(ThisItem.DataCateterismo, ThisItem.PrevistoPara)", 220, 72, 130, { Visible: editando }),
    entrada(`txtHoraCate${sfx}`, 356, 72, 64, 34, {
      Default: `If(IsBlank(ThisItem.DataCateterismo), "08:00", Text(ThisItem.DataCateterismo, "hh:mm"))`,
      Visible: editando,
    }),
    dropdown(`drpTipoCate${sfx}`, `Filter(tblTiposCate, !Internado)`, 426, 72, 170, {
      Size: 9,
      Default: `Coalesce(LookUp(tblTiposCate, Codigo = ThisItem.TipoCateterismo, Value), "Externo Eletivo")`,
      Visible: editando,
    }),
    botao(`btnSalvarCate${sfx}`, '"Agendar"', SALVAR_CATE(sfx), 602, 72, 84, 34, { Size: 9, Visible: editando }),
    botaoSec(`btnDesmarcarCate${sfx}`, '"Desmarcar"', DESMARCAR_CATE, 692, 72, 92, 34, {
      Size: 9,
      Visible: `${editando} && ThisItem.PrecisaCateterismo`,
    }),
    // desfechos
    botaoSec(`btnChegou${sfx}`, '"Chegou"', DESFECHO("CHEGOU", ", ChegadaEm: Now()", false, "chegada registrada"), 14, 112, 76, 30, {
      Size: 9,
      Visible: `gEhNIR && ThisItem.Status = "PREVISTO" && !(${editando})`,
    }),
    entrada(`txtAtend${sfx}`, 96, 112, 96, 30, { HintText: '"Atendimento"', Size: 9, Visible: `gEhNIR && (${ativo}) && !(${editando})` }),
    botao(`btnInternado${sfx}`, '"Internado"', INTERNAR(sfx), 196, 112, 82, 30, { Size: 9, Visible: `gEhNIR && (${ativo}) && !(${editando})` }),
    botaoSec(`btnRetornou${sfx}`, '"Retornou à origem"', DESFECHO("RETORNOU_ORIGEM", ", DesfechoEm: Now()", false, "avaliado e retornou à origem"), 284, 112, 128, 30, {
      Size: 9,
      Visible: `gEhNIR && (${ativo}) && !(${editando})`,
    }),
    botaoSec(`btnNaoVeio${sfx}`, '"Não veio"', DESFECHO("NAO_COMPARECEU", ", DesfechoEm: Now()", true, "não compareceu"), 418, 112, 80, 30, {
      Size: 9,
      Visible: `gEhNIR && ThisItem.Status = "PREVISTO" && !(${editando})`,
    }),
    botaoSec(`btnCancelar${sfx}`, '"Cancelar"', DESFECHO("CANCELADO", ", DesfechoEm: Now()", true, "recepção cancelada"), 504, 112, 80, 30, {
      Size: 9,
      Color: "corVermelho",
      BorderColor: "corVermelho",
      HoverColor: "corVermelho",
      Visible: `gEhNIR && (${ativo}) && !(${editando})`,
    }),
    botaoSec(`btnEditar${sfx}`, '"Editar"', "Set(varEditRC, ThisItem); Set(varFormRecep, true)", "Parent.TemplateWidth - 84", 112, 74, 30, {
      Size: 9,
      Visible: `gEhNIR && !(${editando})`,
    }),
  ];
}

const SALVAR = `
With(
    {quando: ${DATA_HORA("dpPrevRC", "txtHoraRC").trim()}},
    If(
        IsBlank(Trim(txtPacRC.Text)),
        Notify("Informe o nome do paciente.", NotificationType.Warning),
        IsBlank(drpSecaoRC.Selected.Codigo),
        Notify("Escolha a seção (ambulatorial ou eletiva).", NotificationType.Warning),
        IsBlank(dpPrevRC.SelectedDate),
        Notify("Informe a data prevista de chegada.", NotificationType.Warning),
        Patch(
            Recepcoes,
            If(IsBlank(varEditRC), Defaults(Recepcoes), LookUp(Recepcoes, ID = varEditRC.ID)),
            {
                Title: Trim(txtPacRC.Text),
                Idade: txtIdadeRC.Text,
                Sexo: txtSexoRC.Text,
                CNS: txtCnsRC.Text,
                NrFichaCROSS: txtFichaRC.Text,
                Secao: drpSecaoRC.Selected.Codigo,
                ServicoOrigem: txtOrigemRC.Text,
                MunicipioOrigem: txtMunicipioRC.Text,
                Especialidade: txtEspRC.Text,
                Motivo: txtMotivoRC.Text,
                PrevistoPara: quando,
                SetorPrevisto: drpSetorPrevRC.Selected.Codigo,
                Observacao: txtObsRC.Text,
                Status: If(IsBlank(varEditRC), "PREVISTO", varEditRC.Status),
                PrecisaCateterismo: If(IsBlank(varEditRC), false, varEditRC.PrecisaCateterismo),
                RegistradoPorNome: If(IsBlank(varEditRC), gUsuarioNome, varEditRC.RegistradoPorNome),
                AtualizadoPorNome: gUsuarioNome
            }
        );
        ${CARREGA.trim()};
        Set(varFormRecep, false);
        Set(varEditRC, Blank());
        Notify("Paciente salvo na Previsão de Recepção.", NotificationType.Success)
    )
)`;

const ABAS = [
  ["HOJE", "Hoje"],
  ["AMANHA", "Amanhã"],
  ["PROXIMOS", "Próximos dias"],
  ["ATRASADOS", "Atrasados"],
  ["HIST", "Desfechos 30 d"],
];

export function telaRecepcao() {
  const topo = 172;
  const formulario = janela("conFormRC", "varFormRecep", 800, 560, [
    titulo("lblFormTitRC", `If(IsBlank(varEditRC), "Novo paciente aceito via CROSS", "Editar · " & varEditRC.Title)`, 16, 10, 600, 26),
    rotulo("lblFPacRC", '"Paciente"', 16, 46, 420),
    entrada("txtPacRC", 16, 64, 420, 36, { Default: "varEditRC.Title" }),
    rotulo("lblFIdadeRC", '"Idade"', 448, 46, 100),
    entrada("txtIdadeRC", 448, 64, 100, 36, { Default: "varEditRC.Idade" }),
    rotulo("lblFSexoRC", '"Sexo"', 560, 46, 80),
    entrada("txtSexoRC", 560, 64, 80, 36, { Default: "varEditRC.Sexo" }),
    rotulo("lblFCnsRC", '"CNS"', 652, 46, 132),
    entrada("txtCnsRC", 652, 64, 132, 36, { Default: "varEditRC.CNS" }),
    rotulo("lblFFichaRC", '"Nº da ficha CROSS"', 16, 106, 200),
    entrada("txtFichaRC", 16, 124, 200, 36, { Default: "varEditRC.NrFichaCROSS" }),
    rotulo("lblFSecaoRC", '"Seção"', 228, 106, 200),
    dropdown("drpSecaoRC", "tblSecoesRecepcao", 228, 124, 200, {
      AllowEmptySelection: true,
      Default: `LookUp(tblSecoesRecepcao, Codigo = varEditRC.Secao, Value)`,
    }),
    rotulo("lblFEspRC", '"Especialidade"', 440, 106, 344),
    entrada("txtEspRC", 440, 124, 344, 36, { Default: "varEditRC.Especialidade" }),
    rotulo("lblFOrigemRC", '"Serviço de origem"', 16, 166, 400),
    entrada("txtOrigemRC", 16, 184, 420, 36, { Default: "varEditRC.ServicoOrigem" }),
    rotulo("lblFMunicipioRC", '"Município"', 448, 166, 336),
    entrada("txtMunicipioRC", 448, 184, 336, 36, { Default: "varEditRC.MunicipioOrigem" }),
    rotulo("lblFPrevRC", '"Chegada prevista"', 16, 226, 200),
    datepicker("dpPrevRC", "Coalesce(varEditRC.PrevistoPara, Today())", 16, 244, 200),
    rotulo("lblFHoraRC", '"Hora (hh:mm)"', 228, 226, 120),
    entrada("txtHoraRC", 228, 244, 120, 36, { Default: `If(IsBlank(varEditRC), "08:00", Text(varEditRC.PrevistoPara, "hh:mm"))` }),
    rotulo("lblFSetorRC", '"Setor previsto"', 360, 226, 300),
    dropdown(
      "drpSetorPrevRC",
      "ForAll(Filter(colSetores, Ativo) As s, {Value: s.Title, Codigo: s.Codigo})",
      360,
      244,
      424,
      { AllowEmptySelection: true, Default: "LookUp(colSetores, Codigo = varEditRC.SetorPrevisto, Title)" }
    ),
    rotulo("lblFMotivoRC", '"Motivo / diagnóstico"', 16, 286, 500),
    entrada("txtMotivoRC", 16, 304, 768, 70, { Mode: "TextMode.MultiLine", Default: "varEditRC.Motivo" }),
    rotulo("lblFObsRC", '"Observação"', 16, 380, 500),
    entrada("txtObsRC", 16, 398, 768, 70, { Mode: "TextMode.MultiLine", Default: "varEditRC.Observacao" }),
    lbl(
      "lblFCateDicaRC",
      '"O cateterismo é marcado no próprio cartão do paciente (botão Cateterismo?), depois de salvar."',
      16,
      470,
      768,
      22,
      { Size: 9, Color: "corTextoSuave" }
    ),
    botao("btnSalvarRC", '"Salvar"', SALVAR, 16, 500, 160, 40),
    botaoSec("btnFecharFormRC", '"Fechar"', "Set(varFormRecep, false); Set(varEditRC, Blank())", 188, 500, 120, 40),
  ]);

  const coluna = (secao, rotulo, sfx, x) => [
    titulo(`lblSec${sfx}`, `"${rotulo} (" & CountRows(gal${sfx}.AllItems) & ")"`, x, topo + 46, "Parent.Width / 2 - 30", 26),
    galeria(`gal${sfx}`, ITENS(secao), x, topo + 74, "Parent.Width / 2 - 30", `Parent.Height - ${topo + 94}`, 152, cartao(sfx)),
  ];

  return telaManual(
    "scrRecepcao",
    "RC",
    "RECEPCAO",
    '"Previsão de Recepção · CROSS"',
    ATUALIZA,
    [
      html("htmlKpisRC", HTML_KPIS, 20, 66, "Parent.Width - 40", 96),
      ...ABAS.map(([cod, rot], i) =>
        alternador(`btnAba${cod}RC`, `"${rot}"`, `varAbaRecep = "${cod}"`, `Set(varAbaRecep, "${cod}")`, 20 + i * 140, topo, 134, 36)
      ),
      botao("btnNovoRC", '"+ Novo paciente CROSS"', "Set(varEditRC, Blank()); Set(varFormRecep, true)", "Parent.Width - 230", topo, 210, 36, {
        Visible: "gEhNIR",
      }),
      ...coluna("AMBULATORIAL", "Ambulatoriais", "AmbRC", 20),
      ...coluna("ELETIVA", "Eletivas", "EletRC", "Parent.Width / 2 + 10"),
      formulario,
    ],
    `If(IsBlank(varAbaRecep), Set(varAbaRecep, "PROXIMOS")); Set(varFormRecep, false); Set(varEditRC, Blank()); Set(varCateEditRC, Blank())`
  );
}
