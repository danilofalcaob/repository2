// Gera as telas do Power Apps (nir/powerapps/telas/*.pa.yaml).
//
// As três telas compartilham blocos (menu lateral, relógio, cronômetros,
// barra da rotina). Elas são montadas aqui, a partir de uma única definição,
// para que nenhuma cópia fique diferente da outra.
//
// Uso:  node nir/ferramentas/gerar-telas.mjs
// Os arquivos gerados são os que você cola no Power Apps Studio.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { converterPtBr } from "./converter-ptbr.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const SAIDA = join(AQUI, "..", "powerapps", "telas");
let SINTAXE_PTBR = false; // quando true, as fórmulas saem com ; e ;; (cópia em telas/pt-BR)

// ---------------------------------------------------------------------------
// Tipos de controle (formato de código do Power Apps Studio — pa.yaml)
// ---------------------------------------------------------------------------
const T = {
  label: "Label@2.5.1",
  button: "Classic/Button@2.2.0",
  input: "Classic/TextInput@2.3.2",
  dropdown: "Classic/DropDown@2.3.1",
  datepicker: "Classic/DatePicker@2.6.0",
  rect: "Rectangle@2.3.0",
  image: "Image@2.2.3",
  html: "HtmlViewer@2.1.0",
  timer: "Timer@2.1.0",
  gallery: "Gallery@2.15.0",
  container: "GroupContainer@1.3.0",
};

// ---------------------------------------------------------------------------
// Serialização YAML
// ---------------------------------------------------------------------------
function dedent(s) {
  const linhas = String(s).replace(/\t/g, "    ").split("\n");
  while (linhas.length && !linhas[0].trim()) linhas.shift();
  while (linhas.length && !linhas[linhas.length - 1].trim()) linhas.pop();
  const ind = Math.min(
    ...linhas.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length)
  );
  return linhas.map((l) => l.slice(Number.isFinite(ind) ? ind : 0)).join("\n");
}

function prop(nome, valor, ind) {
  const p = " ".repeat(ind);
  let f = dedent(typeof valor === "string" ? valor : String(valor));
  if (SINTAXE_PTBR) f = converterPtBr(f);
  const simples = !f.includes("\n") && /^[A-Za-z0-9_.(), +\-*/<>=!&|]*$/.test(f);
  if (simples) return `${p}${nome}: =${f}\n`;
  const linhas = ("=" + f).split("\n");
  return `${p}${nome}: |-\n` + linhas.map((l) => (l.length ? `${p}  ${l}` : "")).join("\n") + "\n";
}

function ser(ctrl, ind) {
  const p = " ".repeat(ind);
  let out = `${p}- ${ctrl.nome}:\n`;
  out += `${p}    Control: ${ctrl.tipo}\n`;
  if (ctrl.variante) out += `${p}    Variant: ${ctrl.variante}\n`;
  const chaves = Object.keys(ctrl.props).filter((k) => ctrl.props[k] !== undefined);
  if (chaves.length) {
    out += `${p}    Properties:\n`;
    for (const k of chaves) out += prop(k, ctrl.props[k], ind + 6);
  }
  if (ctrl.filhos && ctrl.filhos.length) {
    out += `${p}    Children:\n`;
    for (const f of ctrl.filhos) out += ser(f, ind + 6);
  }
  return out;
}

function tela(nome, props, filhos) {
  let out = "Screens:\n" + `  ${nome}:\n` + "    Properties:\n";
  for (const [k, v] of Object.entries(props)) out += prop(k, v, 6);
  out += "    Children:\n";
  for (const f of filhos) out += ser(f, 6);
  return out;
}

// ---------------------------------------------------------------------------
// Construtores de controles
// ---------------------------------------------------------------------------
const c = (nome, tipo, props = {}, filhos = null, variante = null) => ({ nome, tipo, props, filhos, variante });
const pos = (x, y, w, h) => ({ X: x, Y: y, Width: w, Height: h });
const FONTE = "Font.'Segoe UI'";

function lbl(nome, texto, x, y, w, h, extra = {}) {
  return c(nome, T.label, {
    Text: texto,
    ...pos(x, y, w, h),
    Font: FONTE,
    Size: 11,
    Color: "corTexto",
    ...extra,
  });
}

function titulo(nome, texto, x, y, w, h = 28, extra = {}) {
  return lbl(nome, texto, x, y, w, h, { Size: 13, FontWeight: "FontWeight.Semibold", ...extra });
}

function botao(nome, texto, onSelect, x, y, w, h, extra = {}) {
  return c(nome, T.button, {
    Text: texto,
    OnSelect: onSelect,
    ...pos(x, y, w, h),
    Font: FONTE,
    Size: 11,
    FontWeight: "FontWeight.Semibold",
    Fill: "corPrimaria",
    Color: "Color.White",
    HoverFill: "corPrimariaEscura",
    PressedFill: "corPrimariaEscura",
    BorderThickness: 0,
    RadiusTopLeft: 8,
    RadiusTopRight: 8,
    RadiusBottomLeft: 8,
    RadiusBottomRight: 8,
    DisabledFill: "corBorda",
    DisabledColor: "corTextoSuave",
    ...extra,
  });
}

function botaoSec(nome, texto, onSelect, x, y, w, h, extra = {}) {
  return botao(nome, texto, onSelect, x, y, w, h, {
    Fill: "Color.White",
    Color: "corPrimaria",
    HoverFill: "corPrimariaClara",
    PressedFill: "corPrimariaClara",
    HoverColor: "corPrimaria",
    BorderColor: "corPrimaria",
    BorderThickness: 1,
    ...extra,
  });
}

function retangulo(nome, x, y, w, h, extra = {}) {
  return c(nome, T.rect, { ...pos(x, y, w, h), Fill: "corCard", BorderColor: "corBorda", BorderThickness: 1, ...extra });
}

function dropdown(nome, items, x, y, w, extra = {}) {
  return c(nome, T.dropdown, {
    Items: items,
    ...pos(x, y, w, 36),
    Font: FONTE,
    Size: 11,
    BorderColor: "corBorda",
    ChevronBackground: "corPrimaria",
    ...extra,
  });
}

function entrada(nome, x, y, w, h, extra = {}) {
  return c(nome, T.input, {
    Default: '""',
    ...pos(x, y, w, h),
    Font: FONTE,
    Size: 11,
    BorderColor: "corBorda",
    ...extra,
  });
}

function galeria(nome, items, x, y, w, h, tamanho, filhos, extra = {}) {
  return c(
    nome,
    T.gallery,
    {
      Items: items,
      ...pos(x, y, w, h),
      TemplateSize: tamanho,
      TemplatePadding: 0,
      ShowScrollbar: true,
      ...extra,
    },
    filhos,
    "Vertical"
  );
}

function imagem(nome, formula, x, y, w, h, extra = {}) {
  return c(nome, T.image, { Image: formula, ...pos(x, y, w, h), ImagePosition: "ImagePosition.Fit", ...extra });
}

function html(nome, formula, x, y, w, h, extra = {}) {
  return c(nome, T.html, {
    HtmlText: formula,
    ...pos(x, y, w, h),
    PaddingTop: 0,
    PaddingBottom: 0,
    PaddingLeft: 0,
    PaddingRight: 0,
    ...extra,
  });
}

// linha de largura total dentro de um contêiner com rolagem (layout automático)
function linha(nome, altura, filhos, extra = {}) {
  return c(
    nome,
    T.container,
    {
      Height: altura,
      FillPortions: 0,
      LayoutMinHeight: altura,
      Fill: "Color.Transparent",
      ...extra,
    },
    filhos,
    "ManualLayout"
  );
}

