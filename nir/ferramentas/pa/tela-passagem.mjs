// Guia: Passagem de Plantão do NIR (sufixo PP)
import * as B from "./base.mjs";
const { lbl, titulo, botao, botaoSec, retangulo, entrada, galeria, c, T, pos, SIGLA, CRONO, COR_SLA, CARREGA_VAGAS_ABERTAS, alternador, linha, telaRolagem, janela, rotulo } = B;

const H = "DateAdd(varUltimaAtualizacao, gHorizontePassagemH, TimeUnit.Hours)";

const ATUALIZA = `
Refresh(Internacoes);
Refresh(SolicitacoesVaga);
Refresh(Recepcoes);
Refresh(Cateterismos);
Refresh(Transportes);
Refresh(PassagensPlantao);
ClearCollect(colInternados, Filter(Internacoes, Status = "INTERNADO"));
${CARREGA_VAGAS_ABERTAS};
ClearCollect(colRecep, Filter(Recepcoes, Status = "PREVISTO" || Status = "CHEGOU"));
ClearCollect(colCate, Filter(Cateterismos, DataHoraExame >= DateAdd(Today(), -30, TimeUnit.Days)));
ClearCollect(
    colTransp,
    Filter(Transportes, Status = "AGENDADO" || Status = "SOLICITADA" || Status = "CONFIRMADA" || Status = "NO_LOCAL" || Status = "SAIU")
);
ClearCollect(colPassagens, FirstN(Sort(PassagensPlantao, IniciadaEm, SortOrder.Descending), 30));
Set(varTurnoAtual, If(Hour(Now()) >= 7 && Hour(Now()) < 19, "DIURNO", "NOTURNO"));
Set(varChaveTurno, Text(If(Hour(Now()) < 7, DateAdd(Today(), -1, TimeUnit.Days), Today()), "yyyy-mm-dd") & "|" & varTurnoAtual);
Set(varPassagemAtual, LookUp(colPassagens, Title = varChaveTurno));
Set(varUltimaAtualizacao, Now())`;

const ITENS_PS = `
Sort(
    Filter(
        ForAll(
            Filter(colInternados, SetorCodigo in Filter(colSetores, Grupo = "PS").Codigo) As i,
            With(
                {s: LookUp(colVagasAbertas, Title = i.Title)},
                {
                    Title: i.Title,
                    Paciente: i.Paciente,
                    Leito: i.Leito,
                    SetorCodigo: i.SetorCodigo,
                    SolId: s.ID,
                    Destino: s.SetorDestino,
                    StatusSol: s.Status,
                    Condicao: s.CondicaoTransporte,
                    SolicitadoEm: s.SolicitadoEm,
                    SLAMinutos: s.SLAMinutos,
                    LeitoCedido: s.LeitoCedido
                }
            )
        ),
        varPassagemTodosPS || !IsBlank(SolId)
    ),
    If(IsBlank(SolicitadoEm), "2", "1" & Text(SolicitadoEm, "yyyymmddhhmm")) & Leito
)`;

const ITENS_RECEP = `Sort(Filter(colRecep, PrevistoPara <= ${H}), PrevistoPara)`;
const ITENS_CATE = `Sort(Filter(colCate, (Status = "AGENDADO" || Status = "REMARCADO") && DataHoraExame <= ${H}), DataHoraExame)`;
const ITENS_TRANSP = `Sort(Filter(colTransp, Status = "SAIU" || AgendadoPara <= ${H}), AgendadoPara)`;

const LINHA_PS = `Leito & " · " & Paciente & If(IsBlank(SolId), " · sem solicitação de vaga", " → " & ${SIGLA("Destino")} & " · " & LookUp(tblStatusVaga, Codigo = StatusSol, Value) & " · " & LookUp(tblCondicoes, Codigo = Condicao, Value) & " · aguardando há " & DateDiff(SolicitadoEm, Now(), TimeUnit.Minutes) & " min")`;
const LINHA_RECEP = `Text(PrevistoPara, "dd/mm hh:mm") & " · " & Title & " · " & LookUp(tblSecoesRecepcao, Codigo = Secao, Value) & " · " & ServicoOrigem & " · " & LookUp(tblStatusRecepcao, Codigo = Status, Value) & If(PrecisaCateterismo, " · cateterismo " & Text(DataCateterismo, "dd/mm hh:mm"), "")`;
const LINHA_CATE = `Text(DataHoraExame, "dd/mm hh:mm") & " · " & Title & " · " & LookUp(tblTiposCate, Codigo = Tipo, Value) & If(IsBlank(NrAtendimento), If(IsBlank(ServicoOrigem), "", " · " & ServicoOrigem), " · atend. " & NrAtendimento)`;
const LINHA_TRANSP = `Text(AgendadoPara, "dd/mm hh:mm") & " · " & Title & " → " & Destino & " · " & LookUp(tblStatusTransporte, Codigo = Status, Value)`;

