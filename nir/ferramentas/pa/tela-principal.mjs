import {
  ATUALIZA,
  CARD,
  COR_SLA,
  CRONO,
  SIGLA,
  SVG_ROTINA,
  T,
  TEXTO_FALTAM,
  botaoSec,
  c,
  cabecalho,
  galeria,
  html,
  imagem,
  lateral,
  lbl,
  linha,
  minutosTexto,
  pos,
  retangulo,
  rolagem,
  tela,
  timers,
  titulo,
} from "./base.mjs";
import { CARREGA_METAS } from "./tela-metas.mjs";

// =========================================================================
// TELA 1 — PRINCIPAL
// =========================================================================
const HTML_KPIS = `
With(
    {
        psCod: Filter(colSetores, Grupo = "PS").Codigo,
        utiCod: Filter(colSetores, Grupo = "UTI").Codigo,
        uiCod: Filter(colSetores, Grupo = "UI").Codigo,
        leitos: Sum(Filter(colSetores, Ativo && Grupo <> "PS"), LeitosOperacionais),
        aguard: Filter(colVagasAbertas, Status <> "LEITO_CEDIDO"),
        cedHoje: Filter(colVagas30d, !IsBlank(LeitoCedidoEm) && LeitoCedidoEm >= DateAdd(varDataRef, gHoraInicioDia, TimeUnit.Hours)),
        ced30: Filter(colVagas30d, !IsBlank(MinutosAteCessao))
    },
    With(
        {
            nPS: CountRows(Filter(colInternados, SetorCodigo in psCod)),
            nUTI: CountRows(Filter(colInternados, SetorCodigo in utiCod)),
            nUI: CountRows(Filter(colInternados, SetorCodigo in uiCod)),
            nAguard: CountRows(aguard),
            nCedidos: CountRows(Filter(colVagasAbertas, Status = "LEITO_CEDIDO")),
            nFora: CountRows(Filter(aguard, DateDiff(SolicitadoEm, varRelogio, TimeUnit.Minutes) > Coalesce(SLAMinutos, gSlaPadraoMin))),
            maiorMin: Max(aguard, DateDiff(SolicitadoEm, varRelogio, TimeUnit.Minutes)),
            nPSAguard: CountRows(Filter(aguard, SetorOrigem in psCod)),
            mediaHoje: IfError(Round(Average(cedHoje, MinutosAteCessao), 0), Blank()),
            media30: IfError(Round(Average(ced30, MinutosAteCessao), 0), Blank()),
            nCed30: CountRows(ced30),
            nSla30: CountRows(Filter(ced30, DentroSLA = "SIM"))
        },
        With(
            {ocup: If(leitos > 0, (nUTI + nUI) / leitos, Blank())},
            "<div style='display:flex;flex-wrap:wrap;gap:12px;font-family:Segoe UI,Arial,sans-serif'>" &
            ${CARD("Internados agora", "(nPS + nUTI + nUI)", "hexTexto", `"PS " & nPS & " · UTI " & nUTI & " · UI " & nUI`)} &
            ${CARD("Ocupação UTI + UI", `If(IsBlank(ocup), "–", Text(ocup * 100, "0") & "%")`, `If(Coalesce(ocup, 0) >= 0.95, hexVermelho, Coalesce(ocup, 0) >= 0.85, hexAmarelo, hexTexto)`, `If(leitos > 0, (nUTI + nUI) & " de " & leitos & " leitos", "cadastre os leitos na lista Setores")`)} &
            ${CARD("Aguardando leito", "nAguard", `If(nAguard > 0, hexPrimaria, hexTexto)`, `nCedidos & " leito(s) cedido(s) aguardando transferência"`)} &
            ${CARD("Fora do SLA", "nFora", `If(nFora > 0, hexVermelho, hexVerde)`, `If(nFora > 0, "solicitações acima do SLA", "nenhuma acima do SLA")`)} &
            ${CARD("Maior espera", minutosTexto("maiorMin"), `If(Coalesce(maiorMin, 0) > gSlaPadraoMin, hexVermelho, hexTexto)`, `"desde a solicitação"`)} &
            ${CARD("PS aguardando leito", "nPSAguard", `If(nPSAguard > 0, hexAmarelo, hexTexto)`, `"pacientes do PS/Emergência"`)} &
            ${CARD("Tempo até cessão (hoje)", minutosTexto("mediaHoje"), "hexTexto", `"média 30 dias: " & ${minutosTexto("media30")} & If(nCed30 > 0, " · " & Text(nSla30 / nCed30 * 100, "0") & "% no SLA", "")`)} &
            "</div>"
        )
    )
)`;

