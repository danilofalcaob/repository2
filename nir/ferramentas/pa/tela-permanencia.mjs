// Guia: Gestão da Permanência (sufixo PM)
import * as B from "./base.mjs";
const { lbl, titulo, botao, botaoSec, retangulo, dropdown, entrada, galeria, html, c, T, pos, SIGLA, CARD, alternador, datepicker, rotulo, linha, telaRolagem, ITENS_SETORES_TODOS } = B;

const ESP = [
  ["MEDICO", "PendMedico", "Médico", "Med"],
  ["ENFERMAGEM", "PendEnfermagem", "Enfermagem", "Enf"],
  ["SERVICO_SOCIAL", "PendServicoSocial", "Serviço Social", "SS"],
  ["FISIOTERAPIA", "PendFisioterapia", "Fisioterapia", "Fisio"],
];

// visão consolidada: paciente ≥ 15 dias + acompanhamento + contagem de tópicos
const RECALC = `
ClearCollect(
    colPermView,
    ForAll(
        colPerm As p,
        With(
            {a: LookUp(colAcomp, Title = p.Title)},
            {
                ID: p.ID,
                Title: p.Title,
                Paciente: p.Paciente,
                Leito: p.Leito,
                SetorCodigo: p.SetorCodigo,
                Medico: p.Medico,
                Dias: p.Dias,
                PrevisaoAlta: p.PrevisaoAlta,
                OrdemSetor: LookUp(colSetores, Codigo = p.SetorCodigo, Ordem),
                AcId: a.ID,
${ESP.map(([cod, campo, , ab]) => `                ${campo}: Coalesce(a.${campo}, false),
                n${ab}: CountRows(Filter(colTopicos, NrAtendimento = p.Title && Especialidade = "${cod}" && Status <> "CONCLUIDO")),`).join("\n")}
                DestinoAltaPrevisto: a.DestinoAltaPrevisto,
                PlanoTerapeutico: a.PlanoTerapeutico,
                ObsAcomp: a.Observacao,
                UltimaRevisaoEm: a.UltimaRevisaoEm,
                UltimaRevisaoPor: a.UltimaRevisaoPor
            }
        )
    )
)`;

const ATUALIZA = `
Refresh(Internacoes);
Refresh(PermanenciaAcompanhamento);
Refresh(PermanenciaTopicos);
ClearCollect(colInternados, Filter(Internacoes, Status = "INTERNADO"));
ClearCollect(colAcomp, PermanenciaAcompanhamento);
ClearCollect(colTopicos, Filter(PermanenciaTopicos, Status = "PLANEJADO" || Status = "EM_ANDAMENTO"));
Collect(colTopicos, Filter(PermanenciaTopicos, Status = "CONCLUIDO" && ConcluidoEm >= DateAdd(Today(), -30, TimeUnit.Days)));
ClearCollect(
    colPerm,
    AddColumns(
        Filter(colInternados, !IsBlank(DataInternacao) && DateDiff(DataInternacao, Today(), TimeUnit.Days) >= gDiasPermanencia),
        Dias, DateDiff(DataInternacao, Today(), TimeUnit.Days)
    )
);
${RECALC};
Set(varUltimaAtualizacao, Now())`;

