// =====================================================================
// NIR · Command Center — App.Formulas (fórmulas nomeadas globais)
// ---------------------------------------------------------------------
// Onde colar: no Power Apps Studio, selecione "App" na árvore de telas,
// escolha a propriedade "Formulas" no menu de propriedades e cole tudo.
//
// SINTAXE: este arquivo usa vírgula entre argumentos e ponto e vírgula
// no fim de cada fórmula (Power Apps em inglês). Se no seu Power Apps as
// fórmulas aparecem com ponto e vírgula entre argumentos — por exemplo
// If(a; b; c) — use o arquivo ../pt-BR/App.Formulas.fx.
// =====================================================================

// ---------------- Parâmetros da operação (ajuste aqui) ----------------
gNomeHospital = "Hospital Rubens Furlan Júnior";
gUrlSite = "https://SEUTENANT.sharepoint.com/sites/NIR";   // endereço do site do NIR
gHoraInicioDia = 7;          // o "dia do NIR" vai das 07:00 às 06:59
gToleranciaRotinaMin = 60;   // depois do horário previsto + tolerância, a rotina fica "atrasada"
gSlaAlerta = 0.7;            // a partir de 70% do SLA o cronômetro fica amarelo
gSlaPadraoMin = 120;         // usado quando o setor de destino não tem SLA cadastrado
gDiasPermanencia = 15;       // corte da Gestão da Permanência
gPerfilPadrao = "SOLICITANTE"; // perfil de quem não está na lista PerfisUsuarios
gJanelaReferencia = "MANHA"; // janela usada nas tendências diárias de ocupação
gHorizontePassagemH = 24;    // Passagem de Plantão: mostra o que acontece nas próximas N horas  [pendência K5]
gDiasRecepcao = 7;           // Previsão de Recepção: quantos dias à frente aparecem  [pendência I6]

// ---------------- Identidade visual ----------------
corPrimaria = ColorValue("#0B4F8A");
corPrimariaEscura = ColorValue("#083A66");
corPrimariaClara = ColorValue("#E7F0FA");
corFundo = ColorValue("#F2F4F7");
corCard = ColorValue("#FFFFFF");
corBorda = ColorValue("#D8DEE6");
corTexto = ColorValue("#1A2330");
corTextoSuave = ColorValue("#5A6573");
corVerde = ColorValue("#1E8E3E");
corAmarelo = ColorValue("#B7791F");
corVermelho = ColorValue("#C62828");
corCinza = ColorValue("#8A94A1");
// as mesmas cores em texto, para os gráficos SVG e os cartões HTML
hexPrimaria = "#0B4F8A";
hexVerde = "#1E8E3E";
hexAmarelo = "#B7791F";
hexVermelho = "#C62828";
hexCinza = "#8A94A1";
hexTexto = "#1A2330";
hexTextoSuave = "#5A6573";
hexBorda = "#D8DEE6";
hexTrilho = "#E9EDF2";

// ---------------- Usuário e perfil ----------------
gUsuarioEmail = Lower(User().Email);
gUsuarioNome = User().FullName;
gPerfilRegistro = LookUp(PerfisUsuarios, Email = gUsuarioEmail);
gPerfil = If(
    !IsBlank(gPerfilRegistro) && gPerfilRegistro.Ativo,
    gPerfilRegistro.Perfil,
    gPerfilPadrao
);
gSetorDoUsuario = If(IsBlank(gPerfilRegistro), "", gPerfilRegistro.SetorCodigo);
gEhNIR = gPerfil = "NIR";
gPodeSolicitar = gPerfil = "NIR" || gPerfil = "SOLICITANTE";
gPodePermanencia = gPerfil = "NIR" || gPerfil = "PERMANENCIA";
gEspecialidadeUsuario = If(IsBlank(gPerfilRegistro), "", gPerfilRegistro.Especialidade);