function rolagem(nome, filhos) {
  return c(
    nome,
    T.container,
    {
      X: "If(varModoTV, 0, 200)",
      Y: 0,
      Width: "Parent.Width - Self.X",
      Height: "Parent.Height",
      Fill: "corFundo",
      LayoutDirection: "LayoutDirection.Vertical",
      LayoutAlignItems: "LayoutAlignItems.Stretch",
      LayoutGap: 14,
      LayoutOverflowY: "LayoutOverflow.Scroll",
      PaddingTop: 16,
      PaddingBottom: 24,
      PaddingLeft: 20,
      PaddingRight: 20,
    },
    filhos,
    "AutoLayout"
  );
}

// ---------------------------------------------------------------------------
// Blocos de fórmulas compartilhados
// ---------------------------------------------------------------------------
const RELOGIO = `
Set(varRelogio, Now());
Set(varOffset, Mod(Hour(varRelogio) - gHoraInicioDia + 24, 24));
Set(varDataRef, If(Hour(varRelogio) < gHoraInicioDia, DateAdd(Today(), -1, TimeUnit.Days), Today()));
Set(varChaveData, Text(varDataRef, "yyyy-mm-dd"));
Set(varJanela, LookUp(tblJanelas, varOffset >= IniOffset && varOffset < FimOffset, Codigo));
Set(varJanelaChave, varChaveData & "|" & varJanela)`;

const CARREGA_VAGAS_ABERTAS = `ClearCollect(colVagasAbertas, Filter(SolicitacoesVaga, Status = "SOLICITADA" || Status = "EM_ANALISE" || Status = "LEITO_CEDIDO"))`;

const CALCULA_ROTINA = `
ClearCollect(
    colRotinaStatus,
    ForAll(
        tblJanelas As j,
        With(
            {
                rec: CountRows(Filter(colSetoresRotina, Codigo in Filter(colImportDia, Janela = j.Codigo).SetorCodigo)),
                esp: CountRows(colSetoresRotina),
                minAgora: varOffset * 60 + Minute(varRelogio),
                minPrev: Mod(j.HoraPrevista - gHoraInicioDia + 24, 24) * 60
            },
            {
                Codigo: j.Codigo,
                Rotulo: j.Rotulo,
                HoraPrevista: j.HoraPrevista,
                Ordem: j.Ordem,
                Recebidos: rec,
                Esperados: esp,
                Pct: If(esp = 0, 0, rec / esp),
                Situacao: If(
                    esp > 0 && rec >= esp, "Concluída",
                    minAgora < j.IniOffset * 60, "Aguardando",
                    minAgora >= j.FimOffset * 60, "Incompleta",
                    minAgora - minPrev > gToleranciaRotinaMin, "Atrasada",
                    minAgora >= minPrev, "Em andamento",
                    "Aberta"
                )
            }
        )
    )
)`;

const SVG_ROTINA = `
"data:image/svg+xml;utf8," & EncodeUrl(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1100 96' font-family='Segoe UI, Arial, sans-serif'>" &
    Concat(
        colRotinaStatus As j,
        With(
            {
                x: (j.Ordem - 1) * 275,
                cor: Switch(j.Situacao, "Concluída", hexVerde, "Atrasada", hexVermelho, "Incompleta", hexVermelho, "Em andamento", hexAmarelo, "Aberta", hexPrimaria, hexCinza),
                atual: j.Codigo = varJanela
            },
            "<g transform='translate(" & x & ",0)'>" &
            "<rect x='3' y='3' width='265' height='90' rx='12' fill='#FFFFFF' stroke='" & If(atual, hexPrimaria, hexBorda) & "' stroke-width='" & If(atual, "2.5", "1") & "'/>" &
            "<text x='18' y='30' font-size='16' font-weight='600' fill='" & hexTexto & "'>" & j.Rotulo & " · " & Text(j.HoraPrevista, "00") & "h" & If(atual, " (atual)", "") & "</text>" &
            "<text x='252' y='30' font-size='13' font-weight='600' text-anchor='end' fill='" & cor & "'>" & j.Situacao & "</text>" &
            "<rect x='18' y='44' width='234' height='12' rx='6' fill='" & hexTrilho & "'/>" &
            "<rect x='18' y='44' width='" & Text(234 * j.Pct, "0") & "' height='12' rx='6' fill='" & cor & "'/>" &
            "<text x='18' y='78' font-size='13' fill='" & hexTextoSuave & "'>" & j.Recebidos & " de " & j.Esperados & " setores · " & Text(j.Pct * 100, "0") & "%</text>" &
            "</g>"
        )
    ) &
    "</svg>"
)`;

const TEXTO_FALTAM = `
With(
    {
        faltam: Filter(colSetoresRotina, !(Codigo in Filter(colImportDia, Janela = varJanela).SetorCodigo)),
        rot: LookUp(tblJanelas, Codigo = varJanela, Rotulo)
    },
    If(
        CountRows(faltam) = 0,
        "Rotina da " & Lower(rot) & " completa: todos os setores foram atualizados.",
        "Faltam na rotina da " & Lower(rot) & " (" & CountRows(faltam) & "): " & Concat(faltam, Sigla, ", ")
    )
)`;

const CRONO = (inicio) => `
With(
    {s: Max(0, DateDiff(${inicio}, varRelogio, TimeUnit.Seconds))},
    Text(RoundDown(s / 3600, 0), "00") & ":" & Text(RoundDown(Mod(s, 3600) / 60, 0), "00") & ":" & Text(Mod(s, 60), "00")
)`;

const COR_SLA = `
With(
    {p: DateDiff(ThisItem.SolicitadoEm, varRelogio, TimeUnit.Seconds) / (60 * Coalesce(ThisItem.SLAMinutos, gSlaPadraoMin))},
    If(p >= 1, corVermelho, p >= gSlaAlerta, corAmarelo, corVerde)
)`;

const SIGLA = (campo) => `Coalesce(LookUp(colSetores, Codigo = ${campo}, Sigla), ${campo})`;

const EVENTO = (evento, solId, atend, de, para, obs) => `
Patch(
    EventosVaga,
    Defaults(EventosVaga),
    {
        Title: "${evento}",
        SolicitacaoId: ${solId},
        NrAtendimento: ${atend},
        ValorDe: ${de},
        ValorPara: ${para},
        Em: Now(),
        PorEmail: gUsuarioEmail,
        PorNome: gUsuarioNome,
        Observacao: ${obs}
    }
)`;

// ---------------------------------------------------------------------------
// Menu lateral (igual nas três telas)
// ---------------------------------------------------------------------------
function lateral(sfx, codigoAtual) {
  return [
    retangulo(`recLateral${sfx}`, 0, 0, 200, "Parent.Height", {
      Fill: "corPrimariaEscura",
      BorderThickness: 0,
      Visible: "!varModoTV",
    }),
    lbl(`lblMarca${sfx}`, '"NIR · Command Center"', 16, 14, 176, 30, {
      Color: "Color.White",
      Size: 14,
      FontWeight: "FontWeight.Semibold",
      Visible: "!varModoTV",
    }),
    lbl(`lblHospital${sfx}`, "gNomeHospital", 16, 42, 176, 22, {
      Color: "RGBA(255, 255, 255, 0.75)",
      Size: 9,
      Visible: "!varModoTV",
    }),
    galeria(
      `galMenu${sfx}`,
      "tblMenuUsuario",
      8,
      80,
      184,
      "Parent.Height - 170",
      46,
      [
        botao(
          `btnMenuItem${sfx}`,
          `ThisItem.Rotulo & If(ThisItem.Disponivel, "", "  ·  em breve")`,
          `
          If(
              !ThisItem.Disponivel,
              Notify(ThisItem.Rotulo & " chega nas próximas fases do projeto.", NotificationType.Information),
              Switch(
                  ThisItem.Codigo,
                  "PRINCIPAL", Navigate(scrPrincipal, ScreenTransition.None),
                  "ROTINA", Navigate(scrRotina, ScreenTransition.None),
                  "VAGAS", Navigate(scrVagas, ScreenTransition.None)
              )
          )`,
          0,
          2,
          "Parent.TemplateWidth",
          40,
          {
            Align: "Align.Left",
            PaddingLeft: 12,
            Size: 10,
            Fill: `If(ThisItem.Codigo = "${codigoAtual}", corPrimaria, Color.Transparent)`,
            HoverFill: "RGBA(255, 255, 255, 0.12)",
            Color: `If(ThisItem.Disponivel, Color.White, RGBA(255, 255, 255, 0.55))`,
            HoverColor: "Color.White",
          }
        ),
      ],
      { Visible: "!varModoTV", ShowScrollbar: false }
    ),
    lbl(
      `lblUsuario${sfx}`,
      `gUsuarioNome & Char(10) & "Perfil: " & gPerfil`,
      16,
      "Parent.Height - 72",
      176,
      56,
      { Color: "RGBA(255, 255, 255, 0.85)", Size: 9, Visible: "!varModoTV", VerticalAlign: "VerticalAlign.Bottom" }
    ),
  ];
}