const HTML_DASH = `
With(
    {
        n: CountRows(colPermView),
        f1: CountRows(Filter(colPermView, Dias < 30)),
        f2: CountRows(Filter(colPermView, Dias >= 30 && Dias < 60)),
        f3: CountRows(Filter(colPermView, Dias >= 60)),
        semPrev: CountRows(Filter(colPermView, IsBlank(PrevisaoAlta))),
        abertos: Filter(colTopicos, Status <> "CONCLUIDO" && NrAtendimento in colPermView.Title),
        atrasados: CountRows(Filter(colTopicos, Status <> "CONCLUIDO" && !IsBlank(Prazo) && Prazo < Today() && NrAtendimento in colPermView.Title))
    },
    "<div style='font-family:Segoe UI,Arial,sans-serif'>" &
    "<div style='display:flex;flex-wrap:wrap;gap:12px'>" &
    ${CARD("Pacientes com ≥ 15 dias", "n", "hexTexto", `"15–29 d: " & f1 & " · 30–59 d: " & f2 & " · ≥ 60 d: " & f3`)} &
    ${CARD("Sem previsão de alta", "semPrev", `If(semPrev > 0, hexVermelho, hexVerde)`, `"todos devem ter previsão"`)} &
    ${CARD("Tópicos em aberto", "CountRows(abertos)", "hexTexto", `CountRows(Filter(abertos, Status = "PLANEJADO")) & " planejados · " & CountRows(Filter(abertos, Status = "EM_ANDAMENTO")) & " em andamento"`)} &
    ${CARD("Tópicos com prazo vencido", "atrasados", `If(atrasados > 0, hexVermelho, hexVerde)`, `"planejados ou em andamento"`)} &
    ${CARD("Concluídos (30 dias)", `CountRows(Filter(colTopicos, Status = "CONCLUIDO"))`, "hexVerde", `"pendências resolvidas"`)} &
    "</div>" &
    "<table style='width:100%;border-collapse:collapse;margin-top:12px;font-size:12px;color:#1A2330'>" &
    "<tr style='text-align:left;color:#5A6573;border-bottom:1px solid #D8DEE6'><th>Especialidade</th><th>Pacientes com pendência</th><th>Planejado</th><th>Em andamento</th><th>Concluído (30 d)</th></tr>" &
${ESP.map(([cod, campo, nome]) => `    "<tr style='border-bottom:1px solid #EEF1F4'><td>${nome}</td><td>" & CountRows(Filter(colPermView, ${campo})) & "</td><td>" & CountRows(Filter(colTopicos, Especialidade = "${cod}" && Status = "PLANEJADO")) & "</td><td>" & CountRows(Filter(colTopicos, Especialidade = "${cod}" && Status = "EM_ANDAMENTO")) & "</td><td>" & CountRows(Filter(colTopicos, Especialidade = "${cod}" && Status = "CONCLUIDO")) & "</td></tr>" &`).join("\n")}
    "</table></div>"
)`;

const ITENS_PACIENTES = `
Sort(
    Filter(
        colPermView,
        (varFiltroSetorPM = "TODOS" || SetorCodigo = varFiltroSetorPM) &&
        (IsBlank(txtBuscaPM.Text) || txtBuscaPM.Text in Paciente || txtBuscaPM.Text in Leito || txtBuscaPM.Text in Title)
    ),
    Dias,
    SortOrder.Descending
)`;

// liga/desliga a pendência de uma especialidade (cria o acompanhamento se não existir)
const TOGGLE = (cod, campo) => `
With(
    {p: ThisItem, novo: !ThisItem.${campo}},
    If(
        IsBlank(p.AcId),
        Patch(
            PermanenciaAcompanhamento,
            Defaults(PermanenciaAcompanhamento),
            {
                Title: p.Title,
                Paciente: p.Paciente,
                SetorCodigo: p.SetorCodigo,
${ESP.map(([, c2]) => `                ${c2}: ${c2 === campo ? "novo" : "false"},`).join("\n")}
                UltimaRevisaoEm: Now(),
                UltimaRevisaoPor: gUsuarioNome
            }
        ),
        Patch(
            PermanenciaAcompanhamento,
            LookUp(PermanenciaAcompanhamento, ID = p.AcId),
            {${campo}: novo, SetorCodigo: p.SetorCodigo, UltimaRevisaoEm: Now(), UltimaRevisaoPor: gUsuarioNome}
        )
    );
    ClearCollect(colAcomp, PermanenciaAcompanhamento);
    ${RECALC.trim()};
    Set(varPacPM, p.Title);
    If(novo, Set(varEspPM, "${cod}"))
)`;

const SEL = "LookUp(colPermView, Title = varPacPM)";
const FLAG_SEL = `Switch(varEspPM, ${ESP.map(([cod, campo]) => `"${cod}", ${SEL}.${campo}`).join(", ")}, false)`;