// ---------------- Menu (o que cada perfil vê) ----------------
// Disponivel = false → aparece como "em breve" (útil para guias futuras do Command Center)
tblMenu = Table(
    {Codigo: "PRINCIPAL", Rotulo: "Principal", Disponivel: true, Perfis: "NIR;VISUALIZACAO"},
    {Codigo: "ROTINA", Rotulo: "Rotina de Atualização", Disponivel: true, Perfis: "NIR"},
    {Codigo: "VAGAS", Rotulo: "Gestão de Vagas", Disponivel: true, Perfis: "NIR;VISUALIZACAO;SOLICITANTE"},
    {Codigo: "METAS", Rotulo: "Metas", Disponivel: true, Perfis: "NIR;VISUALIZACAO"},
    {Codigo: "PREVISOES", Rotulo: "Previsões de Alta", Disponivel: true, Perfis: "NIR;VISUALIZACAO;PERMANENCIA"},
    {Codigo: "PERMANENCIA", Rotulo: "Gestão da Permanência", Disponivel: true, Perfis: "NIR;PERMANENCIA;VISUALIZACAO"},
    {Codigo: "AMBULANCIAS", Rotulo: "Ambulâncias", Disponivel: true, Perfis: "NIR;VISUALIZACAO"},
    {Codigo: "CATETERISMOS", Rotulo: "Cateterismos", Disponivel: true, Perfis: "NIR;VISUALIZACAO"},
    {Codigo: "PASSAGEM", Rotulo: "Passagem de Plantão", Disponivel: true, Perfis: "NIR"},
    {Codigo: "RECEPCAO", Rotulo: "Previsão de Recepção", Disponivel: true, Perfis: "NIR;VISUALIZACAO"}
);
tblMenuUsuario = Filter(tblMenu, (";" & gPerfil & ";") in (";" & Perfis & ";"));

// ---------------- Rotinas de atualização (4 janelas) ----------------
// IniOffset/FimOffset = horas contadas a partir do início do dia do NIR (07:00).
// Manhã 07–13h · Tarde 13–20h · Noite 20–03h · Madrugada 03–07h
tblJanelas = Table(
    {Codigo: "MANHA", Rotulo: "Manhã", HoraPrevista: 9, IniOffset: 0, FimOffset: 6, Ordem: 1},
    {Codigo: "TARDE", Rotulo: "Tarde", HoraPrevista: 17, IniOffset: 6, FimOffset: 13, Ordem: 2},
    {Codigo: "NOITE", Rotulo: "Noite", HoraPrevista: 23, IniOffset: 13, FimOffset: 20, Ordem: 3},
    {Codigo: "MADRUGADA", Rotulo: "Madrugada", HoraPrevista: 5, IniOffset: 20, FimOffset: 24, Ordem: 4}
);

// ---------------- Tipos de arquivo da Rotina de Atualização ----------------
// Processa = true → o conteúdo colado é lido e gravado; false → o arquivo é só arquivado (anexo)
tblTiposGuia = Table(
    {Codigo: "CENSO", Value: "Censo do setor (Ctrl+E do Tasy)", Processa: true, ExigeSetor: true},
    {Codigo: "PREVISAO_ALTA", Value: "Previsões de Alta (arquivar)", Processa: false, ExigeSetor: false},
    {Codigo: "PERMANENCIA", Value: "Gestão da Permanência (arquivar)", Processa: false, ExigeSetor: false},
    {Codigo: "AMBULANCIAS", Value: "Ambulâncias (arquivar)", Processa: false, ExigeSetor: false},
    {Codigo: "CATETERISMOS", Value: "Cateterismos: agenda (arquivar)", Processa: false, ExigeSetor: false},
    {Codigo: "RECEPCAO", Value: "Previsão de Recepção: CROSS (arquivar)", Processa: false, ExigeSetor: false},
    {Codigo: "OUTRO", Value: "Outro documento (arquivar)", Processa: false, ExigeSetor: false}
);