function timers(sfx) {
  return [
    c(`tmrRelogio${sfx}`, T.timer, {
      Duration: 1000,
      Repeat: true,
      AutoStart: true,
      Visible: false,
      OnTimerEnd: RELOGIO,
      ...pos(0, 0, 10, 10),
    }),
    c(`tmrAtualiza${sfx}`, T.timer, {
      Duration: 60000,
      Repeat: true,
      AutoStart: true,
      Visible: false,
      OnTimerEnd: `Select(btnAtualizar${sfx})`,
      ...pos(0, 0, 10, 10),
    }),
  ];
}

function cabecalho(sfx, textoTitulo, extras = []) {
  return linha(`conCab${sfx}`, 52, [
    lbl(`lblTitulo${sfx}`, textoTitulo, 0, 0, 520, 30, { Size: 18, FontWeight: "FontWeight.Semibold" }),
    lbl(
      `lblRelogio${sfx}`,
      `Text(varRelogio, "dddd, dd/mm/yyyy · hh:mm:ss") & "   ·   atualizado às " & Text(varUltimaAtualizacao, "hh:mm")`,
      0,
      30,
      620,
      20,
      { Size: 10, Color: "corTextoSuave" }
    ),
    ...extras,
    botao(`btnAtualizar${sfx}`, '"Atualizar"', ATUALIZA[sfx], "Parent.Width - 120", 8, 120, 36),
  ]);
}

// ---------------------------------------------------------------------------
// Rotinas de recarga de cada tela (botão "Atualizar", ao abrir e a cada 60 s)
// ---------------------------------------------------------------------------
const ATUALIZA = {
  P: `
Set(varTick, varTick + 1);
Refresh(Internacoes);
Refresh(SolicitacoesVaga);
Refresh(Importacoes);
ClearCollect(colInternados, Filter(Internacoes, Status = "INTERNADO"));
${CARREGA_VAGAS_ABERTAS};
ClearCollect(colImportDia, Filter(Importacoes, ChaveData = varChaveData && TipoGuia = "CENSO"));
If(
    varTick = 1 || Mod(varTick, 5) = 0 || CountRows(colVagas30d) = 0,
    ClearCollect(colSetores, Sort(Setores, Ordem));
    ClearCollect(colSetoresRotina, Filter(colSetores, Ativo && ExigeNaRotina));
    ClearCollect(colVagas30d, Filter(SolicitacoesVaga, SolicitadoEm >= DateAdd(Today(), -30, TimeUnit.Days)));
    ClearCollect(colCenso14d, Filter(CensoResumo, DataRef >= DateAdd(Today(), -14, TimeUnit.Days)))
);
${CALCULA_ROTINA};
Set(varUltimaAtualizacao, Now())`,
  R: `
Refresh(Importacoes);
Refresh(Internacoes);
ClearCollect(colImportDia, Filter(Importacoes, ChaveData = varChaveData && TipoGuia = "CENSO"));
ClearCollect(colImportRecentes, FirstN(Sort(Importacoes, ImportadoEm, SortOrder.Descending), 40));
ClearCollect(
    colSaidas,
    Filter(Internacoes, SaidaDetectadaEm >= DateAdd(Today(), -3, TimeUnit.Days) && (Status = "SAIDA_VERIFICAR" || Status = "ALTA_PRESUMIDA"))
);
${CALCULA_ROTINA};
Set(varUltimaAtualizacao, Now())`,
  V: `
Refresh(Internacoes);
Refresh(SolicitacoesVaga);
ClearCollect(colInternados, Filter(Internacoes, Status = "INTERNADO"));
${CARREGA_VAGAS_ABERTAS};
Set(varUltimaAtualizacao, Now())`,
};

// =========================================================================
// TELA 1 — PRINCIPAL
// =========================================================================
function minutosTexto(expr) {
  return `If(IsBlank(${expr}), "–", ${expr} >= 60, RoundDown(${expr} / 60, 0) & "h " & Text(Mod(${expr}, 60), "00") & "min", Text(${expr}, "0") & " min")`;
}

const CARD = (titulo, valor, cor, sub) =>
  `"<div style='flex:1 1 150px;min-width:150px;background:#FFFFFF;border:1px solid #D8DEE6;border-radius:12px;padding:10px 14px;box-sizing:border-box'>" &
        "<div style='font-size:12px;color:#5A6573'>${titulo}</div>" &
        "<div style='font-size:26px;font-weight:600;line-height:1.25;color:" & ${cor} & "'>" & ${valor} & "</div>" &
        "<div style='font-size:11px;color:#5A6573'>" & ${sub} & "</div>" &
    "</div>"`;

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

const CARD_FASE = (titulo, valor, sub) =>
  `"<div style='flex:1 1 200px;min-width:200px;background:#F7F8FA;border:1px dashed #C5CCD6;border-radius:12px;padding:10px 14px;box-sizing:border-box'>" &
        "<div style='font-size:12px;color:#5A6573'>${titulo}</div>" &
        "<div style='font-size:22px;font-weight:600;color:#1A2330'>" & ${valor} & "</div>" &
        "<div style='font-size:11px;color:#5A6573'>${sub}</div>" &
    "</div>"`;

const HTML_FASES = `
With(
    {
        perm: CountRows(Filter(colInternados, !IsBlank(DataInternacao) && DateDiff(DataInternacao, Today(), TimeUnit.Days) >= gDiasPermanencia)),
        altHoje: CountRows(Filter(colInternados, !IsBlank(PrevisaoAlta) && DateDiff(Today(), PrevisaoAlta, TimeUnit.Days) = 0)),
        altAmanha: CountRows(Filter(colInternados, !IsBlank(PrevisaoAlta) && DateDiff(Today(), PrevisaoAlta, TimeUnit.Days) = 1))
    },
    "<div style='display:flex;flex-wrap:wrap;gap:12px;font-family:Segoe UI,Arial,sans-serif'>" &
    ${CARD_FASE("Permanência ≥ 15 dias", "perm", "Kanban de pendências por especialidade na fase 2")} &
    ${CARD_FASE("Altas previstas hoje / amanhã", `altHoje & " / " & altAmanha`, "Previsões registradas pela equipe na fase 2")} &
    ${CARD_FASE("Ambulâncias (24 h / 48 h)", `"–"`, "Disponível na fase 3")} &
    ${CARD_FASE("Metas do mês", `"–"`, "Disponível na fase 4")} &
    "</div>"
)`;

function telaPrincipal() {
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
    ]),
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
    linha("conFasesP", 120, [
      titulo("lblSecFasesP", '"Próximas guias"', 0, 0, 500, 24),
      html("htmlFasesP", HTML_FASES, 0, 28, "Parent.Width", 90),
    ]),
  ]);

  return tela(
    "scrPrincipal",
    { Fill: "corFundo", OnVisible: "Select(btnAtualizarP)" },
    [...lateral("P", "PRINCIPAL"), conteudo, ...timers("P")]
  );
}