const SALVAR_PLANO = `
With(
    {p: ${SEL}},
    If(
        IsBlank(p.AcId),
        Patch(
            PermanenciaAcompanhamento,
            Defaults(PermanenciaAcompanhamento),
            {
                Title: p.Title, Paciente: p.Paciente, SetorCodigo: p.SetorCodigo,
                PendMedico: false, PendEnfermagem: false, PendServicoSocial: false, PendFisioterapia: false,
                DestinoAltaPrevisto: drpDestinoPM.Selected.Value, PlanoTerapeutico: txtPlanoPM.Text, Observacao: txtObsPM.Text,
                UltimaRevisaoEm: Now(), UltimaRevisaoPor: gUsuarioNome
            }
        ),
        Patch(
            PermanenciaAcompanhamento,
            LookUp(PermanenciaAcompanhamento, ID = p.AcId),
            {DestinoAltaPrevisto: drpDestinoPM.Selected.Value, PlanoTerapeutico: txtPlanoPM.Text, Observacao: txtObsPM.Text, UltimaRevisaoEm: Now(), UltimaRevisaoPor: gUsuarioNome}
        )
    );
    If(
        !IsBlank(dpPrevPM.SelectedDate) && dpPrevPM.SelectedDate <> p.PrevisaoAlta,
        Patch(Internacoes, LookUp(Internacoes, ID = p.ID), {PrevisaoAlta: dpPrevPM.SelectedDate, PrevisaoAltaOrigem: "EQUIPE", PrevisaoAltaEm: Now(), PrevisaoAltaPor: gUsuarioNome});
        Patch(
            PrevisoesAlta,
            Defaults(PrevisoesAlta),
            {
                Title: p.Title, Paciente: p.Paciente, SetorCodigo: p.SetorCodigo, DataPrevista: dpPrevPM.SelectedDate, DataAnterior: p.PrevisaoAlta,
                Motivo: "Gestão da Permanência", RegistradoEm: Now(), RegistradoPorEmail: gUsuarioEmail, RegistradoPorNome: gUsuarioNome
            }
        );
        Patch(colPerm, LookUp(colPerm, ID = p.ID), {PrevisaoAlta: dpPrevPM.SelectedDate})
    );
    ClearCollect(colAcomp, PermanenciaAcompanhamento);
    ${RECALC.trim()};
    Notify("Plano do paciente salvo.", NotificationType.Success)
)`;

const NOVO_TOPICO = `
If(
    IsBlank(Trim(txtTopicoPM.Text)),
    Notify("Descreva a pendência (tópico).", NotificationType.Warning),
    Patch(
        PermanenciaTopicos,
        Defaults(PermanenciaTopicos),
        {
            Title: Trim(txtTopicoPM.Text),
            NrAtendimento: varPacPM,
            Paciente: ${SEL}.Paciente,
            Especialidade: varEspPM,
            Status: "PLANEJADO",
            Responsavel: txtRespPM.Text,
            Prazo: dpPrazoPM.SelectedDate,
            CriadoEm: Now(),
            CriadoPorNome: gUsuarioNome,
            AtualizadoPorNome: gUsuarioNome
        }
    );
    ClearCollect(colTopicos, Filter(PermanenciaTopicos, Status = "PLANEJADO" || Status = "EM_ANDAMENTO"));
    Collect(colTopicos, Filter(PermanenciaTopicos, Status = "CONCLUIDO" && ConcluidoEm >= DateAdd(Today(), -30, TimeUnit.Days)));
    ${RECALC.trim()};
    Reset(txtTopicoPM);
    Reset(txtRespPM);
    Reset(dpPrazoPM);
    Notify("Tópico incluído em Planejado.", NotificationType.Success)
)`;