const SNAPSHOT = `
"PASSAGEM DE PLANTÃO DO NIR · " & LookUp(tblTurnos, Codigo = varTurnoAtual, Value) & " · " & Text(Now(), "dd/mm/yyyy hh:mm") & Char(10) &
"Passado por: " & gUsuarioNome & Char(10) & Char(10) &
"1. PS COM VAGA SOLICITADA (" & CountRows(galPSPP.AllItems) & ")" & Char(10) & Concat(galPSPP.AllItems, "- " & ${LINHA_PS}, Char(10)) & Char(10) &
"Obs.: " & txtObsPSPP.Text & Char(10) & Char(10) &
"2. PREVISÃO DE RECEPÇÃO (" & CountRows(galRecepPP.AllItems) & ")" & Char(10) & Concat(galRecepPP.AllItems, "- " & ${LINHA_RECEP}, Char(10)) & Char(10) &
"Obs.: " & txtObsRecepPP.Text & Char(10) & Char(10) &
"3. CATETERISMOS (" & CountRows(galCatePP.AllItems) & ")" & Char(10) & Concat(galCatePP.AllItems, "- " & ${LINHA_CATE}, Char(10)) & Char(10) &
"Obs.: " & txtObsCatePP.Text & Char(10) & Char(10) &
"4. PREVISÃO DE TRANSPORTE (" & CountRows(galTranspPP.AllItems) & ")" & Char(10) & Concat(galTranspPP.AllItems, "- " & ${LINHA_TRANSP}, Char(10)) & Char(10) &
"Obs.: " & txtObsTranspPP.Text & Char(10) & Char(10) &
"OBSERVAÇÕES GERAIS: " & txtObsGeraisPP.Text`;

const REGISTRAR = `
With(
    {snap: ${SNAPSHOT.trim()}},
    Patch(
        PassagensPlantao,
        If(IsBlank(varPassagemAtual), Defaults(PassagensPlantao), LookUp(PassagensPlantao, ID = varPassagemAtual.ID)),
        {
            Title: varChaveTurno,
            ChaveData: First(Split(varChaveTurno, "|")).Value,
            Turno: varTurnoAtual,
            Status: "RASCUNHO",
            PassadoPorEmail: gUsuarioEmail,
            PassadoPorNome: gUsuarioNome,
            IniciadaEm: Now(),
            ObsPS: txtObsPSPP.Text,
            ObsRecepcao: txtObsRecepPP.Text,
            ObsCateterismo: txtObsCatePP.Text,
            ObsTransporte: txtObsTranspPP.Text,
            ObsGerais: txtObsGeraisPP.Text,
            Snapshot: snap
        }
    );
    ClearCollect(colPassagens, FirstN(Sort(PassagensPlantao, IniciadaEm, SortOrder.Descending), 30));
    Set(varPassagemAtual, LookUp(colPassagens, Title = varChaveTurno));
    Notify("Passagem registrada. Quem assume deve clicar em Recebi o plantão.", NotificationType.Success)
)`;

const RECEBI = `
Patch(
    PassagensPlantao,
    LookUp(PassagensPlantao, ID = varPassagemAtual.ID),
    {Status: "CONCLUIDA", RecebidoPorEmail: gUsuarioEmail, RecebidoPorNome: gUsuarioNome, RecebidaEm: Now()}
);
ClearCollect(colPassagens, FirstN(Sort(PassagensPlantao, IniciadaEm, SortOrder.Descending), 30));
Set(varPassagemAtual, LookUp(colPassagens, Title = varChaveTurno));
Notify("Plantão recebido por " & gUsuarioNome & ".", NotificationType.Success)`;