// =========================================================================
// TELA 2 — ROTINA DE ATUALIZAÇÃO
// =========================================================================
const IDX = (v) => `Trim(IfError(Index(cel, ${v}).Value, ""))`;

const PREVIA = `
Set(varPreviaFeita, true);
Set(varPreviaOk, false);
Set(varAvisos, "");
Set(varSetorImport, drpSetorR.Selected.Codigo);
Set(varJanelaImport, drpJanelaR.Selected.Codigo);
Set(varDataRefImport, dpDataR.SelectedDate);
Set(varChaveDataImport, Text(dpDataR.SelectedDate, "yyyy-mm-dd"));
Set(varChaveImport, varChaveDataImport & "|" & varJanelaImport);
If(
    IsBlank(varSetorImport),
    Notify("Escolha o setor do arquivo antes de pré-visualizar.", NotificationType.Warning),
    IsBlank(Trim(txtColarR.Text)),
    Notify("Cole o conteúdo do arquivo (Ctrl+A, Ctrl+C no Excel e Ctrl+V na caixa).", NotificationType.Warning),

    // 1) quebra o texto colado em linhas
    Set(varTextoColado, Substitute(txtColarR.Text, Char(13), ""));
    ClearCollect(colLinhasTmp, Split(varTextoColado, Char(10)));
    ClearCollect(colLinhas, ForAll(Sequence(CountRows(colLinhasTmp)) As n, {N: n.Value, Texto: Index(colLinhasTmp, n.Value).Value}));

    // 2) acha a linha de cabeçalho (a primeira que tem a coluna de atendimento)
    ClearCollect(colSinAtend, Filter(tblMapaColunas, Campo = "NrAtendimento"));
    Set(
        varLinhaCab,
        First(Filter(colLinhas, CountRows(Filter(Split(Lower(Texto), Char(9)), Trim(Value) in colSinAtend.Sinonimo)) > 0)).N
    );
    If(
        IsBlank(varLinhaCab),
        Notify("Não encontrei a linha de cabeçalho com a coluna de atendimento. Confira se copiou o arquivo inteiro.", NotificationType.Error),

        // 3) mapa das colunas: em que posição está cada campo
        Set(varTextoCab, LookUp(colLinhas, N = varLinhaCab, Texto));
        ClearCollect(colCabTmp, Split(varTextoCab, Char(9)));
        ClearCollect(colCab, ForAll(Sequence(CountRows(colCabTmp)) As i, {I: i.Value, Nome: Lower(Trim(Index(colCabTmp, i.Value).Value))}));
        ClearCollect(
            colMapa,
            ForAll(Distinct(tblMapaColunas, Campo) As m, {Campo: m.Value, I: LookUp(colCab, Nome in Filter(tblMapaColunas, Campo = m.Value).Sinonimo, I)})
        );
        Set(viAtend, LookUp(colMapa, Campo = "NrAtendimento", I));
        Set(viPac, LookUp(colMapa, Campo = "Paciente", I));
        Set(viPront, LookUp(colMapa, Campo = "Prontuario", I));
        Set(viLeito, LookUp(colMapa, Campo = "Leito", I));
        Set(viDataInt, LookUp(colMapa, Campo = "DataInternacao", I));
        Set(viMedico, LookUp(colMapa, Campo = "Medico", I));
        Set(viEsp, LookUp(colMapa, Campo = "Especialidade", I));
        Set(viConv, LookUp(colMapa, Campo = "Convenio", I));
        Set(viDiag, LookUp(colMapa, Campo = "Diagnostico", I));
        Set(viIdade, LookUp(colMapa, Campo = "Idade", I));
        Set(viSexo, LookUp(colMapa, Campo = "Sexo", I));
        Set(viSetor, LookUp(colMapa, Campo = "SetorTasy", I));
        Set(viPrev, LookUp(colMapa, Campo = "PrevisaoAlta", I));

        // 4) lê as linhas de pacientes
        ClearCollect(
            colCensoTmp,
            ForAll(
                Filter(colLinhas, N > varLinhaCab && !IsBlank(Trim(Texto))) As l,
                With(
                    {cel: Split(l.Texto, Char(9))},
                    {
                        N: l.N,
                        NrAtendimento: Substitute(Substitute(${IDX("viAtend")}, ".", ""), " ", ""),
                        Paciente: ${IDX("viPac")},
                        Prontuario: ${IDX("viPront")},
                        Leito: ${IDX("viLeito")},
                        DataInternacaoTxt: ${IDX("viDataInt")},
                        Medico: ${IDX("viMedico")},
                        Especialidade: ${IDX("viEsp")},
                        Convenio: ${IDX("viConv")},
                        Diagnostico: ${IDX("viDiag")},
                        Idade: ${IDX("viIdade")},
                        Sexo: ${IDX("viSexo")},
                        SetorTasy: ${IDX("viSetor")},
                        PrevisaoAltaTxt: ${IDX("viPrev")}
                    }
                )
            )
        );
        ClearCollect(
            colCensoValido,
            AddColumns(
                Filter(colCensoTmp, IsMatch(NrAtendimento, "[0-9]+")),
                DataInternacao, IfError(DateTimeValue(DataInternacaoTxt, "pt-BR"), Blank()),
                PrevisaoAlta, IfError(DateValue(PrevisaoAltaTxt, "pt-BR"), Blank())
            )
        );
        Set(varIgnoradas, CountRows(colCensoTmp) - CountRows(colCensoValido));
        ClearCollect(colCenso, ForAll(Distinct(colCensoValido, NrAtendimento) As d, LookUp(colCensoValido, NrAtendimento = d.Value)));

        // 5) compara com o que já está gravado
        ClearCollect(colBase, Filter(Internacoes, Status = "INTERNADO" || Status = "SAIDA_VERIFICAR"));
        ClearCollect(
            colPreviaTmp,
            ForAll(
                colCenso As r,
                With(
                    {ex: LookUp(colBase, Title = r.NrAtendimento)},
                    With(
                        {ex2: If(IsBlank(ex.ID), LookUp(Internacoes, Title = r.NrAtendimento), Blank())},
                        With(
                        {
                            antId: Coalesce(ex.ID, ex2.ID),
                            antStatus: Coalesce(ex.Status, ex2.Status),
                            antSetor: Coalesce(ex.SetorCodigo, ex2.SetorCodigo),
                            antLeito: Coalesce(ex.Leito, ex2.Leito),
                            antData: Coalesce(ex.DataInternacao, ex2.DataInternacao)
                        },
                        {
                            NrAtendimento: r.NrAtendimento,
                            Paciente: r.Paciente,
                            Prontuario: r.Prontuario,
                            Leito: r.Leito,
                            DataInternacao: r.DataInternacao,
                            Medico: r.Medico,
                            Especialidade: r.Especialidade,
                            Convenio: r.Convenio,
                            Diagnostico: r.Diagnostico,
                            Idade: r.Idade,
                            Sexo: r.Sexo,
                            PrevisaoAlta: r.PrevisaoAlta,
                            ItemId: antId,
                            StatusAnterior: antStatus,
                            SetorAnterior: antSetor,
                            LeitoAnterior: antLeito,
                            DataIntEfetiva: Coalesce(r.DataInternacao, antData),
                            Classe: If(
                                IsBlank(antId), "NOVO",
                                antSetor <> varSetorImport, "TRANSFERENCIA",
                                antStatus <> "INTERNADO", "RETORNO",
                                !IsBlank(r.Leito) && antLeito <> r.Leito, "TROCA_LEITO",
                                "SEM_MUDANCA"
                            )
                        }
                        )
                    )
                )
            )
        );
        ClearCollect(
            colPrevia,
            AddColumns(colPreviaTmp, Dias, If(IsBlank(DataIntEfetiva), Blank(), DateDiff(DataIntEfetiva, Now(), TimeUnit.Days)))
        );
        ClearCollect(
            colAusentes,
            Filter(colBase, SetorCodigo = varSetorImport && Status = "INTERNADO" && !(Title in colCenso.NrAtendimento))
        );

        // 6) avisos para conferência
        Set(
            varAvisos,
            Concat(
                Filter(tblCamposImportacao As f, f.Obrigatorio && IsBlank(LookUp(colMapa, Campo = f.Campo, I))),
                "Coluna não encontrada: " & Value & ". "
            ) &
            If(
                !IsBlank(viSetor) && !IsBlank(LookUp(colSetores, Codigo = varSetorImport, NomeTasy)) &&
                CountRows(Filter(colCenso, Lower(SetorTasy) = Lower(LookUp(colSetores, Codigo = varSetorImport, NomeTasy)))) = 0,
                "A coluna Setor do arquivo não bate com " & LookUp(colSetores, Codigo = varSetorImport, NomeTasy) & ": confira se escolheu o setor certo. ",
                ""
            ) &
            If(
                !IsBlank(LookUp(Importacoes, JanelaChave = varChaveImport && SetorCodigo = varSetorImport && TipoGuia = "CENSO", ID)),
                "Este setor já foi importado nesta rotina: a nova importação atualiza os dados. ",
                ""
            ) &
            If(CountRows(colCenso) = 0, "Nenhum paciente no arquivo: confirme só se o setor estiver realmente vazio. ", "")
        );
        Set(varPreviaOk, true)
    )
)`;