// ---------------- Gestão de Vagas ----------------
tblCondicoes = Table(
    {Codigo: "APTO", Value: "Apto ao transporte", Hex: "#1E8E3E"},
    {Codigo: "EM_DEFINICAO", Value: "Em definição", Hex: "#B7791F"},
    {Codigo: "INAPTO", Value: "Inapto ao transporte", Hex: "#C62828"}
);
tblStatusVaga = Table(
    {Codigo: "SOLICITADA", Value: "Solicitada"},
    {Codigo: "EM_ANALISE", Value: "Em análise"},
    {Codigo: "LEITO_CEDIDO", Value: "Leito cedido"},
    {Codigo: "CONCLUIDA", Value: "Transferência concluída"},
    {Codigo: "CANCELADA", Value: "Cancelada"}
);
tblMotivosCancelamento = Table(
    {Value: "Alta do paciente"},
    {Value: "Óbito"},
    {Value: "Mudança de conduta"},
    {Value: "Transferência externa"},
    {Value: "Solicitação duplicada"},
    {Value: "Outro"}
);
tblStatusInternacao = Table(
    {Codigo: "INTERNADO", Value: "Internado"},
    {Codigo: "SAIDA_VERIFICAR", Value: "Saída a verificar"},
    {Codigo: "ALTA_PRESUMIDA", Value: "Alta presumida"},
    {Codigo: "ALTA_CONFIRMADA", Value: "Alta confirmada"},
    {Codigo: "OBITO", Value: "Óbito"},
    {Codigo: "TRANSFERIDO_EXTERNO", Value: "Transferência externa"}
);

// ---------------- Cabeçalhos do Ctrl+E do Tasy ----------------
// Sinônimos aceitos para cada campo, em minúsculas e sem espaços nas pontas.
// Se o Tasy usar outro nome de coluna, basta acrescentar uma linha aqui.
tblMapaColunas = Table(
    {Campo: "NrAtendimento", Sinonimo: "atendimento"},
    {Campo: "NrAtendimento", Sinonimo: "nr atendimento"},
    {Campo: "NrAtendimento", Sinonimo: "nr. atendimento"},
    {Campo: "NrAtendimento", Sinonimo: "nº atendimento"},
    {Campo: "NrAtendimento", Sinonimo: "n° atendimento"},
    {Campo: "NrAtendimento", Sinonimo: "número do atendimento"},
    {Campo: "NrAtendimento", Sinonimo: "numero do atendimento"},
    {Campo: "NrAtendimento", Sinonimo: "atend."},
    {Campo: "NrAtendimento", Sinonimo: "nr_atendimento"},
    {Campo: "Paciente", Sinonimo: "paciente"},
    {Campo: "Paciente", Sinonimo: "nome do paciente"},
    {Campo: "Paciente", Sinonimo: "nome paciente"},
    {Campo: "Paciente", Sinonimo: "nome"},
    {Campo: "Prontuario", Sinonimo: "prontuário"},
    {Campo: "Prontuario", Sinonimo: "prontuario"},
    {Campo: "Prontuario", Sinonimo: "pront."},
    {Campo: "Prontuario", Sinonimo: "nr. prontuário"},
    {Campo: "Prontuario", Sinonimo: "cód. pessoa"},
    {Campo: "Leito", Sinonimo: "leito"},
    {Campo: "Leito", Sinonimo: "unidade"},
    {Campo: "Leito", Sinonimo: "unidade/leito"},
    {Campo: "Leito", Sinonimo: "quarto/leito"},
    {Campo: "DataInternacao", Sinonimo: "data internação"},
    {Campo: "DataInternacao", Sinonimo: "data internacao"},
    {Campo: "DataInternacao", Sinonimo: "data de internação"},
    {Campo: "DataInternacao", Sinonimo: "dt. internação"},
    {Campo: "DataInternacao", Sinonimo: "dt internação"},
    {Campo: "DataInternacao", Sinonimo: "data entrada"},
    {Campo: "DataInternacao", Sinonimo: "dt. entrada"},
    {Campo: "DataInternacao", Sinonimo: "dt entrada"},
    {Campo: "DataInternacao", Sinonimo: "entrada"},
    {Campo: "DataInternacao", Sinonimo: "data de entrada"},
    {Campo: "Medico", Sinonimo: "médico"},
    {Campo: "Medico", Sinonimo: "medico"},
    {Campo: "Medico", Sinonimo: "médico responsável"},
    {Campo: "Medico", Sinonimo: "medico responsavel"},
    {Campo: "Medico", Sinonimo: "médico assistente"},
    {Campo: "Especialidade", Sinonimo: "especialidade"},
    {Campo: "Especialidade", Sinonimo: "clínica"},
    {Campo: "Especialidade", Sinonimo: "clinica"},
    {Campo: "Convenio", Sinonimo: "convênio"},
    {Campo: "Convenio", Sinonimo: "convenio"},
    {Campo: "Diagnostico", Sinonimo: "diagnóstico"},
    {Campo: "Diagnostico", Sinonimo: "diagnostico"},
    {Campo: "Diagnostico", Sinonimo: "cid"},
    {Campo: "Diagnostico", Sinonimo: "hipótese diagnóstica"},
    {Campo: "Idade", Sinonimo: "idade"},
    {Campo: "Sexo", Sinonimo: "sexo"},
    {Campo: "SetorTasy", Sinonimo: "setor"},
    {Campo: "SetorTasy", Sinonimo: "setor atendimento"},
    {Campo: "SetorTasy", Sinonimo: "setor de atendimento"},
    {Campo: "PrevisaoAlta", Sinonimo: "previsão de alta"},
    {Campo: "PrevisaoAlta", Sinonimo: "previsao de alta"},
    {Campo: "PrevisaoAlta", Sinonimo: "previsão alta"},
    {Campo: "PrevisaoAlta", Sinonimo: "dt. prev. alta"},
    {Campo: "PrevisaoAlta", Sinonimo: "data prevista alta"}
);
tblCamposImportacao = Table(
    {Campo: "NrAtendimento", Value: "Atendimento", Obrigatorio: true},
    {Campo: "Paciente", Value: "Paciente", Obrigatorio: true},
    {Campo: "Leito", Value: "Leito", Obrigatorio: true},
    {Campo: "DataInternacao", Value: "Data de internação", Obrigatorio: true},
    {Campo: "Prontuario", Value: "Prontuário", Obrigatorio: false},
    {Campo: "Medico", Value: "Médico", Obrigatorio: false},
    {Campo: "Especialidade", Value: "Especialidade", Obrigatorio: false},
    {Campo: "Convenio", Value: "Convênio", Obrigatorio: false},
    {Campo: "Diagnostico", Value: "Diagnóstico", Obrigatorio: false},
    {Campo: "Idade", Value: "Idade", Obrigatorio: false},
    {Campo: "Sexo", Value: "Sexo", Obrigatorio: false},
    {Campo: "SetorTasy", Value: "Setor", Obrigatorio: false},
    {Campo: "PrevisaoAlta", Value: "Previsão de alta", Obrigatorio: false}
);
tblClassesPrevia = Table(
    {Codigo: "NOVO", Value: "Novo no censo", Hex: "#0B4F8A"},
    {Codigo: "TRANSFERENCIA", Value: "Transferido para cá", Hex: "#6B3FA0"},
    {Codigo: "TROCA_LEITO", Value: "Trocou de leito", Hex: "#B7791F"},
    {Codigo: "RETORNO", Value: "Retorno (estava como saída)", Hex: "#1E8E3E"},
    {Codigo: "SEM_MUDANCA", Value: "Sem mudança", Hex: "#8A94A1"}
);

