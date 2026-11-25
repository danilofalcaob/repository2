// Base comum das telas do Power Apps: serialização YAML, construtores de controles e blocos de fórmulas compartilhados.
// Gera as telas do Power Apps (nir/powerapps/telas/*.pa.yaml).
//
// As três telas compartilham blocos (menu lateral, relógio, cronômetros,
// barra da rotina). Elas são montadas aqui, a partir de uma única definição,
// para que nenhuma cópia fique diferente da outra.
//
// Uso:  node nir/ferramentas/gerar-telas.mjs
// Os arquivos gerados são os que você cola no Power Apps Studio.
import { converterPtBr } from "../converter-ptbr.mjs";

let SINTAXE_PTBR = false; // quando true, as fórmulas saem com ; e ;; (cópia em telas/pt-BR)
export function definirSintaxePtBr(v) { SINTAXE_PTBR = v; }

// ---------------------------------------------------------------------------
// Tipos de controle (formato de código do Power Apps Studio — pa.yaml)
// ---------------------------------------------------------------------------
export const T = {
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
export function dedent(s) {
  const linhas = String(s).replace(/\t/g, "    ").split("\n");
  while (linhas.length && !linhas[0].trim()) linhas.shift();
  while (linhas.length && !linhas[linhas.length - 1].trim()) linhas.pop();
  const ind = Math.min(
    ...linhas.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length)
  );
  return linhas.map((l) => l.slice(Number.isFinite(ind) ? ind : 0)).join("\n");
}

export function prop(nome, valor, ind) {
  const p = " ".repeat(ind);
  let f = dedent(typeof valor === "string" ? valor : String(valor));
  if (SINTAXE_PTBR) f = converterPtBr(f);
  const simples = !f.includes("\n") && /^[A-Za-z0-9_.(), +\-*/<>=!&|]*$/.test(f);
  if (simples) return `${p}${nome}: =${f}\n`;
  const linhas = ("=" + f).split("\n");
  return `${p}${nome}: |-\n` + linhas.map((l) => (l.length ? `${p}  ${l}` : "")).join("\n") + "\n";
}