const ITENS_CRITICAS = `
FirstN(
    Sort(
        AddColumns(
            Filter(colVagasAbertas, Status <> "LEITO_CEDIDO"),
            PctSLA, DateDiff(SolicitadoEm, varUltimaAtualizacao, TimeUnit.Minutes) / Coalesce(SLAMinutos, gSlaPadraoMin)
        ),
        PctSLA,
        SortOrder.Descending
    ),
    6
)`;

const SVG_DESTINOS = `
With(
    {
        d: Sort(
            AddColumns(
                GroupBy(Filter(colVagasAbertas, Status <> "LEITO_CEDIDO"), SetorDestino, Itens),
                Qtde, CountRows(Itens),
                Fora, CountRows(Filter(Itens, DateDiff(SolicitadoEm, varUltimaAtualizacao, TimeUnit.Minutes) > Coalesce(SLAMinutos, gSlaPadraoMin))),
                SiglaDestino, ${SIGLA("SetorDestino")}
            ),
            Qtde,
            SortOrder.Descending
        )
    },
    With(
        {mx: Max(1, Max(d, Qtde)), n: CountRows(d)},
        "data:image/svg+xml;utf8," & EncodeUrl(
            "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 520 " & Text(Max(1, n) * 30 + 34, "0") & "' font-family='Segoe UI, Arial, sans-serif'>" &
            If(
                n = 0,
                "<text x='260' y='36' font-size='14' text-anchor='middle' fill='" & hexTextoSuave & "'>Nenhuma solicitação aguardando leito</text>",
                Concat(
                    Sequence(n) As i,
                    With(
                        {r: Index(d, i.Value), y: (i.Value - 1) * 30 + 4},
                        "<text x='0' y='" & (y + 15) & "' font-size='13' fill='" & hexTexto & "'>" & r.SiglaDestino & "</text>" &
                        "<rect x='80' y='" & y & "' width='" & Text(360 * r.Qtde / mx, "0") & "' height='20' rx='4' fill='" & hexPrimaria & "'/>" &
                        If(r.Fora > 0, "<rect x='80' y='" & y & "' width='" & Text(360 * r.Fora / mx, "0") & "' height='20' rx='4' fill='" & hexVermelho & "'/>", "") &
                        "<text x='" & Text(88 + 360 * r.Qtde / mx, "0") & "' y='" & (y + 15) & "' font-size='13' fill='" & hexTexto & "'>" & r.Qtde & If(r.Fora > 0, " (" & r.Fora & " fora do SLA)", "") & "</text>"
                    )
                ) &
                "<rect x='80' y='" & Text(n * 30 + 14, "0") & "' width='10' height='10' fill='" & hexPrimaria & "'/>" &
                "<text x='96' y='" & Text(n * 30 + 23, "0") & "' font-size='11' fill='" & hexTextoSuave & "'>dentro do SLA</text>" &
                "<rect x='190' y='" & Text(n * 30 + 14, "0") & "' width='10' height='10' fill='" & hexVermelho & "'/>" &
                "<text x='206' y='" & Text(n * 30 + 23, "0") & "' font-size='11' fill='" & hexTextoSuave & "'>fora do SLA</text>"
            ) &
            "</svg>"
        )
    )
)`;

const ITENS_SETORES = `
AddColumns(
    Filter(colSetores, Ativo),
    Internados, CountRows(Filter(colInternados, SetorCodigo = Codigo)),
    Saindo, CountRows(Filter(colVagasAbertas, SetorOrigem = Codigo)),
    Entrando, CountRows(Filter(colVagasAbertas, SetorDestino = Codigo)),
    Perm15, CountRows(Filter(colInternados, SetorCodigo = Codigo && !IsBlank(DataInternacao) && DateDiff(DataInternacao, Today(), TimeUnit.Days) >= gDiasPermanencia))
)`;

