// Guia: Metas (sufixo MT)
import * as B from "./base.mjs";
const { lbl, titulo, botaoSec, retangulo, dropdown, galeria, html, imagem, c, T, pos, linha, telaRolagem } = B;

// série de 12 meses de cada meta: automáticas (IndicadoresDiarios) ou de planilha (MetasValores)
export const CARREGA_METAS = `
ClearCollect(colMetasCad, Filter(Sort(MetasIndicadores, Ordem), Ativo));
ClearCollect(colMetasVal, MetasValores);
ClearCollect(colInd, Filter(IndicadoresDiarios, SetorCodigo = "TODOS" && DataRef >= DateAdd(Today(), -183, TimeUnit.Days)));
Collect(
    colInd,
    Filter(IndicadoresDiarios, SetorCodigo = "TODOS" && DataRef >= DateAdd(Today(), -366, TimeUnit.Days) && DataRef < DateAdd(Today(), -183, TimeUnit.Days))
);
ClearCollect(
    colMeses,
    ForAll(
        Sequence(12, 0) As k,
        With(
            {d: DateAdd(Date(Year(Today()), Month(Today()), 1), k.Value - 11, TimeUnit.Months)},
            {Comp: Text(d, "yyyy-mm"), Rot: Text(d, "mmm/yy"), I: k.Value + 1}
        )
    )
);
ClearCollect(
    colSerieMetas,
    Ungroup(
        ForAll(
            colMetasCad As m,
            {
                Linhas: ForAll(
                    colMeses As mes,
                    With(
                        {f: Filter(colInd, Indicador = m.IndicadorDiario && Left(ChaveData, 7) = mes.Comp)},
                        {
                            Codigo: m.Codigo,
                            Comp: mes.Comp,
                            Rot: mes.Rot,
                            I: mes.I,
                            Valor: If(
                                m.Fonte = "AUTOMATICA",
                                If(CountRows(f) = 0, Blank(), m.Agregacao = "SOMA", Sum(f, Valor), Round(Average(f, Valor), 1)),
                                LookUp(colMetasVal, Codigo = m.Codigo && Competencia = mes.Comp, Realizado)
                            ),
                            Meta: Coalesce(LookUp(colMetasVal, Codigo = m.Codigo && Competencia = mes.Comp, Meta), m.MetaPadrao),
                            Sentido: m.Sentido
                        }
                    )
                )
            }
        ),
        Linhas
    )
)`;

const ATUALIZA = `
Refresh(MetasIndicadores);
Refresh(MetasValores);
Refresh(IndicadoresDiarios);
${CARREGA_METAS.trim()};
Set(varUltimaAtualizacao, Now())`;

const FMT = (e) => `If(${e} = RoundDown(${e}, 0), Text(${e}, "#,##0"), Text(${e}, "#,##0.0"))`;
const PONTO = (campo = "Valor") => `LookUp(colSerieMetas, Codigo = ThisItem.Codigo && Comp = varCompMT, ${campo})`;
const ATINGIU = (v, meta, sentido) => `If(IsBlank(${v}) || IsBlank(${meta}), Blank(), ${sentido} = "MAIOR", ${v} >= ${meta}, ${v} <= ${meta})`;