function secao(nome, num, rotuloTexto, origem, itens, alturaItem, filhos, campoObs, ctlObs, extrasCab = []) {
  return linha(`con${nome}PP`, 330, [
    retangulo(`rec${nome}PP`, 0, 0, "Parent.Width", 330),
    titulo(`lblSec${nome}PP`, `"${num}. ${rotuloTexto} (" & CountRows(gal${nome}PP.AllItems) & ")"`, 16, 8, 640, 26),
    lbl(`lblOrigem${nome}PP`, `"${origem}"`, 16, 32, 640, 18, { Size: 9, Color: "corTextoSuave" }),
    ...extrasCab,
    galeria(`gal${nome}PP`, itens, 16, 56, "Parent.Width * 0.62 - 24", 264, alturaItem, filhos),
    lbl(`lblVazio${nome}PP`, '"Nada para o próximo plantão nesta seção."', 16, 60, 400, 26, {
      Color: "corTextoSuave",
      Size: 10,
      Visible: `CountRows(gal${nome}PP.AllItems) = 0`,
    }),
    rotulo(`lblObs${nome}PP`, '"Observações desta seção"', "Parent.Width * 0.62", 56, 300),
    entrada(ctlObs, "Parent.Width * 0.62", 76, "Parent.Width * 0.38 - 16", 244, {
      Mode: "TextMode.MultiLine",
      Default: `varPassagemAtual.${campoObs}`,
    }),
  ]);
}

const sep = (n) => c(`recSep${n}PP`, T.rect, { ...pos(0, "Parent.TemplateHeight - 1", "Parent.TemplateWidth", 1), Fill: "corBorda" });