const SVG_CARD_SETOR = `
With(
    {occ: If(ThisItem.LeitosOperacionais > 0, ThisItem.Internados / ThisItem.LeitosOperacionais, Blank())},
    "data:image/svg+xml;utf8," & EncodeUrl(
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 92' font-family='Segoe UI, Arial, sans-serif'>" &
        "<rect x='1' y='1' width='158' height='90' rx='10' fill='#FFFFFF' stroke='" & If(varFiltroSetor = ThisItem.Codigo, hexPrimaria, hexBorda) & "'/>" &
        "<text x='12' y='22' font-size='13' font-weight='600' fill='" & hexTexto & "'>" & ThisItem.Sigla & "</text>" &
        "<text x='148' y='22' font-size='12' text-anchor='end' fill='" & hexTextoSuave & "'>" & If(IsBlank(occ), "", Text(occ * 100, "0") & "%") & "</text>" &
        "<text x='12' y='50' font-size='22' font-weight='600' fill='" & hexTexto & "'>" & ThisItem.Internados &
            "<tspan font-size='11' font-weight='400' fill='" & hexTextoSuave & "'>" & If(ThisItem.LeitosOperacionais > 0, " / " & ThisItem.LeitosOperacionais & " leitos", " pacientes") & "</tspan></text>" &
        "<rect x='12' y='58' width='136' height='6' rx='3' fill='" & hexTrilho & "'/>" &
        "<rect x='12' y='58' width='" & Text(136 * Min(1, Coalesce(occ, 0)), "0") & "' height='6' rx='3' fill='" & If(Coalesce(occ, 0) >= 1, hexVermelho, Coalesce(occ, 0) >= 0.9, hexAmarelo, hexPrimaria) & "'/>" &
        "<text x='12' y='82' font-size='10' fill='" & hexTextoSuave & "'>↑" & ThisItem.Saindo & " saindo · ↓" & ThisItem.Entrando & " entrando · " & ThisItem.Perm15 & " ≥15d</text>" &
        "</svg>"
    )
)`;

const SVG_TENDENCIA = `
With(
    {
        serie: ForAll(
            Sequence(14, 0) As k,
            With(
                {d: DateAdd(Today(), k.Value - 13, TimeUnit.Days)},
                {
                    I: k.Value + 1,
                    Rot: Text(d, "dd/mm"),
                    Intern: Sum(Filter(colCenso14d, ChaveData = Text(d, "yyyy-mm-dd") && Janela = gJanelaReferencia), Pacientes),
                    Sol: CountRows(Filter(colVagas30d, Text(SolicitadoEm, "yyyy-mm-dd") = Text(d, "yyyy-mm-dd")))
                }
            )
        )
    },
    With(
        {mxI: Max(1, Max(serie, Intern)), mxS: Max(1, Max(serie, Sol)), comCenso: Filter(serie, Intern > 0)},
        "data:image/svg+xml;utf8," & EncodeUrl(
            "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1100 200' font-family='Segoe UI, Arial, sans-serif'>" &
            "<text x='0' y='16' font-size='13' font-weight='600' fill='" & hexTexto & "'>Internados (censo da " & Lower(LookUp(tblJanelas, Codigo = gJanelaReferencia, Rotulo)) & ")</text>" &
            "<text x='580' y='16' font-size='13' font-weight='600' fill='" & hexTexto & "'>Solicitações de vaga por dia</text>" &
            "<line x1='20' y1='170' x2='520' y2='170' stroke='" & hexBorda & "'/>" &
            "<line x1='600' y1='170' x2='1100' y2='170' stroke='" & hexBorda & "'/>" &
            If(
                CountRows(comCenso) = 0,
                "<text x='270' y='100' font-size='13' text-anchor='middle' fill='" & hexTextoSuave & "'>Sem censos nos últimos 14 dias</text>",
                "<polyline fill='none' stroke='" & hexPrimaria & "' stroke-width='2.5' points='" &
                    Concat(comCenso, Text(30 + (I - 1) * 37, "0") & "," & Text(170 - 130 * Intern / mxI, "0"), " ") & "'/>" &
                Concat(comCenso, "<circle cx='" & Text(30 + (I - 1) * 37, "0") & "' cy='" & Text(170 - 130 * Intern / mxI, "0") & "' r='3' fill='" & hexPrimaria & "'/>") &
                "<text x='" & Text(30 + (Last(comCenso).I - 1) * 37, "0") & "' y='" & Text(160 - 130 * Last(comCenso).Intern / mxI, "0") & "' font-size='12' font-weight='600' text-anchor='middle' fill='" & hexTexto & "'>" & Last(comCenso).Intern & "</text>"
            ) &
            Concat(
                serie,
                "<rect x='" & Text(608 + (I - 1) * 35, "0") & "' y='" & Text(170 - 130 * Sol / mxS, "0") & "' width='24' height='" & Text(130 * Sol / mxS, "0") & "' rx='3' fill='" & hexPrimaria & "' opacity='0.85'/>" &
                If(Sol > 0, "<text x='" & Text(620 + (I - 1) * 35, "0") & "' y='" & Text(164 - 130 * Sol / mxS, "0") & "' font-size='11' text-anchor='middle' fill='" & hexTexto & "'>" & Sol & "</text>", "")
            ) &
            "<text x='30' y='190' font-size='11' fill='" & hexTextoSuave & "'>" & First(serie).Rot & "</text>" &
            "<text x='511' y='190' font-size='11' text-anchor='end' fill='" & hexTextoSuave & "'>" & Last(serie).Rot & "</text>" &
            "<text x='608' y='190' font-size='11' fill='" & hexTextoSuave & "'>" & First(serie).Rot & "</text>" &
            "<text x='1100' y='190' font-size='11' text-anchor='end' fill='" & hexTextoSuave & "'>" & Last(serie).Rot & "</text>" &
            "</svg>"
        )
    )
)`;

