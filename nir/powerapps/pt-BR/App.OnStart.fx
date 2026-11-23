// >>> VERSÃO pt-BR (ponto e vírgula entre argumentos, ;; entre comandos).
// >>> Gerada automaticamente a partir de ../App.OnStart.fx — não edite aqui.
// =====================================================================
// NIR · Command Center — App.OnStart
// ---------------------------------------------------------------------
// Onde colar: selecione "App" na árvore de telas, escolha a propriedade
// "OnStart" e cole tudo. (Power Apps em português: use ../pt-BR/App.OnStart.fx)
// =====================================================================
Set(varRelogio; Now());;
Set(varUltimaAtualizacao; Now());;
Set(varModoTV; false);;
Set(varTick; 0);;
Set(varAbaVagas; "ABERTAS");;
Set(varPreviaOk; false);;
Set(varPreviaFeita; false);;
Set(varProcessando; false);;
Set(varSetorSugerido; "");;
Set(varFiltroSetor; If(gPerfil = "SOLICITANTE" && !IsBlank(gSetorDoUsuario); gSetorDoUsuario; "TODOS"));;

// cadastro de setores (pequeno: fica em memória)
ClearCollect(colSetores; Sort(Setores; Ordem));;
ClearCollect(colSetoresRotina; Filter(colSetores; Ativo && ExigeNaRotina));;

// dia do NIR e rotina atual
Set(varOffset; Mod(Hour(varRelogio) - gHoraInicioDia + 24; 24));;
Set(varDataRef; If(Hour(varRelogio) < gHoraInicioDia; DateAdd(Today(); -1; TimeUnit.Days); Today()));;
Set(varChaveData; Text(varDataRef; "yyyy-mm-dd"));;
Set(varJanela; LookUp(tblJanelas; varOffset >= IniOffset && varOffset < FimOffset; Codigo));;
Set(varJanelaChave; varChaveData & "|" & varJanela)

// As demais coleções (colInternados, colVagasAbertas, colImportDia...) são
// carregadas por cada tela ao abrir, pelo botão "Atualizar" e a cada 60 s.
