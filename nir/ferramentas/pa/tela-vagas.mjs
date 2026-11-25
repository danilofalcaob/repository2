import {
  ATUALIZA,
  CARD,
  CARREGA_VAGAS_ABERTAS,
  COR_SLA,
  CRONO,
  EVENTO,
  SIGLA,
  T,
  botao,
  botaoSec,
  c,
  dropdown,
  entrada,
  galeria,
  html,
  lateral,
  lbl,
  minutosTexto,
  pos,
  retangulo,
  tela,
  timers,
  titulo,
} from "./base.mjs";

// =========================================================================
// TELA 3 — GESTÃO DE VAGAS
// =========================================================================
const ITENS_FILTRO_SETOR = `
Ungroup(
    Table(
        {Grupo: Table({Value: "Todos os setores", Codigo: "TODOS"})},
        {Grupo: ForAll(Filter(colSetores, Ativo) As s, {Value: s.Title, Codigo: s.Codigo})}
    ),
    Grupo
)`;

const ITENS_PACIENTES = `
Sort(
    AddColumns(
        Filter(
            colInternados,
            (varFiltroSetor = "TODOS" || SetorCodigo = varFiltroSetor) &&
            (IsBlank(txtBuscaV.Text) || txtBuscaV.Text in Paciente || txtBuscaV.Text in Title || txtBuscaV.Text in Leito)
        ),
        OrdemSetor, LookUp(colSetores, Codigo = SetorCodigo, Ordem)
    ),
    Text(OrdemSetor, "000") & "|" & Leito
)`;

const SOLICITAR = `
If(
    IsBlank(varPacSel),
    Notify("Escolha um paciente na lista.", NotificationType.Warning),
    IsBlank(drpDestinoV.Selected.Codigo),
    Notify("Escolha o setor de destino.", NotificationType.Warning),
    IsBlank(drpCondicaoV.Selected.Codigo),
    Notify("Informe a condição de transporte.", NotificationType.Warning),
    !IsBlank(LookUp(SolicitacoesVaga, Title = varPacSel.Title && (Status = "SOLICITADA" || Status = "EM_ANALISE" || Status = "LEITO_CEDIDO"), ID)),
    Notify("Este paciente já tem uma solicitação de vaga em aberto.", NotificationType.Warning),
    With(
        {
            sla: Coalesce(LookUp(colSetores, Codigo = drpDestinoV.Selected.Codigo, SLAMinutos), gSlaPadraoMin),
            agora: Now()
        },
        Set(
            varNovaSol,
            Patch(
                SolicitacoesVaga,
                Defaults(SolicitacoesVaga),
                {
                    Title: varPacSel.Title,
                    Paciente: varPacSel.Paciente,
                    SetorOrigem: varPacSel.SetorCodigo,
                    LeitoOrigem: varPacSel.Leito,
                    SetorDestino: drpDestinoV.Selected.Codigo,
                    CondicaoTransporte: drpCondicaoV.Selected.Codigo,
                    Status: "SOLICITADA",
                    SolicitadoEm: agora,
                    SolicitadoPorEmail: gUsuarioEmail,
                    SolicitadoPorNome: gUsuarioNome,
                    SLAMinutos: sla,
                    AlertaNivel: 0,
                    Observacao: txtObsSolV.Text,
                    AtualizadoPorEmail: gUsuarioEmail
                }
            )
        );
        ${EVENTO("SOLICITADA", "varNovaSol.ID", "varPacSel.Title", '""', 'drpDestinoV.Selected.Codigo & " · " & drpCondicaoV.Selected.Codigo', "txtObsSolV.Text").trim()};
        ${CARREGA_VAGAS_ABERTAS};
        Reset(drpDestinoV);
        Reset(drpCondicaoV);
        Reset(txtObsSolV);
        Set(varPacSel, Blank());
        Notify("Solicitação registrada. O cronômetro do SLA começou.", NotificationType.Success)
    )
)`;