// =====================================================================
// Guias das fases seguintes
// Os valores marcados com [pendência ...] foram assumidos e podem mudar
// sem mexer nas telas: basta editar a tabela correspondente aqui.
// =====================================================================

// ---------------- Gestão da Permanência ----------------
tblEspecialidades = Table(
    {Codigo: "MEDICO", Value: "Médico", Ordem: 1},
    {Codigo: "ENFERMAGEM", Value: "Enfermagem", Ordem: 2},
    {Codigo: "SERVICO_SOCIAL", Value: "Serviço Social", Ordem: 3},
    {Codigo: "FISIOTERAPIA", Value: "Fisioterapia", Ordem: 4}
);
tblStatusTopico = Table(
    {Codigo: "PLANEJADO", Value: "Planejado", Ordem: 1, Hex: "#5A6573"},
    {Codigo: "EM_ANDAMENTO", Value: "Em andamento", Ordem: 2, Hex: "#B7791F"},
    {Codigo: "CONCLUIDO", Value: "Concluído", Ordem: 3, Hex: "#1E8E3E"}
);
tblDestinosAlta = Table(  // [pendência E1]
    {Value: "Domicílio"}, {Value: "Domicílio com apoio/cuidador"}, {Value: "Home care"},
    {Value: "ILPI"}, {Value: "Hospital de retaguarda"}, {Value: "Outro hospital"}, {Value: "A definir"}
);