const MOVER = (novo) => `
With(
    {id: ThisItem.ID, iniciado: ThisItem.IniciadoEm},
    Patch(
        PermanenciaTopicos,
        LookUp(PermanenciaTopicos, ID = id),
        {Status: "${novo}", IniciadoEm: ${novo === "PLANEJADO" ? "iniciado" : "Coalesce(iniciado, Now())"}, ConcluidoEm: ${novo === "CONCLUIDO" ? "Now()" : "Blank()"}, AtualizadoPorNome: gUsuarioNome}
    );
    Patch(
        colTopicos,
        LookUp(colTopicos, ID = id),
        {Status: "${novo}", IniciadoEm: ${novo === "PLANEJADO" ? "iniciado" : "Coalesce(iniciado, Now())"}, ConcluidoEm: ${novo === "CONCLUIDO" ? "Now()" : "Blank()"}, AtualizadoPorNome: gUsuarioNome}
    );
    ${RECALC.trim()}
)`;

function colunaKanban(cod, rotulo, i, anterior, proximo) {
  const x = `Parent.Width * ${i} / 3 + 4`;
  const w = "Parent.Width / 3 - 8";
  return [
    lbl(`lblKan${cod}PM`, `"${rotulo} (" & CountRows(gal${cod}PM.AllItems) & ")"`, x, 0, w, 24, {
      FontWeight: "FontWeight.Semibold",
      Size: 10,
      Color: `ColorValue(LookUp(tblStatusTopico, Codigo = "${cod}", Hex))`,
    }),
    galeria(
      `gal${cod}PM`,
      `Sort(Filter(colTopicos, NrAtendimento = varPacPM && Especialidade = varEspPM && Status = "${cod}"), CriadoEm)`,
      x,
      26,
      w,
      "Parent.Height - 26",
      96,
      [
        retangulo(`recCard${cod}PM`, 0, 3, "Parent.TemplateWidth", "Parent.TemplateHeight - 6", { Fill: "corFundo" }),
        lbl(`lblTop${cod}PM`, "ThisItem.Title", 8, 6, "Parent.TemplateWidth - 16", 40, { Size: 10, FontWeight: "FontWeight.Semibold" }),
        lbl(
          `lblTopInfo${cod}PM`,
          `If(IsBlank(ThisItem.Responsavel), "sem responsável", ThisItem.Responsavel) & If(IsBlank(ThisItem.Prazo), "", " · prazo " & Text(ThisItem.Prazo, "dd/mm"))`,
          8,
          44,
          "Parent.TemplateWidth - 16",
          18,
          {
            Size: 9,
            Color: `If(!IsBlank(ThisItem.Prazo) && ThisItem.Prazo < Today() && ThisItem.Status <> "CONCLUIDO", corVermelho, corTextoSuave)`,
          }
        ),
        ...(anterior
          ? [botaoSec(`btnVolta${cod}PM`, '"◀"', MOVER(anterior), 8, 64, 40, 26, { Size: 9, Visible: "gPodePermanencia" })]
          : []),
        ...(proximo
          ? [
              botao(`btnAvanca${cod}PM`, proximo === "CONCLUIDO" ? '"Concluir ▶"' : '"Iniciar ▶"', MOVER(proximo), "Parent.TemplateWidth - 108", 64, 100, 26, {
                Size: 9,
                Visible: "gPodePermanencia",
              }),
            ]
          : []),
      ]
    ),
  ];
}