const ACAO_VAGA = (novoStatus, campos, obs, depois = "") => `
With(
    {id: ThisItem.ID, atend: ThisItem.Title, antes: ThisItem.Status},
    Patch(SolicitacoesVaga, LookUp(SolicitacoesVaga, ID = id), {Status: "${novoStatus}"${campos}, AtualizadoPorEmail: gUsuarioEmail});
    ${EVENTO(novoStatus, "id", "atend", "antes", `"${novoStatus}"`, obs).trim()};
    ${CARREGA_VAGAS_ABERTAS}${depois}
)`;

const ACAO_CEDIDO = `
With(
    {
        id: ThisItem.ID,
        atend: ThisItem.Title,
        antes: ThisItem.Status,
        leito: Trim(txtLeitoV.Text),
        minutos: DateDiff(ThisItem.SolicitadoEm, Now(), TimeUnit.Minutes),
        sla: Coalesce(ThisItem.SLAMinutos, gSlaPadraoMin)
    },
    If(
        IsBlank(leito),
        Notify("Informe o leito cedido antes de clicar.", NotificationType.Warning),
        Patch(
            SolicitacoesVaga,
            LookUp(SolicitacoesVaga, ID = id),
            {
                Status: "LEITO_CEDIDO",
                LeitoCedidoEm: Now(),
                LeitoCedido: leito,
                MinutosAteCessao: minutos,
                DentroSLA: If(minutos <= sla, "SIM", "NAO"),
                AtualizadoPorEmail: gUsuarioEmail
            }
        );
        ${EVENTO("LEITO_CEDIDO", "id", "atend", "antes", '"LEITO_CEDIDO"', `"Leito " & leito & " · " & minutos & " min (SLA " & sla & " min)"`).trim()};
        ${CARREGA_VAGAS_ABERTAS};
        Notify("Leito cedido em " & minutos & " min" & If(minutos <= sla, " (dentro do SLA).", " (acima do SLA)."), NotificationType.Success)
    )
)`;

const ACAO_CONDICAO = `
If(
    !IsBlank(Self.Selected.Codigo) && Self.Selected.Codigo <> ThisItem.CondicaoTransporte,
    With(
        {id: ThisItem.ID, atend: ThisItem.Title, antes: ThisItem.CondicaoTransporte, depois: Self.Selected.Codigo},
        Patch(SolicitacoesVaga, LookUp(SolicitacoesVaga, ID = id), {CondicaoTransporte: depois, AtualizadoPorEmail: gUsuarioEmail});
        ${EVENTO("CONDICAO", "id", "atend", "antes", "depois", '""').trim()};
        ${CARREGA_VAGAS_ABERTAS}
    )
)`;

const BUSCAR_HIST = `
ClearCollect(
    colHist,
    Filter(SolicitacoesVaga, SolicitadoEm >= dpDeV.SelectedDate && SolicitadoEm < DateAdd(dpAteV.SelectedDate, 1, TimeUnit.Days))
);
ClearCollect(
    colHistF,
    Filter(
        colHist,
        (drpHistOrigemV.Selected.Codigo = "TODOS" || SetorOrigem = drpHistOrigemV.Selected.Codigo) &&
        (drpHistDestinoV.Selected.Codigo = "TODOS" || SetorDestino = drpHistDestinoV.Selected.Codigo) &&
        (drpHistStatusV.Selected.Codigo = "TODOS" || Status = drpHistStatusV.Selected.Codigo)
    )
);
Set(varHistBuscado, true);
If(CountRows(colHist) >= 2000, Notify("O período tem 2.000 solicitações ou mais: reduza o intervalo para ver todas.", NotificationType.Warning))`;