const CONFIRMA = `
Set(varProcessando, true);
Set(varAgoraImport, Now());

// 1) cria ou atualiza as internações
ForAll(
    colPrevia As p,
    If(
        IsBlank(p.ItemId),
        Patch(
            Internacoes,
            Defaults(Internacoes),
            {
                Title: p.NrAtendimento,
                Prontuario: p.Prontuario,
                Paciente: p.Paciente,
                Idade: p.Idade,
                Sexo: p.Sexo,
                SetorCodigo: varSetorImport,
                Leito: p.Leito,
                DataInternacao: p.DataInternacao,
                Medico: p.Medico,
                Especialidade: p.Especialidade,
                Convenio: p.Convenio,
                Diagnostico: p.Diagnostico,
                Status: "INTERNADO",
                PrimeiraVezVistoEm: varAgoraImport,
                UltimaVezVistoEm: varAgoraImport,
                UltimaJanelaChave: varChaveImport,
                PrevisaoAlta: p.PrevisaoAlta
            }
        ),
        With(
            {atual: LookUp(Internacoes, ID = p.ItemId)},
            Patch(
                Internacoes,
                atual,
                {
                    Prontuario: Coalesce(p.Prontuario, atual.Prontuario),
                    Paciente: Coalesce(p.Paciente, atual.Paciente),
                    Idade: Coalesce(p.Idade, atual.Idade),
                    Sexo: Coalesce(p.Sexo, atual.Sexo),
                    SetorCodigo: varSetorImport,
                    Leito: Coalesce(p.Leito, atual.Leito),
                    DataInternacao: Coalesce(p.DataInternacao, atual.DataInternacao),
                    Medico: Coalesce(p.Medico, atual.Medico),
                    Especialidade: Coalesce(p.Especialidade, atual.Especialidade),
                    Convenio: Coalesce(p.Convenio, atual.Convenio),
                    Diagnostico: Coalesce(p.Diagnostico, atual.Diagnostico),
                    Status: "INTERNADO",
                    UltimaVezVistoEm: varAgoraImport,
                    UltimaJanelaChave: varChaveImport,
                    SaidaDetectadaEm: Blank(),
                    PrevisaoAlta: Coalesce(p.PrevisaoAlta, atual.PrevisaoAlta)
                }
            )
        )
    )
);

// 2) registra as mudanças (admissões, transferências, trocas de leito, retornos)
Collect(
    Movimentacoes,
    ForAll(
        Filter(colPrevia, Classe <> "SEM_MUDANCA") As p,
        {
            Title: p.NrAtendimento,
            Paciente: p.Paciente,
            SetorDe: If(p.Classe = "NOVO", "", p.SetorAnterior),
            LeitoDe: If(p.Classe = "NOVO", "", p.LeitoAnterior),
            SetorPara: varSetorImport,
            LeitoPara: p.Leito,
            Tipo: If(p.Classe = "NOVO", "ADMISSAO", p.Classe),
            DetectadoEm: varAgoraImport,
            JanelaChave: varChaveImport,
            PorEmail: gUsuarioEmail
        }
    )
);

// 3) quem não apareceu mais neste setor vira "saída a verificar"
ForAll(colAusentes As a, Patch(Internacoes, LookUp(Internacoes, ID = a.ID), {Status: "SAIDA_VERIFICAR", SaidaDetectadaEm: varAgoraImport}));
Collect(
    Movimentacoes,
    ForAll(
        colAusentes As a,
        {
            Title: a.Title,
            Paciente: a.Paciente,
            SetorDe: a.SetorCodigo,
            LeitoDe: a.Leito,
            SetorPara: "",
            LeitoPara: "",
            Tipo: "SAIDA_VERIFICAR",
            DetectadoEm: varAgoraImport,
            JanelaChave: varChaveImport,
            PorEmail: gUsuarioEmail
        }
    )
);

// 4) paciente com leito cedido que chegou ao setor de destino → transferência concluída
ForAll(
    Filter(colPrevia, Classe = "TRANSFERENCIA") As p,
    With(
        {s: LookUp(SolicitacoesVaga, Title = p.NrAtendimento && Status = "LEITO_CEDIDO" && SetorDestino = varSetorImport)},
        If(
            !IsBlank(s.ID),
            Patch(SolicitacoesVaga, s, {Status: "CONCLUIDA", ConcluidoEm: varAgoraImport, AtualizadoPorEmail: gUsuarioEmail});
            Patch(
                EventosVaga,
                Defaults(EventosVaga),
                {
                    Title: "CONCLUIDA",
                    SolicitacaoId: s.ID,
                    NrAtendimento: p.NrAtendimento,
                    ValorDe: "LEITO_CEDIDO",
                    ValorPara: "CONCLUIDA",
                    Em: varAgoraImport,
                    PorEmail: gUsuarioEmail,
                    PorNome: "Rotina de atualização",
                    Observacao: "Paciente encontrado no setor de destino no censo " & varChaveImport
                }
            )
        )
    )
);

// 5) resumo do setor nesta rotina (base das tendências)
With(
    {
        reg: LookUp(CensoResumo, Title = varChaveImport & "|" & varSetorImport),
        n: CountRows(colPrevia),
        leitos: LookUp(colSetores, Codigo = varSetorImport, LeitosOperacionais)
    },
    Patch(
        CensoResumo,
        If(IsBlank(reg.ID), Defaults(CensoResumo), reg),
        {
            Title: varChaveImport & "|" & varSetorImport,
            ChaveData: varChaveDataImport,
            DataRef: varDataRefImport,
            Janela: varJanelaImport,
            SetorCodigo: varSetorImport,
            Pacientes: n,
            Leitos: leitos,
            OcupacaoPct: If(leitos > 0, Round(n / leitos * 100, 1), Blank()),
            Perm15d: CountRows(Filter(colPrevia, Dias >= gDiasPermanencia)),
            PermMediaDias: IfError(Round(Average(colPrevia, Dias), 1), 0),
            ImportadoEm: varAgoraImport
        }
    )
);

// 6) log da importação, com o arquivo original anexado (formulário frmAnexo)
Patch(
    Importacoes,
    Defaults(Importacoes),
    frmAnexo.Updates,
    {
        Title: varChaveImport & "|" & varSetorImport & "|CENSO",
        ChaveData: varChaveDataImport,
        DataRef: varDataRefImport,
        Janela: varJanelaImport,
        JanelaChave: varChaveImport,
        TipoGuia: "CENSO",
        SetorCodigo: varSetorImport,
        Linhas: CountRows(colPrevia),
        Novos: CountRows(Filter(colPrevia, Classe = "NOVO")),
        Transferidos: CountRows(Filter(colPrevia, Classe = "TRANSFERENCIA")),
        TrocasLeito: CountRows(Filter(colPrevia, Classe = "TROCA_LEITO")),
        Retornos: CountRows(Filter(colPrevia, Classe = "RETORNO")),
        Saidas: CountRows(colAusentes),
        Ignoradas: varIgnoradas,
        Status: "PROCESSADO",
        EnviadoPorEmail: gUsuarioEmail,
        EnviadoPorNome: gUsuarioNome,
        ImportadoEm: varAgoraImport,
        Observacao: varAvisos
    }
);
ResetForm(frmAnexo);

// 7) rotina completa (todos os setores)? quem não apareceu em nenhum setor vira alta presumida
Refresh(Importacoes);
ClearCollect(colImportJanela, Filter(Importacoes, JanelaChave = varChaveImport && TipoGuia = "CENSO"));
If(
    CountRows(Filter(colSetoresRotina, !(Codigo in colImportJanela.SetorCodigo))) = 0,
    ClearCollect(colSaidasPend, Filter(Internacoes, Status = "SAIDA_VERIFICAR"));
    ForAll(colSaidasPend As s, Patch(Internacoes, LookUp(Internacoes, ID = s.ID), {Status: "ALTA_PRESUMIDA"}));
    Collect(
        Movimentacoes,
        ForAll(
            colSaidasPend As s,
            {
                Title: s.Title,
                Paciente: s.Paciente,
                SetorDe: s.SetorCodigo,
                LeitoDe: s.Leito,
                SetorPara: "",
                LeitoPara: "",
                Tipo: "ALTA_PRESUMIDA",
                DetectadoEm: varAgoraImport,
                JanelaChave: varChaveImport,
                PorEmail: gUsuarioEmail
            }
        )
    );
    Notify(
        "Rotina completa! " & CountRows(colSaidasPend) & " paciente(s) que não apareceram em nenhum setor ficaram como alta presumida. Confira no painel de saídas.",
        NotificationType.Information
    ),
    Notify(
        "Censo de " & LookUp(colSetores, Codigo = varSetorImport, Sigla) & " importado: " & CountRows(colPrevia) & " pacientes.",
        NotificationType.Success
    )
);

// 8) prepara o próximo setor
Set(varSetorSugerido, First(Filter(colSetoresRotina, !(Codigo in colImportJanela.SetorCodigo))).Title);
Reset(drpSetorR);
Reset(txtColarR);
Clear(colPrevia);
Clear(colAusentes);
Clear(colMapa);
Set(varPreviaOk, false);
Set(varPreviaFeita, false);
Set(varProcessando, false);
Select(btnAtualizarR)`;