const SVG_CARD = `
With(
    {
        v: ${PONTO()},
        meta: ${PONTO("Meta")},
        ant: LookUp(colSerieMetas, Codigo = ThisItem.Codigo && Comp = Text(DateAdd(DateValue(varCompMT & "-01"), -1, TimeUnit.Months), "yyyy-mm"), Valor),
        s: Sort(Filter(colSerieMetas, Codigo = ThisItem.Codigo && !IsBlank(Valor)), I)
    },
    With(
        {
            ok: ${ATINGIU("v", "meta", "ThisItem.Sentido")},
            mx: Max(1, Max(s, Valor), Coalesce(meta, 0)) * 1.1,
            mn: Min(0, Min(s, Valor))
        },
        "data:image/svg+xml;utf8," & EncodeUrl(
            "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 280 150' font-family='Segoe UI, Arial, sans-serif'>" &
            "<rect x='1' y='1' width='278' height='148' rx='10' fill='#FFFFFF' stroke='" & If(varMetaSel = ThisItem.Codigo, hexPrimaria, hexBorda) & "'/>" &
            "<text x='14' y='24' font-size='12' font-weight='600' fill='" & hexTexto & "'>" & Left(ThisItem.Title, 38) & "</text>" &
            "<text x='14' y='58' font-size='26' font-weight='600' fill='" & hexTexto & "'>" & If(IsBlank(v), "–", ${FMT("v")}) & "<tspan font-size='12' font-weight='400' fill='" & hexTextoSuave & "'> " & ThisItem.Unidade & "</tspan></text>" &
            "<text x='266' y='58' font-size='12' font-weight='600' text-anchor='end' fill='" & If(IsBlank(ok), hexCinza, ok, hexVerde, hexVermelho) & "'>" & If(IsBlank(ok), "sem dado", ok, "● meta atingida", "● fora da meta") & "</text>" &
            "<text x='14' y='78' font-size='11' fill='" & hexTextoSuave & "'>meta " & If(ThisItem.Sentido = "MAIOR", "≥ ", "≤ ") & If(IsBlank(meta), "–", ${FMT("meta")}) & If(IsBlank(ant) || IsBlank(v), "", " · mês anterior " & ${FMT("ant")} & If(v > ant, " ▲", v < ant, " ▼", " =")) & " · " & If(ThisItem.Fonte = "AUTOMATICA", "automática", "planilha") & "</text>" &
            If(
                CountRows(s) < 2,
                "<text x='14' y='124' font-size='11' fill='" & hexTextoSuave & "'>histórico insuficiente para o gráfico</text>",
                If(IsBlank(meta), "", "<line x1='14' x2='266' y1='" & Text(140 - 44 * (meta - mn) / (mx - mn), "0") & "' y2='" & Text(140 - 44 * (meta - mn) / (mx - mn), "0") & "' stroke='" & hexCinza & "' stroke-dasharray='4 3'/>") &
                "<polyline fill='none' stroke='" & hexPrimaria & "' stroke-width='2' points='" &
                Concat(s, Text(14 + (I - 1) * 22, "0") & "," & Text(140 - 44 * (Valor - mn) / (mx - mn), "0"), " ") & "'/>" &
                "<circle cx='" & Text(14 + (Last(s).I - 1) * 22, "0") & "' cy='" & Text(140 - 44 * (Last(s).Valor - mn) / (mx - mn), "0") & "' r='3.5' fill='" & hexPrimaria & "'/>"
            ) &
            "</svg>"
        )
    )
)`;

const SVG_DETALHE = `
With(
    {m: LookUp(colMetasCad, Codigo = varMetaSel), s: Sort(Filter(colSerieMetas, Codigo = varMetaSel), I)},
    With(
        {
            mx: Max(1, Max(s, Valor), Max(s, Meta)) * 1.15,
            vals: Filter(s, !IsBlank(Valor))
        },
        "data:image/svg+xml;utf8," & EncodeUrl(
            "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1100 260' font-family='Segoe UI, Arial, sans-serif'>" &
            "<line x1='40' x2='1090' y1='220' y2='220' stroke='" & hexBorda & "'/>" &
            Concat(
                s,
                "<text x='" & Text(40 + (I - 1) * 92 + 30, "0") & "' y='240' font-size='11' text-anchor='middle' fill='" & hexTextoSuave & "'>" & Rot & "</text>" &
                If(
                    IsBlank(Valor), "",
                    "<rect x='" & Text(40 + (I - 1) * 92 + 10, "0") & "' y='" & Text(220 - 190 * Valor / mx, "0") & "' width='40' height='" & Text(190 * Valor / mx, "0") & "' rx='4' fill='" &
                    If(If(m.Sentido = "MAIOR", Valor >= Meta, Valor <= Meta), hexPrimaria, hexVermelho) & "'/>" &
                    "<text x='" & Text(40 + (I - 1) * 92 + 30, "0") & "' y='" & Text(214 - 190 * Valor / mx, "0") & "' font-size='12' font-weight='600' text-anchor='middle' fill='" & hexTexto & "'>" & ${FMT("Valor")} & "</text>"
                ) &
                If(IsBlank(Meta), "", "<line x1='" & Text(40 + (I - 1) * 92 + 4, "0") & "' x2='" & Text(40 + (I - 1) * 92 + 56, "0") & "' y1='" & Text(220 - 190 * Meta / mx, "0") & "' y2='" & Text(220 - 190 * Meta / mx, "0") & "' stroke='" & hexTexto & "' stroke-width='2' stroke-dasharray='5 3'/>")
            ) &
            "<rect x='40' y='4' width='12' height='12' fill='" & hexPrimaria & "'/><text x='58' y='14' font-size='11' fill='" & hexTextoSuave & "'>dentro da meta</text>" &
            "<rect x='170' y='4' width='12' height='12' fill='" & hexVermelho & "'/><text x='188' y='14' font-size='11' fill='" & hexTextoSuave & "'>fora da meta</text>" &
            "<line x1='290' x2='312' y1='10' y2='10' stroke='" & hexTexto & "' stroke-width='2' stroke-dasharray='5 3'/><text x='318' y='14' font-size='11' fill='" & hexTextoSuave & "'>meta do mês</text>" &
            "</svg>"
        )
    )
)`;

