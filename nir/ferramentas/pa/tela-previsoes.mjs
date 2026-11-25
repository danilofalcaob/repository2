// Guia: Previsões de Alta (sufixo PA)
import * as B from "./base.mjs";
const { lbl, titulo, botao, botaoSec, retangulo, dropdown, galeria, html, imagem, c, T, pos, SIGLA, CARD, alternador, datepicker, telaManual, janela, ITENS_SETORES_TODOS } = B;

const ATUALIZA = `
Refresh(Internacoes);
ClearCollect(colInternados, Filter(Internacoes, Status = "INTERNADO"));
ClearCollect(
    colSaidas30,
    Filter(Internacoes, SaidaDetectadaEm >= DateAdd(Today(), -30, TimeUnit.Days) && (Status = "ALTA_PRESUMIDA" || Status = "ALTA_CONFIRMADA"))
);
Set(varUltimaAtualizacao, Now())`;

const BASE = `AddColumns(
    Filter(colInternados, varFiltroSetorPA = "TODOS" || SetorCodigo = varFiltroSetorPA),
    Dif, If(IsBlank(PrevisaoAlta), Blank(), DateDiff(Today(), PrevisaoAlta, TimeUnit.Days)),
    Dias, If(IsBlank(DataInternacao), Blank(), DateDiff(DataInternacao, Today(), TimeUnit.Days)),
    OrdemSetor, LookUp(colSetores, Codigo = SetorCodigo, Ordem)
)`;

const ITENS = `
Sort(
    Filter(
        ${BASE},
        Switch(
            varAbaPA,
            "HOJE", !IsBlank(PrevisaoAlta) && Dif = 0,
            "AMANHA", !IsBlank(PrevisaoAlta) && Dif = 1,
            "48H", !IsBlank(PrevisaoAlta) && Dif >= 0 && Dif <= 2,
            "VENCIDAS", !IsBlank(PrevisaoAlta) && Dif < 0,
            "SEM", IsBlank(PrevisaoAlta),
            true
        )
    ),
    Text(OrdemSetor, "000") & "|" & Leito
)`;

const HTML_KPIS = `
With(
    {b: ${BASE}},
    With(
        {
            n: CountRows(b),
            hoje: CountRows(Filter(b, !IsBlank(PrevisaoAlta) && Dif = 0)),
            amanha: CountRows(Filter(b, !IsBlank(PrevisaoAlta) && Dif = 1)),
            h48: CountRows(Filter(b, !IsBlank(PrevisaoAlta) && Dif >= 0 && Dif <= 2)),
            venc: CountRows(Filter(b, !IsBlank(PrevisaoAlta) && Dif < 0)),
            sem: CountRows(Filter(b, IsBlank(PrevisaoAlta))),
            comPrev: Filter(colSaidas30, !IsBlank(PrevisaoAlta))
        },
        With(
            {acertos: CountRows(Filter(comPrev, Abs(DateDiff(PrevisaoAlta, SaidaDetectadaEm, TimeUnit.Days)) <= 1))},
            "<div style='display:flex;flex-wrap:wrap;gap:12px;font-family:Segoe UI,Arial,sans-serif'>" &
            ${CARD("Altas previstas hoje", "hoje", "hexTexto", `"amanhã: " & amanha`)} &
            ${CARD("Próximas 48 h", "h48", "hexTexto", `"hoje, amanhã e depois"`)} &
            ${CARD("Previsões vencidas", "venc", `If(venc > 0, hexVermelho, hexVerde)`, `"data passou e o paciente segue internado"`)} &
            ${CARD("Sem previsão de alta", "sem", `If(sem > 0, hexAmarelo, hexVerde)`, `If(n = 0, "", Text(sem / n * 100, "0") & "% dos internados")`)} &
            ${CARD("Acurácia (30 dias)", `If(CountRows(comPrev) = 0, "–", Text(acertos / CountRows(comPrev) * 100, "0") & "%")`, "hexTexto", `"alta em até 1 dia da previsão · " & CountRows(comPrev) & " altas com previsão"`)} &
            "</div>"
        )
    )
)`;