const ARQUIVAR = (form, tipoExpr, setorExpr, obsCtrl) => `
With(
    {
        chave: Text(dpDataR.SelectedDate, "yyyy-mm-dd"),
        jan: drpJanelaR.Selected.Codigo,
        tipo: ${tipoExpr},
        setor: ${setorExpr}
    },
    Patch(
        Importacoes,
        Defaults(Importacoes),
        ${form}.Updates,
        {
            Title: chave & "|" & jan & "|" & setor & "|" & tipo,
            ChaveData: chave,
            DataRef: dpDataR.SelectedDate,
            Janela: jan,
            JanelaChave: chave & "|" & jan,
            TipoGuia: tipo,
            SetorCodigo: setor,
            Linhas: 0,
            Status: "ARQUIVADO",
            EnviadoPorEmail: gUsuarioEmail,
            EnviadoPorNome: gUsuarioNome,
            ImportadoEm: Now(),
            Observacao: ${obsCtrl}.Text
        }
    );
    ResetForm(${form});
    Reset(${obsCtrl});
    Notify("Arquivo registrado na Rotina de Atualização.", NotificationType.Success);
    Select(btnAtualizarR)
)`;

const SAIDA_ACAO = (status, tipoMov, rotulo) => `
With(
    {reg: ThisItem},
    Patch(
        Internacoes,
        LookUp(Internacoes, ID = reg.ID),
        ${status === "INTERNADO" ? `{Status: "INTERNADO", SaidaDetectadaEm: Blank()}` : `{Status: "${status}", SaidaConfirmadaEm: Now()}`}
    );
    Patch(
        Movimentacoes,
        Defaults(Movimentacoes),
        {
            Title: reg.Title,
            Paciente: reg.Paciente,
            SetorDe: reg.SetorCodigo,
            LeitoDe: reg.Leito,
            SetorPara: ${status === "INTERNADO" ? "reg.SetorCodigo" : '""'},
            LeitoPara: ${status === "INTERNADO" ? "reg.Leito" : '""'},
            Tipo: "${tipoMov}",
            DetectadoEm: Now(),
            JanelaChave: varJanelaChave,
            PorEmail: gUsuarioEmail
        }
    );
    Remove(colSaidas, reg);
    Notify(reg.Paciente & ": ${rotulo}.", NotificationType.Success)
)`;