const HTML_HIST = `
With(
    {c: Filter(colHistF, !IsBlank(MinutosAteCessao))},
    With(
        {n: CountRows(colHistF), nc: CountRows(c), ord: Sort(c, MinutosAteCessao)},
        With(
            {
                media: IfError(Round(Average(c, MinutosAteCessao), 0), Blank()),
                mediana: If(nc = 0, Blank(), Index(ord, RoundUp(nc / 2, 0)).MinutosAteCessao),
                nSla: CountRows(Filter(c, DentroSLA = "SIM")),
                nCanc: CountRows(Filter(colHistF, Status = "CANCELADA"))
            },
            "<div style='font-family:Segoe UI,Arial,sans-serif'>" &
            "<div style='display:flex;flex-wrap:wrap;gap:10px'>" &
            ${CARD("Solicitações", "n", "hexTexto", `nCanc & " cancelada(s)"`)} &
            ${CARD("Leitos cedidos", "nc", "hexTexto", `"no período"`)} &
            ${CARD("Tempo médio até cessão", minutosTexto("media"), "hexTexto", `"mediana: " & ${minutosTexto("mediana")}`)} &
            ${CARD("Dentro do SLA", `If(nc = 0, "–", Text(nSla / nc * 100, "0") & "%")`, `If(nc = 0, hexTexto, nSla / nc >= 0.8, hexVerde, hexVermelho)`, `nSla & " de " & nc & " cessões"`)} &
            "</div>" &
            "<table style='width:100%;border-collapse:collapse;margin-top:10px;font-size:12px;color:#1A2330'>" &
            "<tr style='text-align:left;color:#5A6573;border-bottom:1px solid #D8DEE6'><th>Destino</th><th>Solicitações</th><th>Cedidas</th><th>Tempo médio</th><th>No SLA</th></tr>" &
            Concat(
                Sort(
                    AddColumns(
                        GroupBy(colHistF, SetorDestino, Itens),
                        Qt, CountRows(Itens),
                        Ced, CountRows(Filter(Itens, !IsBlank(MinutosAteCessao))),
                        Med, IfError(Average(Filter(Itens, !IsBlank(MinutosAteCessao)), MinutosAteCessao), Blank()),
                        Sla, CountRows(Filter(Itens, DentroSLA = "SIM"))
                    ),
                    Qt,
                    SortOrder.Descending
                ),
                "<tr style='border-bottom:1px solid #EEF1F4'><td>" & ${SIGLA("SetorDestino")} & "</td><td>" & Qt & "</td><td>" & Ced & "</td><td>" &
                If(Ced = 0, "–", Text(Med, "0") & " min") & "</td><td>" & If(Ced = 0, "–", Text(Sla / Ced * 100, "0") & "%") & "</td></tr>"
            ) &
            "</table></div>"
        )
    )
)`;