const SVG_PROXIMOS = `
With(
    {
        serie: ForAll(
            Sequence(7, 0) As k,
            {I: k.Value, Rot: Text(DateAdd(Today(), k.Value, TimeUnit.Days), "ddd dd/mm"), N: CountRows(Filter(colInternados, !IsBlank(PrevisaoAlta) && DateDiff(Today(), PrevisaoAlta, TimeUnit.Days) = k.Value))}
        )
    },
    With(
        {mx: Max(1, Max(serie, N))},
        "data:image/svg+xml;utf8," & EncodeUrl(
            "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 700 150' font-family='Segoe UI, Arial, sans-serif'>" &
            "<line x1='0' y1='118' x2='700' y2='118' stroke='" & hexBorda & "'/>" &
            Concat(
                serie,
                "<rect x='" & Text(I * 100 + 20, "0") & "' y='" & Text(118 - 90 * N / mx, "0") & "' width='60' height='" & Text(90 * N / mx, "0") & "' rx='4' fill='" & hexPrimaria & "'/>" &
                "<text x='" & Text(I * 100 + 50, "0") & "' y='" & Text(112 - 90 * N / mx, "0") & "' font-size='13' font-weight='600' text-anchor='middle' fill='" & hexTexto & "'>" & N & "</text>" &
                "<text x='" & Text(I * 100 + 50, "0") & "' y='138' font-size='11' text-anchor='middle' fill='" & hexTextoSuave & "'>" & Rot & "</text>"
            ) &
            "</svg>"
        )
    )
)`;

const SALVAR = `
With(
    {id: ThisItem.ID, reg: ThisItem, nova: dpPrevPA.SelectedDate},
    If(
        IsBlank(nova),
        Notify("Escolha a data prevista de alta.", NotificationType.Warning),
        Patch(Internacoes, LookUp(Internacoes, ID = id), {PrevisaoAlta: nova, PrevisaoAltaOrigem: "EQUIPE", PrevisaoAltaEm: Now(), PrevisaoAltaPor: gUsuarioNome});
        Patch(
            PrevisoesAlta,
            Defaults(PrevisoesAlta),
            {
                Title: reg.Title,
                Paciente: reg.Paciente,
                SetorCodigo: reg.SetorCodigo,
                DataPrevista: nova,
                DataAnterior: reg.PrevisaoAlta,
                Motivo: "",
                RegistradoEm: Now(),
                RegistradoPorEmail: gUsuarioEmail,
                RegistradoPorNome: gUsuarioNome
            }
        );
        Patch(colInternados, LookUp(colInternados, ID = id), {PrevisaoAlta: nova, PrevisaoAltaOrigem: "EQUIPE", PrevisaoAltaEm: Now(), PrevisaoAltaPor: gUsuarioNome});
        Notify(reg.Paciente & ": previsão de alta em " & Text(nova, "dd/mm/yyyy") & ".", NotificationType.Success)
    )
)`;

const ABAS = [
  ["HOJE", "Hoje"],
  ["AMANHA", "Amanhã"],
  ["48H", "Próximas 48 h"],
  ["VENCIDAS", "Vencidas"],
  ["SEM", "Sem previsão"],
  ["TODOS", "Todos"],
];