const CARD_OUTRA = (titulo, valor, sub, cor = '"#1A2330"') =>
  `"<div style='flex:1 1 170px;min-width:170px;background:#FFFFFF;border:1px solid #D8DEE6;border-radius:12px;padding:10px 14px;box-sizing:border-box'>" &
        "<div style='font-size:12px;color:#5A6573'>${titulo}</div>" &
        "<div style='font-size:22px;font-weight:600;color:" & ${cor} & "'>" & ${valor} & "</div>" &
        "<div style='font-size:11px;color:#5A6573'>" & ${sub} & "</div>" &
    "</div>"`;

const HTML_OUTRAS = `
With(
    {
        perm: Filter(colInternados, !IsBlank(DataInternacao) && DateDiff(DataInternacao, Today(), TimeUnit.Days) >= gDiasPermanencia),
        altHoje: CountRows(Filter(colInternados, !IsBlank(PrevisaoAlta) && DateDiff(Today(), PrevisaoAlta, TimeUnit.Days) = 0)),
        altAmanha: CountRows(Filter(colInternados, !IsBlank(PrevisaoAlta) && DateDiff(Today(), PrevisaoAlta, TimeUnit.Days) = 1)),
        altVenc: CountRows(Filter(colInternados, !IsBlank(PrevisaoAlta) && PrevisaoAlta < Today())),
        rHoje: CountRows(Filter(colRecep, DateDiff(Today(), PrevistoPara, TimeUnit.Days) = 0)),
        rAmanha: CountRows(Filter(colRecep, DateDiff(Today(), PrevistoPara, TimeUnit.Days) = 1)),
        rAtras: CountRows(Filter(colRecep, PrevistoPara < Today() && Status = "PREVISTO")),
        cHoje: Filter(colCate, ChaveData = Text(Today(), "yyyy-mm-dd") && Status <> "CANCELADO"),
        cAmanha: CountRows(Filter(colCate, ChaveData = Text(DateAdd(Today(), 1, TimeUnit.Days), "yyyy-mm-dd") && (Status = "AGENDADO" || Status = "REMARCADO"))),
        cAguard: CountRows(Filter(colCate, (Status = "AGENDADO" || Status = "REMARCADO") && (Tipo = "INTERNADO_ELETIVO" || Tipo = "INTERNADO_URGENCIA"))),
        t24: Filter(colTransp, Status <> "SAIU" && AgendadoPara <= DateAdd(Now(), 24, TimeUnit.Hours)),
        tRadar: CountRows(Filter(colTransp, Status = "SAIU")),
        mComp: Text(Today(), "yyyy-mm")
    },
    With(
        {
            semPrevPerm: CountRows(Filter(perm, IsBlank(PrevisaoAlta))),
            tInc: CountRows(Filter(t24, (If(ChkAutorizacao, 1, 0) + If(ChkRelatorio, 1, 0) + If(ChkExames, 1, 0) + If(ChkContatoDestino, 1, 0) + If(ChkAgendaConfirmada, 1, 0) + If(ChkAcompanhante, 1, 0) + If(ChkEquipamentos, 1, 0) + If(ChkDocumentos, 1, 0) + If(ChkFamilia, 1, 0)) < 9)),
            mOk: CountRows(Filter(colMetasCad As m, With({v: LookUp(colSerieMetas, Codigo = m.Codigo && Comp = mComp)}, If(IsBlank(v.Valor) || IsBlank(v.Meta), false, m.Sentido = "MAIOR", v.Valor >= v.Meta, v.Valor <= v.Meta)))),
            mComDado: CountRows(Filter(colMetasCad As m, !IsBlank(LookUp(colSerieMetas, Codigo = m.Codigo && Comp = mComp, Valor))))
        },
        "<div style='display:flex;flex-wrap:wrap;gap:12px;font-family:Segoe UI,Arial,sans-serif'>" &
        ${CARD_OUTRA("Permanência ≥ 15 dias", "CountRows(perm)", `CountRows(colTopicosAbertos) & " tópicos em aberto · " & semPrevPerm & " sem previsão"`, `If(semPrevPerm > 0, "#B7791F", "#1A2330")`)} &
        ${CARD_OUTRA("Altas previstas hoje / amanhã", `altHoje & " / " & altAmanha`, `altVenc & " previsão(ões) vencida(s)"`, `If(altVenc > 0, "#C62828", "#1A2330")`)} &
        ${CARD_OUTRA("Recepções CROSS hoje / amanhã", `rHoje & " / " & rAmanha`, `rAtras & " atrasada(s)"`, `If(rAtras > 0, "#C62828", "#1A2330")`)} &
        ${CARD_OUTRA("Cateterismos hoje", "CountRows(cHoje)", `"amanhã: " & cAmanha & " · internados aguardando: " & cAguard`)} &
        ${CARD_OUTRA("Transportes nas próximas 24 h", "CountRows(t24)", `"no radar: " & tRadar & " · checklist incompleto: " & tInc`, `If(tInc > 0, "#B7791F", "#1A2330")`)} &
        ${CARD_OUTRA("Metas do mês", `If(mComDado = 0, "–", mOk & " / " & mComDado)`, `"atingidas entre as metas com dado no mês"`)} &
        "</div>"
    )
)`;