const HTML_TENDENCIA = `
With(
    {m: LookUp(colMetasCad, Codigo = varMetaSel), s: Sort(Filter(colSerieMetas, Codigo = varMetaSel && !IsBlank(Valor)), I)},
    With(
        {
            ult3: Average(LastN(s, 3), Valor),
            ant3: Average(FirstN(LastN(s, 6), If(CountRows(s) >= 6, 3, Max(0, CountRows(s) - 3))), Valor)
        },
        "<div style='font-family:Segoe UI,Arial,sans-serif;font-size:13px;color:#1A2330'>" &
        "<b>" & m.Title & "</b> · " & If(m.Sentido = "MAIOR", "quanto maior, melhor", "quanto menor, melhor") & " · fonte: " & If(m.Fonte = "AUTOMATICA", "calculada pelo app (" & m.IndicadorDiario & ")", "planilha importada na Rotina de Atualização") &
        "<br/>" & If(
            CountRows(s) < 4, "Tendência: ainda há poucos meses com dados.",
            "Tendência (média dos últimos 3 meses × 3 anteriores): " & IfError(${FMT("ult3")}, "–") & " × " & IfError(${FMT("ant3")}, "–") & " → " &
            IfError(If((ult3 > ant3 && m.Sentido = "MAIOR") || (ult3 < ant3 && m.Sentido = "MENOR"), "<span style='color:#1E8E3E'>melhorando</span>", ult3 = ant3, "estável", "<span style='color:#C62828'>piorando</span>"), "–")
        ) &
        If(IsBlank(m.Descricao), "", "<br/><span style='color:#5A6573'>" & m.Descricao & "</span>") &
        "</div>"
    )
)`;

export function telaMetas() {
  const linhas = [
    linha("conFiltroMT", 50, [
      lbl("lblCompMT", '"Mês de referência"', 0, 0, 200, 18, { Size: 9, Color: "corTextoSuave" }),
      dropdown("drpCompMT", "Sort(ForAll(colMeses As m, {Value: m.Rot, Comp: m.Comp, I: m.I}), I, SortOrder.Descending)", 0, 14, 200, {
        OnChange: "Set(varCompMT, Self.Selected.Comp)",
      }),
      lbl(
        "lblResumoMT",
        `With({ok: CountRows(Filter(colMetasCad As m, With({v: LookUp(colSerieMetas, Codigo = m.Codigo && Comp = varCompMT)}, ${ATINGIU("v.Valor", "v.Meta", "m.Sentido")})))}, ok & " de " & CountRows(colMetasCad) & " metas atingidas em " & LookUp(colMeses, Comp = varCompMT, Rot))`,
        216,
        14,
        600,
        36,
        { FontWeight: "FontWeight.Semibold" }
      ),
      botaoSec("btnCadastroMT", '"Cadastro das metas"', `Launch(gUrlSite & "/Lists/MetasIndicadores/AllItems.aspx")`, "Parent.Width - 190", 12, 190, 36, {
        Size: 10,
        Visible: "gEhNIR",
      }),
    ]),
    linha("conCardsMT", 340, [
      galeria(
        "galMetasMT",
        "colMetasCad",
        0,
        0,
        "Parent.Width",
        340,
        162,
        [imagem("imgCardMT", SVG_CARD, 4, 4, "Parent.TemplateWidth - 8", "Parent.TemplateHeight - 8", { OnSelect: "Select(Parent)" })],
        { WrapCount: 4, OnSelect: "Set(varMetaSel, ThisItem.Codigo)" }
      ),
    ]),
    linha(
      "conDetalheMT",
      380,
      [
        retangulo("recDetalheMT", 0, 0, "Parent.Width", 380),
        titulo("lblDetalheMT", `"Últimos 12 meses · " & LookUp(colMetasCad, Codigo = varMetaSel, Title)`, 16, 8, 900, 26),
        html("htmlTendMT", HTML_TENDENCIA, 16, 38, "Parent.Width - 32", 60),
        imagem("imgDetalheMT", SVG_DETALHE, 16, 100, "Parent.Width - 32", 270),
      ],
      { Visible: "!IsBlank(varMetaSel)" }
    ),
    linha("conDicaMT", 60, [
      lbl(
        "lblDicaMT",
        '"Clique em uma meta para ver o detalhe. Metas automáticas são calculadas a partir dos indicadores diários (fluxo F3). Metas de planilha são importadas na Rotina de Atualização, seção b. O cadastro (nome, meta, unidade, sentido) fica na lista MetasIndicadores."',
        0,
        0,
        "Parent.Width",
        56,
        { Size: 10, Color: "corTextoSuave" }
      ),
    ]),
  ];
  return telaRolagem(
    "scrMetas",
    "MT",
    "METAS",
    '"Metas institucionais"',
    ATUALIZA,
    linhas,
    `If(IsBlank(varCompMT), Set(varCompMT, Text(Today(), "yyyy-mm")))`
  );
}
