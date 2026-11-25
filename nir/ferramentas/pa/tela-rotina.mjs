import {
  FONTE,
  SIGLA,
  SVG_ROTINA,
  T,
  TEXTO_FALTAM,
  botao,
  botaoSec,
  c,
  cabecalho,
  dropdown,
  entrada,
  galeria,
  imagem,
  lateral,
  lbl,
  linha,
  pos,
  retangulo,
  rolagem,
  ser,
  tela,
  timers,
  titulo,
} from "./base.mjs";

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

export function telaRotina() {
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