const ATUALIZA_P = ATUALIZA.P.replace(
  "Set(varUltimaAtualizacao, Now())",
  `If(
    varTick = 1 || Mod(varTick, 5) = 0,
    ClearCollect(colTopicosAbertos, Filter(PermanenciaTopicos, Status = "PLANEJADO" || Status = "EM_ANDAMENTO"));
    ClearCollect(colRecep, Filter(Recepcoes, Status = "PREVISTO" || Status = "CHEGOU"));
    ClearCollect(colCate, Filter(Cateterismos, DataHoraExame >= DateAdd(Today(), -30, TimeUnit.Days)));
    ClearCollect(colTransp, Filter(Transportes, Status = "AGENDADO" || Status = "SOLICITADA" || Status = "CONFIRMADA" || Status = "NO_LOCAL" || Status = "SAIU"));
    ${CARREGA_METAS.trim()}
);
Set(varUltimaAtualizacao, Now())`
);

export function telaPrincipal() {
  const conteudo = rolagem("conPrincipal", [
    cabecalho("P", `"Visão geral do NIR"`, [
      botaoSec(
        "btnModoTVP",
        `If(varModoTV, "Sair do modo TV", "Modo TV")`,
        "Set(varModoTV, !varModoTV)",
        "Parent.Width - 260",
        8,
        128,
        36
      ),
    ], ATUALIZA_P),
    linha("conRotinaP", 146, [
      titulo("lblSecRotinaP", '"Rotina de atualização do dia"', 0, 0, 500, 24),
      imagem("imgRotinaP", SVG_ROTINA, 0, 26, "Parent.Width", 96, {
        OnSelect: "If(gEhNIR, Navigate(scrRotina, ScreenTransition.None))",
      }),
      lbl("lblFaltamP", TEXTO_FALTAM, 0, 124, "Parent.Width", 22, { Size: 10, Color: "corTextoSuave" }),
    ]),
    linha("conKpiP", 104, [html("htmlKpisP", HTML_KPIS, 0, 0, "Parent.Width", 104)]),
    linha("conVagasP", 330, [
      retangulo("recCriticasP", 0, 0, "Parent.Width * 0.55 - 7", 330),
      titulo("lblSecCriticasP", '"Aguardando leito: maiores esperas"', 16, 10, 360, 24),
      botaoSec(
        "btnVerVagasP",
        '"Abrir Gestão de Vagas"',
        `Set(varFiltroSetor, "TODOS"); Navigate(scrVagas, ScreenTransition.None)`,
        "Parent.Width * 0.55 - 7 - 196",
        8,
        180,
        30,
        { Size: 10 }
      ),
      galeria(
        "galCriticasP",
        ITENS_CRITICAS,
        8,
        44,
        "Parent.Width * 0.55 - 23",
        280,
        64,
        [
          c("recCorCritP", T.rect, { ...pos(8, 8, 6, 48), Fill: COR_SLA }),
          lbl("lblPacCritP", "ThisItem.Paciente", 24, 6, "Parent.TemplateWidth - 210", 24, {
            FontWeight: "FontWeight.Semibold",
          }),
          lbl(
            "lblRotaCritP",
            `${SIGLA("ThisItem.SetorOrigem")} & " (" & ThisItem.LeitoOrigem & ")  →  " & ${SIGLA("ThisItem.SetorDestino")} & "  ·  " & LookUp(tblCondicoes, Codigo = ThisItem.CondicaoTransporte, Value)`,
            24,
            32,
            "Parent.TemplateWidth - 210",
            22,
            { Size: 10, Color: "corTextoSuave" }
          ),
          lbl("lblCronoCritP", CRONO("ThisItem.SolicitadoEm"), "Parent.TemplateWidth - 180", 4, 168, 32, {
            Size: 18,
            FontWeight: "FontWeight.Semibold",
            Align: "Align.Right",
            Color: COR_SLA,
          }),
          lbl("lblSlaCritP", `"SLA " & Coalesce(ThisItem.SLAMinutos, gSlaPadraoMin) & " min"`, "Parent.TemplateWidth - 180", 36, 168, 20, {
            Size: 9,
            Align: "Align.Right",
            Color: "corTextoSuave",
          }),
          c("recSepCritP", T.rect, { ...pos(8, 63, "Parent.TemplateWidth - 16", 1), Fill: "corBorda" }),
        ],
        { OnSelect: "Navigate(scrVagas, ScreenTransition.None)" }
      ),
      retangulo("recDestinosP", "Parent.Width * 0.55 + 7", 0, "Parent.Width * 0.45 - 7", 330),
      titulo("lblSecDestinosP", '"Aguardando por setor de destino"', "Parent.Width * 0.55 + 23", 10, 360, 24),
      imagem("imgDestinosP", SVG_DESTINOS, "Parent.Width * 0.55 + 23", 44, "Parent.Width * 0.45 - 39", 276, {
        ImagePosition: "ImagePosition.TopLeft",
      }),
    ]),
    linha("conSetoresP", 254, [
      titulo("lblSecSetoresP", '"Setores (clique para abrir a Gestão de Vagas do setor)"', 0, 0, 600, 24),
      galeria(
        "galSetoresP",
        ITENS_SETORES,
        0,
        28,
        "Parent.Width",
        224,
        104,
        [
          imagem("imgCardSetorP", SVG_CARD_SETOR, 4, 4, "Parent.TemplateWidth - 8", "Parent.TemplateHeight - 8", {
            OnSelect: "Select(Parent)",
          }),
        ],
        {
          WrapCount: 7,
          ShowScrollbar: false,
          OnSelect: "Set(varFiltroSetor, ThisItem.Codigo); Navigate(scrVagas, ScreenTransition.None)",
        }
      ),
    ]),
    linha("conTendenciaP", 236, [
      retangulo("recTendenciaP", 0, 0, "Parent.Width", 236),
      titulo("lblSecTendenciaP", '"Tendência dos últimos 14 dias"', 16, 10, 500, 24),
      imagem("imgTendenciaP", SVG_TENDENCIA, 16, 40, "Parent.Width - 32", 188),
    ]),
    linha("conFasesP", 140, [
      titulo("lblSecFasesP", '"Demais guias"', 0, 0, 500, 24),
      html("htmlFasesP", HTML_OUTRAS, 0, 28, "Parent.Width", 110),
    ]),
  ]);

  return tela(
    "scrPrincipal",
    { Fill: "corFundo", OnVisible: "Select(btnAtualizarP)" },
    [...lateral("P", "PRINCIPAL"), conteudo, ...timers("P")]
  );
}