function telaRotina() {
  const ehCenso = "drpTipoR.Selected.Codigo = \"CENSO\"";
  const conteudo = rolagem("conRotina", [
    cabecalho("R", `"Rotina de Atualização"`),
    linha("conProgR", 146, [
      titulo("lblSecProgR", '"Progresso das rotinas do dia"', 0, 0, 500, 24),
      imagem("imgRotinaR", SVG_ROTINA, 0, 26, "Parent.Width", 96),
      lbl("lblFaltamR", TEXTO_FALTAM, 0, 124, "Parent.Width", 22, { Size: 10, Color: "corTextoSuave" }),
    ]),

    // ---------------- seção (a) ----------------
    linha("conImportR", 780, [
      retangulo("recImportR", 0, 0, "Parent.Width", 780),
      titulo("lblSecImportR", '"a) Arquivos das guias: censo do setor (Ctrl+E do Tasy) e outros documentos"', 16, 10, 900, 26),

      lbl("lblTipoR", '"Tipo de arquivo / guia de destino"', 16, 44, 340, 20, { Size: 10, Color: "corTextoSuave" }),
      dropdown("drpTipoR", "tblTiposGuia", 16, 64, 340, {
        Default: '"Censo do setor (Ctrl+E do Tasy)"',
        OnChange: "Set(varPreviaOk, false)",
      }),
      lbl("lblSetorR", '"Setor"', 372, 44, 260, 20, { Size: 10, Color: "corTextoSuave" }),
      dropdown(
        "drpSetorR",
        "ForAll(Filter(colSetores, Ativo) As s, {Value: s.Title, Codigo: s.Codigo})",
        372,
        64,
        260,
        { AllowEmptySelection: true, Default: "varSetorSugerido", OnChange: "Set(varPreviaOk, false)" }
      ),
      lbl("lblJanelaR", '"Rotina"', 648, 44, 200, 20, { Size: 10, Color: "corTextoSuave" }),
      dropdown(
        "drpJanelaR",
        `ForAll(tblJanelas As j, {Value: j.Rotulo & " · " & Text(j.HoraPrevista, "00") & "h", Codigo: j.Codigo})`,
        648,
        64,
        200,
        {
          Default: `LookUp(tblJanelas, Codigo = varJanela, Rotulo & " · " & Text(HoraPrevista, "00") & "h")`,
          OnChange: "Set(varPreviaOk, false)",
        }
      ),
      lbl("lblDataR", '"Dia do NIR"', 864, 44, 170, 20, { Size: 10, Color: "corTextoSuave" }),
      c("dpDataR", T.datepicker, {
        DefaultDate: "varDataRef",
        ...pos(864, 64, 170, 36),
        Font: FONTE,
        Size: 11,
        Format: "DateTimeFormat.ShortDate",
        OnChange: "Set(varPreviaOk, false)",
      }),

      lbl("lblAnexoR", '"1. Anexe o arquivo original (fica guardado para auditoria)"', 16, 112, 520, 22, {
        FontWeight: "FontWeight.Semibold",
        Size: 10,
      }),
      retangulo("recAnexoAreaR", 16, 136, 520, 150, { Fill: "corFundo", BorderStyle: "BorderStyle.Dashed" }),
      lbl(
        "lblAnexoDicaR",
        '"Coloque aqui o formulário frmAnexo (lista Importacoes, só o campo Anexos). Veja o passo 9 do guia de montagem."',
        28,
        180,
        496,
        60,
        { Size: 10, Color: "corTextoSuave", Align: "Align.Center" }
      ),

      lbl(
        "lblColarR",
        '"2. No Excel: Ctrl+A e Ctrl+C. Aqui: clique na caixa e Ctrl+V"',
        552,
        112,
        "Parent.Width - 568",
        22,
        { FontWeight: "FontWeight.Semibold", Size: 10, Visible: ehCenso }
      ),
      entrada("txtColarR", 552, 136, "Parent.Width - 568", 150, {
        Mode: "TextMode.MultiLine",
        HintText: '"Cole aqui o conteúdo do arquivo do Tasy (Ctrl+V)"',
        Size: 9,
        Visible: ehCenso,
        OnChange: "Set(varPreviaOk, false)",
      }),
      lbl("lblObsR", '"2. Observação (opcional)"', 552, 112, "Parent.Width - 568", 22, {
        FontWeight: "FontWeight.Semibold",
        Size: 10,
        Visible: `!(${ehCenso})`,
      }),
      entrada("txtObsR", 552, 136, "Parent.Width - 568", 90, {
        Mode: "TextMode.MultiLine",
        HintText: '"Ex.: previsões de alta enviadas pela UI 6º andar"',
        Visible: `!(${ehCenso})`,
      }),
      botao(
        "btnArquivarR",
        '"Registrar arquivo"',
        ARQUIVAR(
          "frmAnexo",
          "drpTipoR.Selected.Codigo",
          'If(IsBlank(drpSetorR.Selected.Codigo), "", drpSetorR.Selected.Codigo)',
          "txtObsR"
        ),
        552,
        240,
        200,
        40,
        { Visible: `!(${ehCenso})`, DisplayMode: "If(gEhNIR, DisplayMode.Edit, DisplayMode.Disabled)" }
      ),

      botao("btnPreviaR", '"3. Pré-visualizar"', PREVIA, 16, 300, 200, 40, { Visible: ehCenso }),
      botaoSec(
        "btnLimparR",
        '"Limpar"',
        "Reset(txtColarR); Clear(colPrevia); Clear(colAusentes); Clear(colMapa); Set(varPreviaOk, false); Set(varPreviaFeita, false); Set(varProcessando, false)",
        228,
        300,
        110,
        40,
        { Visible: ehCenso }
      ),

      lbl(
        "lblMapaR",
        `"Colunas reconhecidas: " & Concat(Filter(tblCamposImportacao As f, !IsBlank(LookUp(colMapa, Campo = f.Campo, I))), Value, ", ")`,
        16,
        350,
        "Parent.Width - 32",
        22,
        { Size: 10, Color: "corTextoSuave", Visible: `${ehCenso} && varPreviaOk` }
      ),
      lbl(
        "lblResumoR",
        `CountRows(colPrevia) & " pacientes no arquivo  ·  " &
        CountRows(Filter(colPrevia, Classe = "NOVO")) & " novos  ·  " &
        CountRows(Filter(colPrevia, Classe = "TRANSFERENCIA")) & " transferidos para cá  ·  " &
        CountRows(Filter(colPrevia, Classe = "TROCA_LEITO")) & " trocas de leito  ·  " &
        CountRows(Filter(colPrevia, Classe = "RETORNO")) & " retornos  ·  " &
        CountRows(colAusentes) & " não aparecem mais  ·  " &
        varIgnoradas & " linhas ignoradas"`,
        16,
        374,
        "Parent.Width - 32",
        24,
        { FontWeight: "FontWeight.Semibold", Visible: `${ehCenso} && varPreviaOk` }
      ),
      lbl("lblAvisosR", "varAvisos", 16, 400, "Parent.Width - 32", 22, {
        Size: 10,
        Color: "corVermelho",
        Visible: `${ehCenso} && varPreviaOk && !IsBlank(varAvisos)`,
      }),
      lbl(
        "lblAusentesR",
        `"Não aparecem mais neste setor (ficarão como saída a verificar): " & Concat(colAusentes, Leito & " " & Paciente, "; ")`,
        16,
        424,
        "Parent.Width - 32",
        40,
        { Size: 10, Color: "corAmarelo", Visible: `${ehCenso} && varPreviaOk && CountRows(colAusentes) > 0` }
      ),
      galeria(
        "galPreviaR",
        `Sort(colPrevia, If(Classe = "SEM_MUDANCA", "2", "1") & Leito)`,
        16,
        468,
        "Parent.Width - 32",
        236,
        34,
        [
          c("recClassePrevR", T.rect, {
            ...pos(0, 9, 8, 16),
            Fill: `ColorValue(LookUp(tblClassesPrevia, Codigo = ThisItem.Classe, Hex))`,
          }),
          lbl("lblClassePrevR", `LookUp(tblClassesPrevia, Codigo = ThisItem.Classe, Value)`, 14, 4, 190, 26, { Size: 10 }),
          lbl("lblLeitoPrevR", "ThisItem.Leito", 208, 4, 90, 26, { Size: 10, FontWeight: "FontWeight.Semibold" }),
          lbl("lblPacPrevR", "ThisItem.Paciente", 302, 4, 300, 26, { Size: 10 }),
          lbl("lblAtendPrevR", '"Atend. " & ThisItem.NrAtendimento', 606, 4, 140, 26, { Size: 10, Color: "corTextoSuave" }),
          lbl(
            "lblIntPrevR",
            `If(IsBlank(ThisItem.DataIntEfetiva), "sem data de internação", Text(ThisItem.DataIntEfetiva, "dd/mm/yyyy") & " · " & ThisItem.Dias & " dias")`,
            750,
            4,
            200,
            26,
            { Size: 10, Color: "corTextoSuave" }
          ),
          lbl(
            "lblAntPrevR",
            `If(ThisItem.Classe = "TRANSFERENCIA", "veio de " & ${SIGLA("ThisItem.SetorAnterior")}, ThisItem.Classe = "TROCA_LEITO", "leito anterior " & ThisItem.LeitoAnterior, "")`,
            954,
            4,
            "Parent.TemplateWidth - 958",
            26,
            { Size: 10, Color: "corTextoSuave" }
          ),
        ],
        { Visible: `${ehCenso} && varPreviaOk` }
      ),
      botao("btnConfirmarR", '"4. Confirmar importação"', CONFIRMA, 16, 720, 260, 44, {
        Visible: ehCenso,
        DisplayMode: "If(varPreviaOk && !varProcessando && gEhNIR, DisplayMode.Edit, DisplayMode.Disabled)",
      }),
      lbl(
        "lblConfirmarDicaR",
        `If(varProcessando, "Gravando... aguarde a mensagem de conclusão.", !varPreviaOk, "Pré-visualize antes de confirmar.", "Confira a prévia acima e confirme.")`,
        292,
        728,
        600,
        28,
        { Size: 10, Color: "corTextoSuave", Visible: ehCenso }
      ),
    ]),

    // ---------------- saídas a verificar ----------------
    linha("conSaidasR", 330, [
      retangulo("recSaidasR", 0, 0, "Parent.Width", 330),
      titulo("lblSecSaidasR", `"Saídas a verificar e altas presumidas (últimos 3 dias): " & CountRows(colSaidas)`, 16, 10, 800, 26),
      lbl(
        "lblSaidasDicaR",
        '"Pacientes que sumiram do censo. Se a rotina terminar sem que reapareçam em outro setor, viram alta presumida. Confirme o desfecho ou corrija."',
        16,
        36,
        "Parent.Width - 32",
        22,
        { Size: 10, Color: "corTextoSuave" }
      ),
      galeria(
        "galSaidasR",
        "Sort(colSaidas, SaidaDetectadaEm, SortOrder.Descending)",
        16,
        62,
        "Parent.Width - 32",
        260,
        52,
        [
          lbl("lblSaidaPacR", `ThisItem.Paciente & "  ·  atend. " & ThisItem.Title`, 0, 4, 420, 24, {
            FontWeight: "FontWeight.Semibold",
            Size: 10,
          }),
          lbl(
            "lblSaidaInfoR",
            `${SIGLA("ThisItem.SetorCodigo")} & " · leito " & ThisItem.Leito & " · " & LookUp(tblStatusInternacao, Codigo = ThisItem.Status, Value) & " desde " & Text(ThisItem.SaidaDetectadaEm, "dd/mm hh:mm")`,
            0,
            26,
            420,
            22,
            { Size: 9, Color: `If(ThisItem.Status = "ALTA_PRESUMIDA", corAmarelo, corTextoSuave)` }
          ),
          botaoSec("btnSaidaAltaR", '"Alta confirmada"', SAIDA_ACAO("ALTA_CONFIRMADA", "ALTA_CONFIRMADA", "alta confirmada"), 430, 8, 130, 34, { Size: 9, Visible: "gEhNIR" }),
          botaoSec("btnSaidaObitoR", '"Óbito"', SAIDA_ACAO("OBITO", "OBITO", "óbito registrado"), 566, 8, 80, 34, { Size: 9, Visible: "gEhNIR" }),
          botaoSec("btnSaidaExtR", '"Transf. externa"', SAIDA_ACAO("TRANSFERIDO_EXTERNO", "TRANSFERIDO_EXTERNO", "transferência externa registrada"), 652, 8, 130, 34, { Size: 9, Visible: "gEhNIR" }),
          botaoSec("btnSaidaSegueR", '"Segue internado"', SAIDA_ACAO("INTERNADO", "CORRECAO", "voltou para internado"), 788, 8, 130, 34, { Size: 9, Visible: "gEhNIR" }),
          c("recSepSaidaR", T.rect, { ...pos(0, 51, "Parent.TemplateWidth", 1), Fill: "corBorda" }),
        ]
      ),
    ]),

    // ---------------- seção (b) metas ----------------
    linha("conMetasR", 230, [
      retangulo("recMetasR", 0, 0, "Parent.Width", 230),
      titulo("lblSecMetasR", '"b) Metas institucionais"', 16, 10, 500, 26),
      lbl(
        "lblMetasDicaR",
        '"Anexe aqui as planilhas de metas e indicadores. Nesta fase os arquivos ficam guardados com data e autor. Na fase 4 o modelo padrão de metas passa a ser lido automaticamente e alimenta a guia Metas."',
        16,
        38,
        "Parent.Width - 32",
        40,
        { Size: 10, Color: "corTextoSuave" }
      ),
      retangulo("recAnexoMetasR", 16, 82, 520, 136, { Fill: "corFundo", BorderStyle: "BorderStyle.Dashed" }),
      lbl(
        "lblAnexoMetasDicaR",
        '"Coloque aqui o formulário frmAnexoMetas (lista Importacoes, só o campo Anexos)."',
        28,
        124,
        496,
        50,
        { Size: 10, Color: "corTextoSuave", Align: "Align.Center" }
      ),
      entrada("txtObsMetasR", 552, 82, "Parent.Width - 568", 80, {
        Mode: "TextMode.MultiLine",
        HintText: '"Ex.: indicadores de outubro enviados pela Qualidade"',
      }),
      botao(
        "btnArquivarMetasR",
        '"Registrar arquivo de metas"',
        ARQUIVAR("frmAnexoMetas", '"METAS"', '""', "txtObsMetasR"),
        552,
        176,
        240,
        40,
        { DisplayMode: "If(gEhNIR, DisplayMode.Edit, DisplayMode.Disabled)" }
      ),
    ]),

    // ---------------- histórico ----------------
    linha("conHistR", 330, [
      retangulo("recHistR", 0, 0, "Parent.Width", 330),
      titulo("lblSecHistR", '"Últimas importações"', 16, 10, 500, 26),
      galeria(
        "galHistR",
        "colImportRecentes",
        16,
        42,
        "Parent.Width - 32",
        280,
        46,
        [
          lbl(
            "lblHist1R",
            `Text(ThisItem.ImportadoEm, "dd/mm hh:mm") & "  ·  " & Coalesce(LookUp(tblJanelas, Codigo = ThisItem.Janela, Rotulo), ThisItem.Janela) & "  ·  " & Coalesce(LookUp(tblTiposGuia, Codigo = ThisItem.TipoGuia, Value), ThisItem.TipoGuia) & If(IsBlank(ThisItem.SetorCodigo), "", "  ·  " & ${SIGLA("ThisItem.SetorCodigo")})`,
            0,
            2,
            "Parent.TemplateWidth - 140",
            22,
            { Size: 10, FontWeight: "FontWeight.Semibold" }
          ),
          lbl(
            "lblHist2R",
            `If(ThisItem.Status = "PROCESSADO", ThisItem.Linhas & " pacientes · " & ThisItem.Novos & " novos · " & ThisItem.Transferidos & " transf. · " & ThisItem.Saidas & " saídas · ", "arquivado · ") & "por " & ThisItem.EnviadoPorNome`,
            0,
            22,
            "Parent.TemplateWidth - 140",
            20,
            { Size: 9, Color: "corTextoSuave" }
          ),
          botaoSec(
            "btnHistAbrirR",
            '"Abrir item"',
            `Launch(gUrlSite & "/Lists/Importacoes/DispForm.aspx?ID=" & ThisItem.ID)`,
            "Parent.TemplateWidth - 120",
            6,
            110,
            32,
            { Size: 9 }
          ),
          c("recSepHistR", T.rect, { ...pos(0, 45, "Parent.TemplateWidth", 1), Fill: "corBorda" }),
        ]
      ),
    ]),
  ]);

  return tela(
    "scrRotina",
    { Fill: "corFundo", OnVisible: "Select(btnAtualizarR)" },
    [...lateral("R", "ROTINA"), conteudo, ...timers("R")]
  );
}

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

function telaVagas() {
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
      entrada("txtBuscaV", 34, 144, 352, 36, { HintText: '"Buscar paciente, atendimento ou leito"' }),
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
function gerar(pasta, ptbr) {
  SINTAXE_PTBR = ptbr;
  mkdirSync(pasta, { recursive: true });
  const arquivos = {
    "1-Principal.pa.yaml": telaPrincipal(),
    "2-RotinaAtualizacao.pa.yaml": telaRotina(),
    "3-GestaoVagas.pa.yaml": telaVagas(),
  };
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    writeFileSync(join(pasta, nome), conteudo, "utf8");
    console.log("gerado:", join(pasta.slice(pasta.indexOf("nir")), nome), `(${conteudo.split("\n").length} linhas)`);
  }
}
gerar(SAIDA, false); // padrão: sintaxe en-US (a usada pelo código das telas do Power Apps)
gerar(join(SAIDA, "pt-BR"), true); // alternativa, se o Studio recusar a versão padrão