export function telaPrevisoes() {
  const topoLista = 380;
  return telaManual(
    "scrPrevisoes",
    "PA",
    "PREVISOES",
    '"Previsões de Alta"',
    ATUALIZA,
    [
      html("htmlKpisPA", HTML_KPIS, 20, 66, "Parent.Width - 40", 96),
      retangulo("recProxPA", 20, 170, "Parent.Width - 40", 196),
      titulo("lblSecProxPA", '"Altas previstas nos próximos 7 dias"', 36, 178, 500, 24),
      imagem("imgProxPA", SVG_PROXIMOS, 36, 206, "Parent.Width - 72", 150),

      lbl("lblSetorPA", '"Setor"', 20, topoLista, 200, 18, { Size: 9, Color: "corTextoSuave" }),
      dropdown("drpSetorPA", ITENS_SETORES_TODOS, 20, topoLista + 18, 260, {
        Default: `If(varFiltroSetorPA = "TODOS" || IsBlank(varFiltroSetorPA), "Todos os setores", LookUp(colSetores, Codigo = varFiltroSetorPA, Title))`,
        OnChange: "Set(varFiltroSetorPA, Self.Selected.Codigo)",
      }),
      ...ABAS.map(([cod, rot], i) =>
        alternador(`btnAba${cod}PA`, `"${rot}"`, `varAbaPA = "${cod}"`, `Set(varAbaPA, "${cod}")`, 296 + i * 122, topoLista + 18, 116, 36)
      ),
      galeria(
        "galPrevPA",
        ITENS,
        20,
        topoLista + 62,
        "Parent.Width - 40",
        `Parent.Height - ${topoLista + 82}`,
        62,
        [
          retangulo("recLinhaPA", 0, 2, "Parent.TemplateWidth", "Parent.TemplateHeight - 4"),
          lbl("lblLeitoPA", "ThisItem.Leito", 12, 8, 70, 24, { FontWeight: "FontWeight.Semibold" }),
          lbl("lblPacPA", "ThisItem.Paciente", 86, 6, 320, 24, { FontWeight: "FontWeight.Semibold", Size: 10 }),
          lbl(
            "lblInfoPA",
            `${SIGLA("ThisItem.SetorCodigo")} & If(IsBlank(ThisItem.Dias), "", " · " & ThisItem.Dias & " dias") & If(IsBlank(ThisItem.Medico), "", " · " & ThisItem.Medico)`,
            86,
            30,
            320,
            20,
            { Size: 9, Color: "corTextoSuave" }
          ),
          lbl(
            "lblPrevPA",
            `If(
                IsBlank(ThisItem.PrevisaoAlta),
                "Sem previsão de alta",
                "Previsão: " & Text(ThisItem.PrevisaoAlta, "ddd dd/mm/yyyy") &
                If(ThisItem.Dif < 0, " (vencida há " & -ThisItem.Dif & " dia(s))", ThisItem.Dif = 0, " (hoje)", ThisItem.Dif = 1, " (amanhã)", "") &
                " · " & If(ThisItem.PrevisaoAltaOrigem = "EQUIPE", "registrada por " & ThisItem.PrevisaoAltaPor, ThisItem.PrevisaoAltaOrigem = "TASY", "vinda do Tasy", "")
            )`,
            416,
            6,
            "Parent.TemplateWidth - 840",
            48,
            {
              Size: 10,
              Color: `If(IsBlank(ThisItem.PrevisaoAlta), corAmarelo, ThisItem.Dif < 0, corVermelho, corTexto)`,
            }
          ),
          datepicker("dpPrevPA", "ThisItem.PrevisaoAlta", "Parent.TemplateWidth - 412", 13, 150, {
            DisplayMode: "If(gEhNIR || gPodePermanencia, DisplayMode.Edit, DisplayMode.View)",
          }),
          botao("btnSalvarPA", '"Salvar previsão"', SALVAR, "Parent.TemplateWidth - 254", 13, 130, 34, {
            Size: 9,
            Visible: "gEhNIR || gPodePermanencia",
          }),
          botaoSec("btnHistPA", '"Histórico"', "Set(varHistPA, ThisItem)", "Parent.TemplateWidth - 116", 13, 104, 34, { Size: 9 }),
        ]
      ),
      lbl("lblVazioPA", '"Nenhum paciente neste filtro."', 20, topoLista + 80, 400, 30, {
        Color: "corTextoSuave",
        Visible: "CountRows(galPrevPA.AllItems) = 0",
      }),
      janela("conHistPA", "!IsBlank(varHistPA)", 560, 400, [
        titulo("lblHistTitPA", `"Previsões registradas · " & varHistPA.Paciente`, 16, 10, 420, 26),
        botaoSec("btnHistFecharPA", '"Fechar"', "Set(varHistPA, Blank())", 456, 10, 88, 32, { Size: 10 }),
        galeria(
          "galHistPA",
          "Sort(Filter(PrevisoesAlta, Title = varHistPA.Title), RegistradoEm, SortOrder.Descending)",
          16,
          50,
          528,
          334,
          46,
          [
            lbl(
              "lblHist1PA",
              `"Alta prevista para " & Text(ThisItem.DataPrevista, "dd/mm/yyyy") & If(IsBlank(ThisItem.DataAnterior), "", " (antes: " & Text(ThisItem.DataAnterior, "dd/mm") & ")")`,
              0,
              2,
              528,
              22,
              { Size: 10, FontWeight: "FontWeight.Semibold" }
            ),
            lbl("lblHist2PA", `Text(ThisItem.RegistradoEm, "dd/mm/yyyy hh:mm") & " · " & ThisItem.RegistradoPorNome`, 0, 24, 528, 20, {
              Size: 9,
              Color: "corTextoSuave",
            }),
          ]
        ),
      ]),
    ],
    `If(IsBlank(varAbaPA), Set(varAbaPA, "48H")); If(IsBlank(varFiltroSetorPA), Set(varFiltroSetorPA, "TODOS")); Set(varHistPA, Blank())`
  );
}