export function ser(ctrl, ind) {
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

export function tela(nome, props, filhos) {
  let out = "Screens:\n" + `  ${nome}:\n` + "    Properties:\n";
  for (const [k, v] of Object.entries(props)) out += prop(k, v, 6);
  out += "    Children:\n";
  for (const f of filhos) out += ser(f, 6);
  return out;
}

// ---------------------------------------------------------------------------
// Construtores de controles
// ---------------------------------------------------------------------------
export const c = (nome, tipo, props = {}, filhos = null, variante = null) => ({ nome, tipo, props, filhos, variante });
export const pos = (x, y, w, h) => ({ X: x, Y: y, Width: w, Height: h });
export const FONTE = "Font.'Segoe UI'";

export function lbl(nome, texto, x, y, w, h, extra = {}) {
  return c(nome, T.label, {
    Text: texto,
    ...pos(x, y, w, h),
    Font: FONTE,
    Size: 11,
    Color: "corTexto",
    ...extra,
  });
}

export function titulo(nome, texto, x, y, w, h = 28, extra = {}) {
  return lbl(nome, texto, x, y, w, h, { Size: 13, FontWeight: "FontWeight.Semibold", ...extra });
}

export function botao(nome, texto, onSelect, x, y, w, h, extra = {}) {
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

export function botaoSec(nome, texto, onSelect, x, y, w, h, extra = {}) {
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

export function retangulo(nome, x, y, w, h, extra = {}) {
  return c(nome, T.rect, { ...pos(x, y, w, h), Fill: "corCard", BorderColor: "corBorda", BorderThickness: 1, ...extra });
}

export function dropdown(nome, items, x, y, w, extra = {}) {
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

export function entrada(nome, x, y, w, h, extra = {}) {
  return c(nome, T.input, {
    Default: '""',
    ...pos(x, y, w, h),
    Font: FONTE,
    Size: 11,
    BorderColor: "corBorda",
    ...extra,
  });
}

export function galeria(nome, items, x, y, w, h, tamanho, filhos, extra = {}) {
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

export function imagem(nome, formula, x, y, w, h, extra = {}) {
  return c(nome, T.image, { Image: formula, ...pos(x, y, w, h), ImagePosition: "ImagePosition.Fit", ...extra });
}

export function html(nome, formula, x, y, w, h, extra = {}) {
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
export function linha(nome, altura, filhos, extra = {}) {
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

export function rolagem(nome, filhos) {
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
export const RELOGIO = `
Set(varRelogio, Now());
Set(varOffset, Mod(Hour(varRelogio) - gHoraInicioDia + 24, 24));
Set(varDataRef, If(Hour(varRelogio) < gHoraInicioDia, DateAdd(Today(), -1, TimeUnit.Days), Today()));
Set(varChaveData, Text(varDataRef, "yyyy-mm-dd"));
Set(varJanela, LookUp(tblJanelas, varOffset >= IniOffset && varOffset < FimOffset, Codigo));
Set(varJanelaChave, varChaveData & "|" & varJanela)`;

export const CARREGA_VAGAS_ABERTAS = `ClearCollect(colVagasAbertas, Filter(SolicitacoesVaga, Status = "SOLICITADA" || Status = "EM_ANALISE" || Status = "LEITO_CEDIDO"))`;

export const CALCULA_ROTINA = `
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

export const SVG_ROTINA = `
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

export const TEXTO_FALTAM = `
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

export const CRONO = (inicio) => `
With(
    {s: Max(0, DateDiff(${inicio}, varRelogio, TimeUnit.Seconds))},
    Text(RoundDown(s / 3600, 0), "00") & ":" & Text(RoundDown(Mod(s, 3600) / 60, 0), "00") & ":" & Text(Mod(s, 60), "00")
)`;

export const COR_SLA = `
With(
    {p: DateDiff(ThisItem.SolicitadoEm, varRelogio, TimeUnit.Seconds) / (60 * Coalesce(ThisItem.SLAMinutos, gSlaPadraoMin))},
    If(p >= 1, corVermelho, p >= gSlaAlerta, corAmarelo, corVerde)
)`;

export const SIGLA = (campo) => `Coalesce(LookUp(colSetores, Codigo = ${campo}, Sigla), ${campo})`;

export const EVENTO = (evento, solId, atend, de, para, obs) => `
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
export function lateral(sfx, codigoAtual) {
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
                  "VAGAS", Navigate(scrVagas, ScreenTransition.None),
                  "METAS", Navigate(scrMetas, ScreenTransition.None),
                  "PREVISOES", Navigate(scrPrevisoes, ScreenTransition.None),
                  "PERMANENCIA", Navigate(scrPermanencia, ScreenTransition.None),
                  "AMBULANCIAS", Navigate(scrAmbulancias, ScreenTransition.None),
                  "CATETERISMOS", Navigate(scrCateterismos, ScreenTransition.None),
                  "PASSAGEM", Navigate(scrPassagem, ScreenTransition.None),
                  "RECEPCAO", Navigate(scrRecepcao, ScreenTransition.None)
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

export function timers(sfx) {
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

export function cabecalho(sfx, textoTitulo, extras = [], atualiza = null) {
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
    botao(`btnAtualizar${sfx}`, '"Atualizar"', atualiza || ATUALIZA[sfx], "Parent.Width - 120", 8, 120, 36),
  ]);
}

// ---------------------------------------------------------------------------
// Rotinas de recarga de cada tela (botão "Atualizar", ao abrir e a cada 60 s)
// ---------------------------------------------------------------------------
export const ATUALIZA = {
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

export function minutosTexto(expr) {
  return `If(IsBlank(${expr}), "–", ${expr} >= 60, RoundDown(${expr} / 60, 0) & "h " & Text(Mod(${expr}, 60), "00") & "min", Text(${expr}, "0") & " min")`;
}

export const CARD = (titulo, valor, cor, sub) =>
  `"<div style='flex:1 1 150px;min-width:150px;background:#FFFFFF;border:1px solid #D8DEE6;border-radius:12px;padding:10px 14px;box-sizing:border-box'>" &
        "<div style='font-size:12px;color:#5A6573'>${titulo}</div>" &
        "<div style='font-size:26px;font-weight:600;line-height:1.25;color:" & ${cor} & "'>" & ${valor} & "</div>" &
        "<div style='font-size:11px;color:#5A6573'>" & ${sub} & "</div>" &
    "</div>"`;


// ---------------------------------------------------------------------------
// Construtores usados pelas guias das fases seguintes
// ---------------------------------------------------------------------------
export const TEXTO_RELOGIO = `Text(varRelogio, "dddd, dd/mm/yyyy · hh:mm:ss") & "   ·   atualizado às " & Text(varUltimaAtualizacao, "hh:mm")`;

export function datepicker(nome, padrao, x, y, w, extra = {}) {
  return c(nome, T.datepicker, {
    DefaultDate: padrao,
    ...pos(x, y, w, 36),
    Font: FONTE,
    Size: 10,
    Format: "DateTimeFormat.ShortDate",
    ...extra,
  });
}

// botão que funciona como "liga/desliga" (aba, filtro, flag)
export function alternador(nome, texto, ligado, onSelect, x, y, w, h, extra = {}) {
  return botao(nome, texto, onSelect, x, y, w, h, {
    Size: 10,
    Fill: `If(${ligado}, corPrimaria, Color.White)`,
    Color: `If(${ligado}, Color.White, corPrimaria)`,
    HoverFill: `If(${ligado}, corPrimariaEscura, corPrimariaClara)`,
    HoverColor: `If(${ligado}, Color.White, corPrimaria)`,
    BorderColor: "corPrimaria",
    BorderThickness: 1,
    ...extra,
  });
}

// rótulo de campo + controle logo abaixo
export function rotulo(nome, texto, x, y, w) {
  return lbl(nome, texto, x, y, w, 18, { Size: 9, Color: "corTextoSuave" });
}

// filtro de setor com a opção "Todos" (mesmo padrão da Gestão de Vagas)
export const ITENS_SETORES_TODOS = `
Ungroup(
    Table(
        {Grupo: Table({Value: "Todos os setores", Codigo: "TODOS"})},
        {Grupo: ForAll(Filter(colSetores, Ativo) As s, {Value: s.Title, Codigo: s.Codigo})}
    ),
    Grupo
)`;
export const comTodos = (tabela, rotuloTodos = "Todos") =>
  `Ungroup(Table({Grupo: Table({Value: "${rotuloTodos}", Codigo: "TODOS"})}, {Grupo: ShowColumns(${tabela}, Value, Codigo)}), Grupo)`;

// hora digitada "hh:mm" somada a uma data
export const DATA_HORA = (dp, txt) => `
With(
    {
        h: IfError(Value(First(Split(${txt}.Text, ":")).Value), 0),
        m: IfError(Value(Last(Split(${txt}.Text, ":")).Value), 0)
    },
    DateAdd(DateAdd(${dp}.SelectedDate, If(h >= 0 && h < 24, h, 0), TimeUnit.Hours), If(m >= 0 && m < 60, m, 0), TimeUnit.Minutes)
)`;

// tela com contêiner de posições fixas (como a Gestão de Vagas)
export function telaManual(nome, sfx, codigoMenu, tituloTexto, atualiza, filhos, onVisible = "") {
  const conteudo = c(
    `con${sfx}`,
    T.container,
    { X: "If(varModoTV, 0, 200)", Y: 0, Width: "Parent.Width - Self.X", Height: "Parent.Height", Fill: "corFundo" },
    [
      lbl(`lblTitulo${sfx}`, tituloTexto, 20, 10, 560, 30, { Size: 18, FontWeight: "FontWeight.Semibold" }),
      lbl(`lblRelogio${sfx}`, TEXTO_RELOGIO, 20, 40, 620, 20, { Size: 10, Color: "corTextoSuave" }),
      botao(`btnAtualizar${sfx}`, '"Atualizar"', atualiza, "Parent.Width - 140", 16, 120, 36),
      ...filhos,
    ],
    "ManualLayout"
  );
  return tela(
    nome,
    { Fill: "corFundo", OnVisible: (onVisible ? onVisible.trim() + ";\n" : "") + `Select(btnAtualizar${sfx})` },
    [...lateral(sfx, codigoMenu), conteudo, ...timers(sfx)]
  );
}

// tela com rolagem vertical (linhas empilhadas, como a Principal)
export function telaRolagem(nome, sfx, codigoMenu, tituloTexto, atualiza, linhas, onVisible = "", extrasCab = []) {
  const conteudo = rolagem(`conRol${sfx}`, [cabecalho(sfx, tituloTexto, extrasCab, atualiza), ...linhas]);
  return tela(
    nome,
    { Fill: "corFundo", OnVisible: (onVisible ? onVisible.trim() + ";\n" : "") + `Select(btnAtualizar${sfx})` },
    [...lateral(sfx, codigoMenu), conteudo, ...timers(sfx)]
  );
}

// janela sobreposta (formulário, histórico)
export function janela(nome, visivel, largura, altura, filhos, extra = {}) {
  return c(
    nome,
    T.container,
    {
      ...pos(`(Parent.Width - ${largura}) / 2`, 70, largura, altura),
      Visible: visivel,
      Fill: "corCard",
      BorderColor: "corPrimaria",
      BorderThickness: 2,
      DropShadow: "DropShadow.Bold",
      ...extra,
    },
    filhos,
    "ManualLayout"
  );
}