export function telaPermanencia() {
  const linhas = [
    linha("conDashPM", 236, [
      titulo("lblSecDashPM", '"Painel da permanência (pacientes com 15 dias ou mais)"', 0, 0, 700, 24),
      html("htmlDashPM", HTML_DASH, 0, 28, "Parent.Width", 206),
    ]),
    linha("conListaPM", 380, [
      retangulo("recListaPM", 0, 0, "Parent.Width", 380),
      titulo("lblSecListaPM", `"Pacientes (" & CountRows(galPacPM.AllItems) & ") · marque a especialidade que tem pendência para abrir o Kanban"`, 16, 8, 900, 24),
      dropdown("drpSetorPM", ITENS_SETORES_TODOS, 16, 38, 240, {
        Default: `If(varFiltroSetorPM = "TODOS" || IsBlank(varFiltroSetorPM), "Todos os setores", LookUp(colSetores, Codigo = varFiltroSetorPM, Title))`,
        OnChange: "Set(varFiltroSetorPM, Self.Selected.Codigo)",
      }),
      entrada("txtBuscaPM", 268, 38, 300, 36, { HintText: '"Buscar paciente, leito ou atendimento"' }),
      galeria(
        "galPacPM",
        ITENS_PACIENTES,
        16,
        82,
        "Parent.Width - 32",
        290,
        58,
        [
          c("recSelPM", T.rect, { ...pos(0, 0, 4, "Parent.TemplateHeight"), Fill: "corPrimaria", Visible: "ThisItem.Title = varPacPM" }),
          lbl("lblLeitoPM", "ThisItem.Leito", 10, 6, 64, 24, { FontWeight: "FontWeight.Semibold" }),
          lbl("lblPacPM", "ThisItem.Paciente", 78, 4, 300, 24, { FontWeight: "FontWeight.Semibold", Size: 10 }),
          lbl("lblInfoPM", `${SIGLA("ThisItem.SetorCodigo")} & " · " & ThisItem.Dias & " dias · " & ThisItem.Medico`, 78, 28, 300, 20, {
            Size: 9,
            Color: `If(ThisItem.Dias >= 60, corVermelho, ThisItem.Dias >= 30, corAmarelo, corTextoSuave)`,
          }),
          lbl(
            "lblPrevPM",
            `If(IsBlank(ThisItem.PrevisaoAlta), "Sem previsão de alta", "Alta prevista " & Text(ThisItem.PrevisaoAlta, "dd/mm"))`,
            384,
            16,
            170,
            24,
            { Size: 10, Color: `If(IsBlank(ThisItem.PrevisaoAlta), corVermelho, ThisItem.PrevisaoAlta < Today(), corAmarelo, corTexto)` }
          ),
          ...ESP.map(([cod, campo, nome, ab], i) =>
            alternador(
              `btnFlag${ab}PM`,
              `If(ThisItem.${campo}, "✓ ", "") & "${nome}" & If(ThisItem.n${ab} > 0, " (" & ThisItem.n${ab} & ")", "")`,
              `ThisItem.${campo}`,
              TOGGLE(cod, campo),
              `560 + ${i} * 150`,
              12,
              144,
              34,
              { Size: 9, DisplayMode: "If(gPodePermanencia, DisplayMode.Edit, DisplayMode.View)" }
            )
          ),
          c("recSepPM", T.rect, { ...pos(8, 57, "Parent.TemplateWidth - 16", 1), Fill: "corBorda" }),
        ],
        { OnSelect: "Set(varPacPM, ThisItem.Title); If(IsBlank(varEspPM), Set(varEspPM, \"MEDICO\"))" }
      ),
    ]),
    linha(
      "conDetPM",
      480,
      [
        retangulo("recDetPM", 0, 0, "Parent.Width", 480),
        titulo("lblDetTitPM", `"Plano de " & ${SEL}.Paciente & " · " & ${SEL}.Dias & " dias de internação"`, 16, 8, 900, 26),
        rotulo("lblPrevDetPM", '"Previsão de alta"', 16, 42, 200),
        datepicker("dpPrevPM", `${SEL}.PrevisaoAlta`, 16, 60, 200),
        rotulo("lblDestinoPM", '"Destino de alta previsto"', 16, 104, 330),
        dropdown("drpDestinoPM", "tblDestinosAlta", 16, 122, 330, {
          AllowEmptySelection: true,
          Default: `${SEL}.DestinoAltaPrevisto`,
        }),
        rotulo("lblPlanoPM", '"Plano terapêutico / o que falta para a alta"', 16, 166, 330),
        entrada("txtPlanoPM", 16, 184, 330, 120, { Mode: "TextMode.MultiLine", Default: `${SEL}.PlanoTerapeutico` }),
        rotulo("lblObsPM", '"Observações"', 16, 310, 330),
        entrada("txtObsPM", 16, 328, 330, 80, { Mode: "TextMode.MultiLine", Default: `${SEL}.ObsAcomp` }),
        botao("btnSalvarPlanoPM", '"Salvar plano"', SALVAR_PLANO, 16, 418, 160, 36, { Visible: "gPodePermanencia" }),
        lbl(
          "lblRevisaoPM",
          `If(IsBlank(${SEL}.UltimaRevisaoEm), "Ainda não revisado", "Revisado em " & Text(${SEL}.UltimaRevisaoEm, "dd/mm hh:mm") & " por " & ${SEL}.UltimaRevisaoPor)`,
          186,
          418,
          170,
          36,
          { Size: 9, Color: "corTextoSuave" }
        ),

        ...ESP.map(([cod, campo, nome], i) =>
          alternador(
            `btnEsp${cod}PM`,
            `"${nome}" & If(${SEL}.${campo}, " ✓", "")`,
            `varEspPM = "${cod}"`,
            `Set(varEspPM, "${cod}")`,
            `366 + ${i} * 150`,
            42,
            144,
            34,
            { Size: 9 }
          )
        ),
        lbl(
          "lblSemFlagPM",
          `"Esta especialidade não está marcada com pendência para o paciente. Marque a especialidade na lista acima para abrir o Kanban."`,
          366,
          90,
          "Parent.Width - 382",
          40,
          { Size: 10, Color: "corTextoSuave", Visible: `!(${FLAG_SEL})` }
        ),
        entrada("txtTopicoPM", 366, 86, "Parent.Width - 822", 36, {
          HintText: '"Novo tópico (ex.: aguarda vaga em ILPI)"',
          Visible: `${FLAG_SEL} && gPodePermanencia`,
        }),
        entrada("txtRespPM", "Parent.Width - 448", 86, 150, 36, { HintText: '"Responsável"', Visible: `${FLAG_SEL} && gPodePermanencia` }),
        datepicker("dpPrazoPM", "Blank()", "Parent.Width - 290", 86, 140, { Visible: `${FLAG_SEL} && gPodePermanencia` }),
        botao("btnNovoTopicoPM", '"Incluir"', NOVO_TOPICO, "Parent.Width - 142", 86, 126, 36, { Visible: `${FLAG_SEL} && gPodePermanencia` }),
        c(
          "conKanbanPM",
          T.container,
          { ...pos(366, 132, "Parent.Width - 382", 340), Visible: FLAG_SEL, Fill: "Color.Transparent" },
          [
            ...colunaKanban("PLANEJADO", "Planejado", 0, null, "EM_ANDAMENTO"),
            ...colunaKanban("EM_ANDAMENTO", "Em andamento", 1, "PLANEJADO", "CONCLUIDO"),
            ...colunaKanban("CONCLUIDO", "Concluído", 2, "EM_ANDAMENTO", null),
          ],
          "ManualLayout"
        ),
      ],
      { Visible: "!IsBlank(varPacPM) && !IsBlank(LookUp(colPermView, Title = varPacPM, Title))" }
    ),
    linha("conDicaPM", 40, [
      lbl("lblDicaPM", '"Clique em um paciente da lista para ver o plano e o Kanban das pendências."', 0, 0, 800, 36, {
        Color: "corTextoSuave",
        Visible: "IsBlank(varPacPM) || IsBlank(LookUp(colPermView, Title = varPacPM, Title))",
      }),
    ]),
  ];
  return telaRolagem(
    "scrPermanencia",
    "PM",
    "PERMANENCIA",
    '"Gestão da Permanência"',
    ATUALIZA,
    linhas,
    `If(IsBlank(varFiltroSetorPM), Set(varFiltroSetorPM, "TODOS")); If(IsBlank(varEspPM), Set(varEspPM, If(IsBlank(gEspecialidadeUsuario), "MEDICO", gEspecialidadeUsuario)))`
  );
}