// ---------------- Ambulâncias ----------------
tblTiposTransporte = Table(  // [pendência F2]
    {Codigo: "USA", Value: "Ambulância USA (avançada)"},
    {Codigo: "USB", Value: "Ambulância USB (básica)"},
    {Codigo: "REMOCAO", Value: "Remoção simples"},
    {Codigo: "OUTRO", Value: "Outro"}
);
tblMotivosTransporte = Table(
    {Codigo: "EXAME_EXTERNO", Value: "Exame externo", Retorna: true},
    {Codigo: "PROCEDIMENTO", Value: "Procedimento/cirurgia externa", Retorna: true},
    {Codigo: "CONSULTA", Value: "Consulta/avaliação externa", Retorna: true},
    {Codigo: "TRANSFERENCIA", Value: "Transferência definitiva", Retorna: false},
    {Codigo: "ALTA", Value: "Alta com transporte", Retorna: false},
    {Codigo: "OUTRO", Value: "Outro", Retorna: false}
);
tblStatusTransporte = Table(  // ordem = sequência do transporte  [pendência F3]
    {Codigo: "AGENDADO", Value: "Agendado", Ordem: 1, Ativo: true},
    {Codigo: "SOLICITADA", Value: "Ambulância solicitada", Ordem: 2, Ativo: true},
    {Codigo: "CONFIRMADA", Value: "Ambulância confirmada", Ordem: 3, Ativo: true},
    {Codigo: "NO_LOCAL", Value: "Ambulância no hospital", Ordem: 4, Ativo: true},
    {Codigo: "SAIU", Value: "Paciente saiu", Ordem: 5, Ativo: true},
    {Codigo: "RETORNOU", Value: "Retornou ao hospital", Ordem: 6, Ativo: false},
    {Codigo: "CONCLUIDO", Value: "Concluído (não retorna)", Ordem: 7, Ativo: false},
    {Codigo: "CANCELADO", Value: "Cancelado", Ordem: 8, Ativo: false}
);
tblChecklist = Table(  // [pendência F4]
    {Campo: "ChkAutorizacao", Value: "Autorização/guia"},
    {Campo: "ChkRelatorio", Value: "Relatório médico"},
    {Campo: "ChkExames", Value: "Exames e imagens"},
    {Campo: "ChkContatoDestino", Value: "Contato com o destino"},
    {Campo: "ChkAgendaConfirmada", Value: "Agenda/vaga confirmada"},
    {Campo: "ChkAcompanhante", Value: "Acompanhante"},
    {Campo: "ChkEquipamentos", Value: "Equipamentos/O2"},
    {Campo: "ChkDocumentos", Value: "Documentos do paciente"},
    {Campo: "ChkFamilia", Value: "Família avisada"}
);