export function telaPassagem() {
  const linhas = [
    linha("conStatusPP", 70, [
      retangulo("recStatusPP", 0, 0, "Parent.Width", 70, { Fill: "corPrimariaClara", BorderColor: "corPrimaria" }),
      lbl(
        "lblStatusPP",
        `"Plantão " & LookUp(tblTurnos, Codigo = varTurnoAtual, Value) & " · " & If(
            IsBlank(varPassagemAtual), "passagem ainda não registrada",
            varPassagemAtual.Status = "RASCUNHO", "passagem registrada por " & varPassagemAtual.PassadoPorNome & " às " & Text(varPassagemAtual.IniciadaEm, "hh:mm") & " · aguardando quem assume clicar em Recebi",
            "passagem concluída: " & varPassagemAtual.PassadoPorNome & " → " & varPassagemAtual.RecebidoPorNome & " às " & Text(varPassagemAtual.RecebidaEm, "hh:mm")
        ) & Char(10) & "Mostra o que acontece nas próximas " & gHorizontePassagemH & " h. Tudo vem das outras guias; aqui você só acrescenta observações."`,
        16,
        6,
        "Parent.Width - 32",
        58,
        { Size: 10 }
      ),
    ]),
    secao(
      "PS",
      1,
      "PS com vaga solicitada",
      "Da Gestão de Vagas: PS Geral, PS Oncologia e Emergência",
      ITENS_PS,
      46,
      [
        lbl("lblPS1PP", `ThisItem.Leito & " · " & ThisItem.Paciente`, 0, 2, "Parent.TemplateWidth - 130", 22, { Size: 10, FontWeight: "FontWeight.Semibold" }),
        lbl(
          "lblPS2PP",
          `If(IsBlank(ThisItem.SolId), ${SIGLA("ThisItem.SetorCodigo")} & " · sem solicitação de vaga", ${SIGLA("ThisItem.SetorCodigo")} & " → " & ${SIGLA("ThisItem.Destino")} & " · " & LookUp(tblStatusVaga, Codigo = ThisItem.StatusSol, Value) & If(ThisItem.StatusSol = "LEITO_CEDIDO", " (leito " & ThisItem.LeitoCedido & ")", "") & " · " & LookUp(tblCondicoes, Codigo = ThisItem.Condicao, Value))`,
          0,
          24,
          "Parent.TemplateWidth - 130",
          20,
          { Size: 9, Color: "corTextoSuave" }
        ),
        lbl("lblPSCronoPP", `If(IsBlank(ThisItem.SolId), "", ${CRONO("ThisItem.SolicitadoEm").trim()})`, "Parent.TemplateWidth - 126", 6, 120, 28, {
          Size: 14,
          FontWeight: "FontWeight.Semibold",
          Align: "Align.Right",
          Color: `If(IsBlank(ThisItem.SolId), corTextoSuave, ${COR_SLA.trim()})`,
        }),
        sep("PS"),
      ],
      "ObsPS",
      "txtObsPSPP",
      [
        alternador("btnTodosPSPP", `If(varPassagemTodosPS, "Mostrando todos do PS", "Só com vaga solicitada")`, "varPassagemTodosPS", "Set(varPassagemTodosPS, !varPassagemTodosPS)", "Parent.Width - 236", 8, 220, 32),
      ]
    ),
    secao(
      "Recep",
      2,
      "Previsão de Recepção",
      "Pacientes aceitos via CROSS previstos para chegar (inclui atrasados)",
      ITENS_RECEP,
      46,
      [
        lbl("lblRec1PP", `Text(ThisItem.PrevistoPara, "dd/mm hh:mm") & " · " & ThisItem.Title`, 0, 2, "Parent.TemplateWidth", 22, { Size: 10, FontWeight: "FontWeight.Semibold" }),
        lbl(
          "lblRec2PP",
          `LookUp(tblSecoesRecepcao, Codigo = ThisItem.Secao, Value) & " · " & ThisItem.ServicoOrigem & " · " & LookUp(tblStatusRecepcao, Codigo = ThisItem.Status, Value) & If(ThisItem.PrecisaCateterismo, " · cateterismo " & Text(ThisItem.DataCateterismo, "dd/mm hh:mm"), "")`,
          0,
          24,
          "Parent.TemplateWidth",
          20,
          { Size: 9, Color: `If(ThisItem.Status = "PREVISTO" && ThisItem.PrevistoPara < Now(), corVermelho, corTextoSuave)` }
        ),
        sep("Recep"),
      ],
      "ObsRecepcao",
      "txtObsRecepPP"
    ),
    secao(
      "Cate",
      3,
      "Cateterismos",
      "Agenda de cateterismos até o fim do horizonte (agendados e remarcados)",
      ITENS_CATE,
      46,
      [
        lbl("lblCat1PP", `Text(ThisItem.DataHoraExame, "dd/mm hh:mm") & " · " & ThisItem.Title`, 0, 2, "Parent.TemplateWidth", 22, { Size: 10, FontWeight: "FontWeight.Semibold" }),
        lbl(
          "lblCat2PP",
          `LookUp(tblTiposCate, Codigo = ThisItem.Tipo, Value) & With({i: LookUp(colInternados, Title = ThisItem.NrAtendimento)}, If(IsBlank(i.Title), If(IsBlank(ThisItem.ServicoOrigem), "", " · " & ThisItem.ServicoOrigem), " · " & ${SIGLA("i.SetorCodigo")} & " leito " & i.Leito))`,
          0,
          24,
          "Parent.TemplateWidth",
          20,
          { Size: 9, Color: "ColorValue(LookUp(tblTiposCate, Codigo = ThisItem.Tipo, Hex))" }
        ),
        sep("Cate"),
      ],
      "ObsCateterismo",
      "txtObsCatePP"
    ),
    secao(
      "Transp",
      4,
      "Previsão de transporte",
      "Da guia Ambulâncias: transportes no horizonte e pacientes fora do hospital que podem voltar",
      ITENS_TRANSP,
      46,
      [
        lbl("lblTr1PP", `Text(ThisItem.AgendadoPara, "dd/mm hh:mm") & " · " & ThisItem.Title & " → " & ThisItem.Destino`, 0, 2, "Parent.TemplateWidth", 22, {
          Size: 10,
          FontWeight: "FontWeight.Semibold",
        }),
        lbl(
          "lblTr2PP",
          `LookUp(tblStatusTransporte, Codigo = ThisItem.Status, Value) & " · " & LookUp(tblMotivosTransporte, Codigo = ThisItem.Motivo, Value) & " · checklist " & (If(ThisItem.ChkAutorizacao, 1, 0) + If(ThisItem.ChkRelatorio, 1, 0) + If(ThisItem.ChkExames, 1, 0) + If(ThisItem.ChkContatoDestino, 1, 0) + If(ThisItem.ChkAgendaConfirmada, 1, 0) + If(ThisItem.ChkAcompanhante, 1, 0) + If(ThisItem.ChkEquipamentos, 1, 0) + If(ThisItem.ChkDocumentos, 1, 0) + If(ThisItem.ChkFamilia, 1, 0)) & "/9"`,
          0,
          24,
          "Parent.TemplateWidth",
          20,
          { Size: 9, Color: "corTextoSuave" }
        ),
        sep("Transp"),
      ],
      "ObsTransporte",
      "txtObsTranspPP"
    ),
    linha("conRegistroPP", 230, [
      retangulo("recRegistroPP", 0, 0, "Parent.Width", 230),
      titulo("lblSecRegistroPP", '"Registro da passagem"', 16, 8, 500, 26),
      rotulo("lblObsGeraisPP", '"Observações gerais do plantão"', 16, 40, 400),
      entrada("txtObsGeraisPP", 16, 60, "Parent.Width - 32", 100, { Mode: "TextMode.MultiLine", Default: "varPassagemAtual.ObsGerais" }),
      botao("btnRegistrarPP", `If(IsBlank(varPassagemAtual), "Registrar passagem", "Atualizar passagem registrada")`, REGISTRAR, 16, 174, 260, 40, {
        Visible: "gEhNIR",
        DisplayMode: `If(!IsBlank(varPassagemAtual) && varPassagemAtual.Status = "CONCLUIDA", DisplayMode.Disabled, DisplayMode.Edit)`,
      }),
      botao("btnRecebiPP", '"Recebi o plantão"', RECEBI, 288, 174, 220, 40, {
        Fill: "corVerde",
        HoverFill: "corVerde",
        Visible: `gEhNIR && !IsBlank(varPassagemAtual) && varPassagemAtual.Status = "RASCUNHO" && varPassagemAtual.PassadoPorEmail <> gUsuarioEmail`,
      }),
      lbl(
        "lblRegistroDicaPP",
        '"Quem passa registra; quem assume, logado com a própria conta, clica em Recebi. Uma cópia de tudo fica guardada no histórico."',
        520,
        174,
        "Parent.Width - 536",
        40,
        { Size: 9, Color: "corTextoSuave" }
      ),
    ]),
    linha("conHistPP", 300, [
      retangulo("recHistPP", 0, 0, "Parent.Width", 300),
      titulo("lblSecHistPP", '"Passagens anteriores"', 16, 8, 500, 26),
      galeria(
        "galHistPP",
        "colPassagens",
        16,
        40,
        "Parent.Width - 32",
        252,
        44,
        [
          lbl(
            "lblHist1PP",
            `Text(ThisItem.IniciadaEm, "dd/mm/yyyy") & " · " & LookUp(tblTurnos, Codigo = ThisItem.Turno, Value) & " · " & ThisItem.PassadoPorNome & If(IsBlank(ThisItem.RecebidoPorNome), " (não recebida)", " → " & ThisItem.RecebidoPorNome & " às " & Text(ThisItem.RecebidaEm, "hh:mm"))`,
            0,
            8,
            "Parent.TemplateWidth - 130",
            26,
            { Size: 10 }
          ),
          botaoSec("btnHistVerPP", '"Ver"', "Set(varPassagemVer, ThisItem)", "Parent.TemplateWidth - 110", 6, 100, 32, { Size: 9 }),
          sep("Hist"),
        ]
      ),
    ]),
  ];

  const tela = telaRolagem(
    "scrPassagem",
    "PP",
    "PASSAGEM",
    '"Passagem de Plantão do NIR"',
    ATUALIZA,
    linhas,
    "Set(varPassagemVer, Blank())"
  );
  // janela para ler uma passagem antiga (por cima da tela)
  const ver = janela("conVerPP", "!IsBlank(varPassagemVer)", 820, 600, [
    titulo("lblVerTitPP", `"Passagem de " & Text(varPassagemVer.IniciadaEm, "dd/mm/yyyy hh:mm")`, 16, 10, 640, 26),
    botaoSec("btnVerFecharPP", '"Fechar"', "Set(varPassagemVer, Blank())", 716, 10, 88, 32, { Size: 10 }),
    entrada("txtVerPP", 16, 50, 788, 534, { Mode: "TextMode.MultiLine", Default: "varPassagemVer.Snapshot", DisplayMode: "DisplayMode.View", Size: 10 }),
  ]);
  // a janela entra como último filho da tela (fica por cima)
  return tela.replace(/\n$/, "") + "\n" + B.ser(ver, 6);
}