export function telaVagas() {
  const topoAbas = "If(IsBlank(varPacSel), 64, 238)";
  const conteudo = c(
    "conVagas",
    T.container,
    {
      X: "If(varModoTV, 0, 200)",
      Y: 0,
      Width: "Parent.Width - Self.X",
      Height: "Parent.Height",
      Fill: "corFundo",
    },
    [
      lbl("lblTituloV", '"Gestão de Vagas"', 20, 10, 400, 30, { Size: 18, FontWeight: "FontWeight.Semibold" }),
      lbl(
        "lblRelogioV",
        `Text(varRelogio, "dddd, dd/mm/yyyy · hh:mm:ss") & "   ·   atualizado às " & Text(varUltimaAtualizacao, "hh:mm")`,
        20,
        40,
        620,
        20,
        { Size: 10, Color: "corTextoSuave" }
      ),
      botao("btnAtualizarV", '"Atualizar"', ATUALIZA.V, "Parent.Width - 140", 16, 120, 36),

      // ---------- painel esquerdo: pacientes ----------
      retangulo("recPacientesV", 20, 64, 380, "Parent.Height - 84"),
      titulo("lblSecPacV", '"Pacientes internados"', 34, 72, 300, 26),
      dropdown("drpFiltroSetorV", ITENS_FILTRO_SETOR, 34, 102, 352, {
        Default: `If(varFiltroSetor = "TODOS", "Todos os setores", LookUp(colSetores, Codigo = varFiltroSetor, Title))`,
        OnChange: "Set(varFiltroSetor, Self.Selected.Codigo)",
      }),
      entrada("txtBuscaV", 34, 144, 352, 36, { HintText: '"Buscar paciente, atendimento ou leito"', Default: "varBuscaVagas" }),
      lbl("lblContPacV", `CountRows(galPacientesV.AllItems) & " paciente(s)"`, 34, 184, 352, 20, {
        Size: 9,
        Color: "corTextoSuave",
      }),
      galeria(
        "galPacientesV",
        ITENS_PACIENTES,
        24,
        206,
        372,
        "Parent.Height - 232",
        66,
        [
          c("recSelPacV", T.rect, {
            ...pos(0, 0, 4, "Parent.TemplateHeight"),
            Fill: "corPrimaria",
            Visible: "!IsBlank(varPacSel) && ThisItem.Title = varPacSel.Title",
          }),
          lbl("lblLeitoPacV", "ThisItem.Leito", 10, 8, 74, 24, { FontWeight: "FontWeight.Semibold" }),
          lbl("lblNomePacV", "ThisItem.Paciente", 88, 4, 270, 24, { FontWeight: "FontWeight.Semibold", Size: 10 }),
          lbl(
            "lblInfoPacV",
            `${SIGLA("ThisItem.SetorCodigo")} & If(IsBlank(ThisItem.DataInternacao), "", " · " & DateDiff(ThisItem.DataInternacao, Today(), TimeUnit.Days) & " dias") & If(IsBlank(ThisItem.Medico), "", " · " & ThisItem.Medico)`,
            88,
            26,
            270,
            18,
            { Size: 9, Color: "corTextoSuave" }
          ),
          lbl(
            "lblVagaPacV",
            `With({s: LookUp(colVagasAbertas, Title = ThisItem.Title)}, If(IsBlank(s.ID), "", "● Vaga → " & ${SIGLA("s.SetorDestino")} & " · " & LookUp(tblStatusVaga, Codigo = s.Status, Value)))`,
            88,
            44,
            270,
            18,
            { Size: 9, Color: "corPrimaria", FontWeight: "FontWeight.Semibold" }
          ),
          c("recSepPacV", T.rect, { ...pos(10, 65, "Parent.TemplateWidth - 20", 1), Fill: "corBorda" }),
        ],
        { OnSelect: "Set(varPacSel, ThisItem)" }
      ),

      // ---------- nova solicitação ----------
      c(
        "conNovaV",
        T.container,
        {
          ...pos(416, 64, "Parent.Width - 436", 162),
          Visible: "!IsBlank(varPacSel)",
          Fill: "corCard",
          BorderColor: "corPrimaria",
          BorderThickness: 1,
          RadiusTopLeft: 10,
          RadiusTopRight: 10,
          RadiusBottomLeft: 10,
          RadiusBottomRight: 10,
        },
        [
          titulo("lblNovaTitV", `"Solicitar vaga · " & varPacSel.Paciente`, 16, 8, "Parent.Width - 140", 26),
          lbl(
            "lblNovaInfoV",
            `"Atendimento " & varPacSel.Title & " · " & ${SIGLA("varPacSel.SetorCodigo")} & " leito " & varPacSel.Leito & If(IsBlank(varPacSel.DataInternacao), "", " · " & DateDiff(varPacSel.DataInternacao, Today(), TimeUnit.Days) & " dias de internação")`,
            16,
            34,
            "Parent.Width - 140",
            20,
            { Size: 10, Color: "corTextoSuave" }
          ),
          botaoSec("btnFecharSelV", '"Fechar"', "Set(varPacSel, Blank())", "Parent.Width - 112", 10, 96, 32, { Size: 10 }),
          lbl("lblDestinoV", '"Setor de destino"', 16, 60, 260, 18, { Size: 9, Color: "corTextoSuave" }),
          dropdown(
            "drpDestinoV",
            "ForAll(Filter(colSetores, Ativo && RecebeSolicitacao && Codigo <> varPacSel.SetorCodigo) As s, {Value: s.Title, Codigo: s.Codigo})",
            16,
            78,
            260,
            { AllowEmptySelection: true, Default: "Blank()" }
          ),
          lbl("lblCondV", '"Condição de transporte"', 288, 60, 220, 18, { Size: 9, Color: "corTextoSuave" }),
          dropdown("drpCondicaoV", "tblCondicoes", 288, 78, 220, { AllowEmptySelection: true, Default: "Blank()" }),
          lbl("lblObsSolV", '"Observação (opcional)"', 520, 60, 300, 18, { Size: 9, Color: "corTextoSuave" }),
          entrada("txtObsSolV", 520, 78, "Parent.Width - 536", 36, { HintText: '"Ex.: isolamento de contato"' }),
          botao("btnSolicitarV", '"Solicitar vaga"', SOLICITAR, 16, 120, 200, 34, {
            Visible: "gPodeSolicitar",
            DisplayMode: `If(IsBlank(LookUp(colVagasAbertas, Title = varPacSel.Title, ID)), DisplayMode.Edit, DisplayMode.Disabled)`,
          }),
          lbl(
            "lblJaTemV",
            `With({s: LookUp(colVagasAbertas, Title = varPacSel.Title)}, If(IsBlank(s.ID), If(gPodeSolicitar, "", "Seu perfil é só de visualização."), "Já existe solicitação em aberto para " & ${SIGLA("s.SetorDestino")} & " (" & LookUp(tblStatusVaga, Codigo = s.Status, Value) & ")."))`,
            228,
            124,
            "Parent.Width - 244",
            26,
            { Size: 10, Color: "corAmarelo" }
          ),
        ],
        "ManualLayout"
      ),

      // ---------- abas ----------
      botao(
        "btnAbaAbertasV",
        `"Em aberto (" & CountRows(colVagasAbertas) & ")"`,
        `Set(varAbaVagas, "ABERTAS")`,
        416,
        topoAbas,
        180,
        36,
        {
          Fill: `If(varAbaVagas = "ABERTAS", corPrimaria, Color.White)`,
          Color: `If(varAbaVagas = "ABERTAS", Color.White, corPrimaria)`,
          BorderColor: "corPrimaria",
          BorderThickness: 1,
        }
      ),
      botao("btnAbaHistV", '"Histórico e relatório"', `Set(varAbaVagas, "HIST")`, 604, topoAbas, 200, 36, {
        Fill: `If(varAbaVagas = "HIST", corPrimaria, Color.White)`,
        Color: `If(varAbaVagas = "HIST", Color.White, corPrimaria)`,
        BorderColor: "corPrimaria",
        BorderThickness: 1,
      }),
      lbl(
        "lblResumoAbertasV",
        `With({ag: Filter(colVagasAbertas, Status <> "LEITO_CEDIDO")}, CountRows(ag) & " aguardando leito · " & CountRows(Filter(ag, DateDiff(SolicitadoEm, varRelogio, TimeUnit.Minutes) > Coalesce(SLAMinutos, gSlaPadraoMin))) & " fora do SLA · " & CountRows(Filter(colVagasAbertas, Status = "LEITO_CEDIDO")) & " cedidos aguardando transferência")`,
        816,
        `${topoAbas} + 8`,
        "Parent.Width - 836",
        22,
        { Size: 10, Color: "corTextoSuave", Align: "Align.Right" }
      ),

      // ---------- aba: em aberto ----------
      galeria(
        "galAbertasV",
        `Sort(Filter(colVagasAbertas, varFiltroSetor = "TODOS" || SetorOrigem = varFiltroSetor || SetorDestino = varFiltroSetor), SolicitadoEm, SortOrder.Ascending)`,
        416,
        `${topoAbas} + 44`,
        "Parent.Width - 436",
        `Parent.Height - Self.Y - 20`,
        134,
        [
          retangulo("recCardVagaV", 0, 4, "Parent.TemplateWidth", "Parent.TemplateHeight - 8"),
          c("recCorVagaV", T.rect, {
            ...pos(0, 4, 6, "Parent.TemplateHeight - 8"),
            Fill: `If(ThisItem.Status = "LEITO_CEDIDO", corPrimaria, ${COR_SLA.trim()})`,
          }),
          lbl("lblPacVagaV", `ThisItem.Paciente & "  ·  atend. " & ThisItem.Title`, 16, 8, "Parent.TemplateWidth - 220", 24, {
            FontWeight: "FontWeight.Semibold",
          }),
          lbl(
            "lblRotaVagaV",
            `${SIGLA("ThisItem.SetorOrigem")} & " leito " & ThisItem.LeitoOrigem & "   →   " & ${SIGLA("ThisItem.SetorDestino")} & If(ThisItem.Status = "LEITO_CEDIDO", " · leito " & ThisItem.LeitoCedido, "")`,
            16,
            32,
            "Parent.TemplateWidth - 220",
            22,
            { Size: 10 }
          ),
          lbl(
            "lblPorVagaV",
            `"Solicitado por " & ThisItem.SolicitadoPorNome & " em " & Text(ThisItem.SolicitadoEm, "dd/mm hh:mm") & If(IsBlank(ThisItem.EmAnaliseEm), "", " · em análise às " & Text(ThisItem.EmAnaliseEm, "hh:mm")) & If(IsBlank(ThisItem.Observacao), "", " · " & ThisItem.Observacao)`,
            16,
            54,
            "Parent.TemplateWidth - 220",
            20,
            { Size: 9, Color: "corTextoSuave" }
          ),
          lbl(
            "lblCronoVagaV",
            `If(ThisItem.Status = "LEITO_CEDIDO", ${CRONO("ThisItem.LeitoCedidoEm").trim()}, ${CRONO("ThisItem.SolicitadoEm").trim()})`,
            "Parent.TemplateWidth - 196",
            6,
            184,
            34,
            {
              Size: 20,
              FontWeight: "FontWeight.Semibold",
              Align: "Align.Right",
              Color: `If(ThisItem.Status = "LEITO_CEDIDO", corPrimaria, ${COR_SLA.trim()})`,
            }
          ),
          lbl(
            "lblSlaVagaV",
            `If(
                ThisItem.Status = "LEITO_CEDIDO",
                "cedido em " & ThisItem.MinutosAteCessao & " min · " & If(ThisItem.DentroSLA = "SIM", "dentro do SLA", "acima do SLA"),
                LookUp(tblStatusVaga, Codigo = ThisItem.Status, Value) & " · SLA " & Coalesce(ThisItem.SLAMinutos, gSlaPadraoMin) & " min"
            )`,
            "Parent.TemplateWidth - 236",
            40,
            224,
            20,
            { Size: 9, Align: "Align.Right", Color: "corTextoSuave" }
          ),
          dropdown("drpCondVagaV", "tblCondicoes", 16, 84, 200, {
            Default: "LookUp(tblCondicoes, Codigo = ThisItem.CondicaoTransporte, Value)",
            OnChange: ACAO_CONDICAO,
            DisplayMode: "If(gEhNIR || ThisItem.SolicitadoPorEmail = gUsuarioEmail, DisplayMode.Edit, DisplayMode.View)",
            Size: 10,
            Color: "ColorValue(LookUp(tblCondicoes, Codigo = ThisItem.CondicaoTransporte, Hex))",
          }),
          botaoSec(
            "btnAnaliseV",
            '"Em análise"',
            ACAO_VAGA("EM_ANALISE", ", EmAnaliseEm: Now()", '""'),
            228,
            86,
            96,
            32,
            { Size: 9, Visible: `gEhNIR && ThisItem.Status = "SOLICITADA"` }
          ),
          entrada("txtLeitoV", 330, 86, 76, 32, {
            HintText: '"Leito"',
            Size: 10,
            Visible: `gEhNIR && (ThisItem.Status = "SOLICITADA" || ThisItem.Status = "EM_ANALISE")`,
          }),
          botao("btnCedidoV", '"Leito cedido"', ACAO_CEDIDO, 410, 86, 110, 32, {
            Size: 9,
            Fill: "corVerde",
            HoverFill: "corVerde",
            Visible: `gEhNIR && (ThisItem.Status = "SOLICITADA" || ThisItem.Status = "EM_ANALISE")`,
          }),
          botao(
            "btnConcluirV",
            '"Transferência concluída"',
            ACAO_VAGA("CONCLUIDA", ", ConcluidoEm: Now()", '""'),
            228,
            86,
            200,
            32,
            { Size: 9, Visible: `gEhNIR && ThisItem.Status = "LEITO_CEDIDO"` }
          ),
          dropdown("drpMotivoV", "tblMotivosCancelamento", "Parent.TemplateWidth - 270", 86, 160, {
            Size: 9,
            Visible: `gEhNIR || ThisItem.SolicitadoPorEmail = gUsuarioEmail`,
          }),
          botaoSec(
            "btnCancelarV",
            '"Cancelar"',
            ACAO_VAGA("CANCELADA", ", CanceladoEm: Now(), MotivoCancelamento: drpMotivoV.Selected.Value", "drpMotivoV.Selected.Value"),
            "Parent.TemplateWidth - 104",
            86,
            92,
            32,
            {
              Size: 9,
              Color: "corVermelho",
              BorderColor: "corVermelho",
              HoverColor: "corVermelho",
              Visible: `gEhNIR || ThisItem.SolicitadoPorEmail = gUsuarioEmail`,
            }
          ),
        ],
        { Visible: `varAbaVagas = "ABERTAS"` }
      ),
      lbl("lblSemAbertasV", '"Nenhuma solicitação em aberto para este filtro."', 416, `${topoAbas} + 60`, 500, 30, {
        Color: "corTextoSuave",
        Visible: `varAbaVagas = "ABERTAS" && CountRows(galAbertasV.AllItems) = 0`,
      }),

      // ---------- aba: histórico ----------
      c(
        "conHistV",
        T.container,
        {
          ...pos(416, `${topoAbas} + 44`, "Parent.Width - 436", "Parent.Height - Self.Y - 20"),
          Visible: `varAbaVagas = "HIST"`,
          Fill: "corCard",
          BorderColor: "corBorda",
          BorderThickness: 1,
        },
        [
          lbl("lblDeV", '"De"', 12, 6, 140, 18, { Size: 9, Color: "corTextoSuave" }),
          c("dpDeV", T.datepicker, {
            DefaultDate: "DateAdd(Today(), -7, TimeUnit.Days)",
            ...pos(12, 24, 140, 34),
            Size: 10,
            Format: "DateTimeFormat.ShortDate",
          }),
          lbl("lblAteV", '"Até"', 160, 6, 140, 18, { Size: 9, Color: "corTextoSuave" }),
          c("dpAteV", T.datepicker, { DefaultDate: "Today()", ...pos(160, 24, 140, 34), Size: 10, Format: "DateTimeFormat.ShortDate" }),
          lbl("lblHistOrigemV", '"Origem"', 308, 6, 150, 18, { Size: 9, Color: "corTextoSuave" }),
          dropdown("drpHistOrigemV", ITENS_FILTRO_SETOR, 308, 24, 150, { Size: 10 }),
          lbl("lblHistDestinoV", '"Destino"', 466, 6, 150, 18, { Size: 9, Color: "corTextoSuave" }),
          dropdown("drpHistDestinoV", ITENS_FILTRO_SETOR, 466, 24, 150, { Size: 10 }),
          lbl("lblHistStatusV", '"Status"', 624, 6, 150, 18, { Size: 9, Color: "corTextoSuave" }),
          dropdown(
            "drpHistStatusV",
            `Ungroup(Table({Grupo: Table({Value: "Todos", Codigo: "TODOS"})}, {Grupo: tblStatusVaga}), Grupo)`,
            624,
            24,
            150,
            { Size: 10 }
          ),
          botao("btnBuscarHistV", '"Aplicar"', BUSCAR_HIST, "Parent.Width - 216", 24, 96, 34, { Size: 10 }),
          botaoSec(
            "btnExportarV",
            '"Exportar"',
            `Launch(gUrlSite & "/Lists/SolicitacoesVaga/AllItems.aspx"); Notify("Na lista, use Exportar > Exportar para CSV ou Excel.", NotificationType.Information)`,
            "Parent.Width - 112",
            24,
            100,
            34,
            { Size: 10 }
          ),
          html("htmlHistV", HTML_HIST, 12, 66, "Parent.Width - 24", 200, { Visible: "varHistBuscado" }),
          lbl("lblHistDicaV", '"Escolha o período e clique em Aplicar."', 12, 80, 400, 24, {
            Color: "corTextoSuave",
            Visible: "!varHistBuscado",
          }),
          galeria(
            "galHistV",
            "Sort(colHistF, SolicitadoEm, SortOrder.Descending)",
            12,
            272,
            "Parent.Width - 24",
            "Parent.Height - 284",
            46,
            [
              lbl(
                "lblHist1V",
                `Text(ThisItem.SolicitadoEm, "dd/mm hh:mm") & "  ·  " & ThisItem.Paciente & "  ·  " & ${SIGLA("ThisItem.SetorOrigem")} & " → " & ${SIGLA("ThisItem.SetorDestino")}`,
                0,
                2,
                "Parent.TemplateWidth - 230",
                22,
                { Size: 10, FontWeight: "FontWeight.Semibold" }
              ),
              lbl(
                "lblHist2V",
                `LookUp(tblStatusVaga, Codigo = ThisItem.Status, Value) & If(IsBlank(ThisItem.MinutosAteCessao), "", " · cessão em " & ThisItem.MinutosAteCessao & " min (" & If(ThisItem.DentroSLA = "SIM", "no SLA", "acima do SLA") & ")") & If(IsBlank(ThisItem.MotivoCancelamento), "", " · " & ThisItem.MotivoCancelamento) & " · por " & ThisItem.SolicitadoPorNome`,
                0,
                22,
                "Parent.TemplateWidth - 230",
                20,
                { Size: 9, Color: "corTextoSuave" }
              ),
              botaoSec("btnLogV", '"Ver log"', "Set(varSolSel, ThisItem)", "Parent.TemplateWidth - 100", 6, 92, 32, { Size: 9 }),
              c("recSepHistV", T.rect, { ...pos(0, 45, "Parent.TemplateWidth", 1), Fill: "corBorda" }),
            ]
          ),
        ],
        "ManualLayout"
      ),

      // ---------- janela do log de uma solicitação ----------
      c(
        "conLogV",
        T.container,
        {
          ...pos("(Parent.Width - 640) / 2", 90, 640, 420),
          Visible: "!IsBlank(varSolSel)",
          Fill: "corCard",
          BorderColor: "corPrimaria",
          BorderThickness: 2,
          DropShadow: "DropShadow.Bold",
        },
        [
          titulo("lblLogTitV", `"Log da solicitação · " & varSolSel.Paciente`, 16, 10, 500, 26),
          botaoSec("btnLogFecharV", '"Fechar"', "Set(varSolSel, Blank())", 536, 10, 88, 32, { Size: 10 }),
          galeria(
            "galLogV",
            "Sort(Filter(EventosVaga, SolicitacaoId = varSolSel.ID), Em, SortOrder.Ascending)",
            16,
            50,
            608,
            354,
            48,
            [
              lbl(
                "lblLog1V",
                `Text(ThisItem.Em, "dd/mm/yyyy hh:mm:ss") & "  ·  " & Coalesce(LookUp(tblStatusVaga, Codigo = ThisItem.Title, Value), If(ThisItem.Title = "CONDICAO", "Condição de transporte", ThisItem.Title))`,
                0,
                2,
                608,
                22,
                { Size: 10, FontWeight: "FontWeight.Semibold" }
              ),
              lbl(
                "lblLog2V",
                `ThisItem.PorNome & If(IsBlank(ThisItem.ValorDe), "", " · de " & ThisItem.ValorDe) & If(IsBlank(ThisItem.ValorPara), "", " para " & ThisItem.ValorPara) & If(IsBlank(ThisItem.Observacao), "", " · " & ThisItem.Observacao)`,
                0,
                24,
                608,
                20,
                { Size: 9, Color: "corTextoSuave" }
              ),
            ]
          ),
        ],
        "ManualLayout"
      ),
    ],
    "ManualLayout"
  );

  return tela(
    "scrVagas",
    {
      Fill: "corFundo",
      OnVisible: `Set(varPacSel, Blank()); Set(varSolSel, Blank()); Set(varHistBuscado, false); Select(btnAtualizarV)`,
    },
    [...lateral("V", "VAGAS"), conteudo, ...timers("V")]
  );
}

// ---------------------------------------------------------------------------