// ---------------- Cateterismos ----------------
tblTiposCate = Table(
    {Codigo: "EXTERNO_ELETIVO", Value: "Externo Eletivo", Hex: "#0B4F8A", Internado: false},
    {Codigo: "EXTERNO_URGENCIA_RELATIVA", Value: "Externo Urgência Relativa", Hex: "#B7791F", Internado: false},
    {Codigo: "INTERNADO_ELETIVO", Value: "Internado Eletivo", Hex: "#0F7C80", Internado: true},
    {Codigo: "INTERNADO_URGENCIA", Value: "Internado Urgência", Hex: "#A23E48", Internado: true}
);
tblStatusCate = Table(  // [pendência J4]
    {Codigo: "AGENDADO", Value: "Agendado"},
    {Codigo: "REALIZADO", Value: "Realizado"},
    {Codigo: "REMARCADO", Value: "Remarcado"},
    {Codigo: "SUSPENSO", Value: "Suspenso"},
    {Codigo: "CANCELADO", Value: "Cancelado"}
);
tblDestinosPosCate = Table(  // [pendência J8]
    {Value: "Alta"}, {Value: "Retorna ao setor de origem"}, {Value: "UCO/UTI"},
    {Value: "Enfermaria"}, {Value: "Cirurgia cardíaca"}, {Value: "Transferência"}
);
// cabeçalhos aceitos na planilha da agenda de cateterismos  [pendência J1]
tblMapaCate = Table(
    {Campo: "Data", Sinonimo: "data"}, {Campo: "Data", Sinonimo: "data do exame"}, {Campo: "Data", Sinonimo: "data exame"}, {Campo: "Data", Sinonimo: "dt. exame"},
    {Campo: "Hora", Sinonimo: "hora"}, {Campo: "Hora", Sinonimo: "horário"}, {Campo: "Hora", Sinonimo: "horario"},
    {Campo: "Paciente", Sinonimo: "paciente"}, {Campo: "Paciente", Sinonimo: "nome"}, {Campo: "Paciente", Sinonimo: "nome do paciente"},
    {Campo: "Tipo", Sinonimo: "tipo"}, {Campo: "Tipo", Sinonimo: "classificação"}, {Campo: "Tipo", Sinonimo: "classificacao"}, {Campo: "Tipo", Sinonimo: "tipo de paciente"},
    {Campo: "Atendimento", Sinonimo: "atendimento"}, {Campo: "Atendimento", Sinonimo: "nr atendimento"}, {Campo: "Atendimento", Sinonimo: "nº atendimento"},
    {Campo: "Prontuario", Sinonimo: "prontuário"}, {Campo: "Prontuario", Sinonimo: "prontuario"},
    {Campo: "Idade", Sinonimo: "idade"},
    {Campo: "Procedimento", Sinonimo: "procedimento"}, {Campo: "Procedimento", Sinonimo: "exame"},
    {Campo: "Medico", Sinonimo: "médico"}, {Campo: "Medico", Sinonimo: "medico"}, {Campo: "Medico", Sinonimo: "médico solicitante"}, {Campo: "Medico", Sinonimo: "solicitante"},
    {Campo: "Convenio", Sinonimo: "convênio"}, {Campo: "Convenio", Sinonimo: "convenio"},
    {Campo: "Procedencia", Sinonimo: "procedência"}, {Campo: "Procedencia", Sinonimo: "procedencia"}, {Campo: "Procedencia", Sinonimo: "origem"}, {Campo: "Procedencia", Sinonimo: "serviço de origem"},
    {Campo: "Observacao", Sinonimo: "observação"}, {Campo: "Observacao", Sinonimo: "observacao"}, {Campo: "Observacao", Sinonimo: "obs"}, {Campo: "Observacao", Sinonimo: "obs."}
);

// ---------------- Previsão de Recepção ----------------
tblSecoesRecepcao = Table(  // [pendência I1]
    {Codigo: "AMBULATORIAL", Value: "Ambulatoriais"},
    {Codigo: "ELETIVA", Value: "Eletivas"}
);
tblStatusRecepcao = Table(
    {Codigo: "PREVISTO", Value: "Previsto", Ativo: true},
    {Codigo: "CHEGOU", Value: "Chegou", Ativo: true},
    {Codigo: "INTERNADO", Value: "Internado", Ativo: false},
    {Codigo: "RETORNOU_ORIGEM", Value: "Avaliado e retornou à origem", Ativo: false},
    {Codigo: "NAO_COMPARECEU", Value: "Não compareceu", Ativo: false},
    {Codigo: "CANCELADO", Value: "Cancelado", Ativo: false}
);

// ---------------- Passagem de Plantão ----------------
tblTurnos = Table(  // [pendência K1]
    {Codigo: "DIURNO", Value: "Diurno (07h–19h)", Inicio: 7},
    {Codigo: "NOTURNO", Value: "Noturno (19h–07h)", Inicio: 19}
);

// ---------------- Metas ----------------
// cabeçalhos aceitos no modelo de planilha de metas (Rotina de Atualização, seção b)
tblMapaMetas = Table(
    {Campo: "Indicador", Sinonimo: "indicador"}, {Campo: "Indicador", Sinonimo: "código"}, {Campo: "Indicador", Sinonimo: "codigo"},
    {Campo: "Competencia", Sinonimo: "competência"}, {Campo: "Competencia", Sinonimo: "competencia"}, {Campo: "Competencia", Sinonimo: "mês"}, {Campo: "Competencia", Sinonimo: "mes"}, {Campo: "Competencia", Sinonimo: "mês/ano"},
    {Campo: "Meta", Sinonimo: "meta"},
    {Campo: "Realizado", Sinonimo: "realizado"}, {Campo: "Realizado", Sinonimo: "resultado"}, {Campo: "Realizado", Sinonimo: "valor"}
);
