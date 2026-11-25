# 02 · Montagem do aplicativo no Power Apps

**Pré-requisitos:**
- [Fase 0](00-verificacao-ambiente.md) concluída.
- Listas criadas ([01](01-modelo-de-dados.md)).
- Na lista `Setores`, preencha pelo menos `LeitosOperacionais` e `NomeTasy`. O
  `SLAMinutos` pode ficar no valor provisório (120) até a pactuação.

**Tempo estimado:** 3 a 4 horas na primeira vez.

O app tem **10 telas prontas**: `scrPrincipal`, `scrRotina`, `scrVagas`,
`scrPrevisoes`, `scrPermanencia`, `scrAmbulancias`, `scrCateterismos`,
`scrRecepcao`, `scrPassagem` e `scrMetas`. Você vai colar o código e ligar os dados.
Nada precisa ser desenhado à mão, com exceção dos dois formulários de anexo
(passo 9).

---

## Passo 1 · Criar o app

1. **make.powerapps.com > + Criar > Criar do zero** (cartão *Canvas app*).
2. Nome: **NIR – Command Center**. Formato: **Tablet**. Clique em **Criar**.

## Passo 2 · Configurações do app

Na barra superior do Studio, clique em **⚙ Configurações**:

| Onde | O que ajustar |
|---|---|
| **Geral** | **Limite de linhas de dados** (*Data row limit*): **2000** |
| **Exibir** | Tamanho **16:9**; **Ajustar à tela** (*Scale to fit*): ligado; **Bloquear proporção**: ligado |
| **Atualizações** | Confirme que **Fórmulas nomeadas** (*Named formulas*) está ligado (já vem ligado nas versões atuais) |

## Passo 3 · Conectar as listas

1. No menu da esquerda do Studio, clique no ícone **Dados** (cilindro) e depois em
   **+ Adicionar dados**.
2. Procure **SharePoint** e escolha a conexão com a sua conta.
3. Cole o endereço do site do NIR e clique em **Conectar**.
4. Marque as **18 listas** e clique em **Conectar**:
   - `Setores`, `Importacoes`, `Internacoes`, `Movimentacoes`, `CensoResumo`;
   - `SolicitacoesVaga`, `EventosVaga`, `IndicadoresDiarios`, `PerfisUsuarios`;
   - `PrevisoesAlta`, `PermanenciaAcompanhamento`, `PermanenciaTopicos`;
   - `Transportes`, `Cateterismos`, `Recepcoes`, `PassagensPlantao`;
   - `MetasIndicadores`, `MetasValores`.

## Passo 4 · Descobrir a sintaxe do seu Power Apps (vírgula ou ponto e vírgula)

1. Clique em **Screen1** na árvore e olhe a fórmula da propriedade **Fill** na barra
   de fórmulas.
   - Se aparece `RGBA(255, 255, 255, 1)` (com **vírgulas**): use os arquivos
     da pasta `powerapps/`.
   - Se aparece `RGBA(255; 255; 255; 1)` (com **ponto e vírgula**): use os arquivos
     da pasta `powerapps/pt-BR/`.

Isso vale para os passos 5 e 6, que são colados na barra de fórmulas.

## Passo 5 · Fórmulas globais (App.Formulas)

1. Na árvore, clique em **App**.
2. No seletor de propriedade, à esquerda da barra de fórmulas, escolha **Formulas**.
3. Abra `powerapps/App.Formulas.fx` (ou `powerapps/pt-BR/App.Formulas.fx`), copie
   **tudo** e cole na barra de fórmulas.
4. Ajuste a linha `gUrlSite = "https://SEUTENANT.sharepoint.com/sites/NIR"` com o
   endereço real do seu site.

## Passo 6 · Inicialização (App.OnStart)

1. Ainda em **App**, escolha a propriedade **OnStart**.
2. Cole o conteúdo de `powerapps/App.OnStart.fx` (ou da versão pt-BR).
3. Clique nos **…** ao lado de **App** na árvore e escolha **Executar OnStart**.

## Passo 7 · Colar as telas

Faça uma tela por vez, **na ordem dos números** dos arquivos em `powerapps/telas/`:
1. `1-Principal.pa.yaml`
2. `2-RotinaAtualizacao.pa.yaml`
3. `3-GestaoVagas.pa.yaml`
4. `4-PrevisoesAlta.pa.yaml`
5. `5-GestaoPermanencia.pa.yaml`
6. `6-Ambulancias.pa.yaml`
7. `7-Cateterismos.pa.yaml`
8. `8-PrevisaoRecepcao.pa.yaml`
9. `9-PassagemPlantao.pa.yaml`
10. `10-Metas.pa.yaml`

Enquanto nem todas as telas estiverem coladas, o menu lateral mostra erro nas
telas que ainda faltam. Isso some quando as 10 estiverem no app.

Para cada uma:
1. Abra o arquivo, selecione tudo (Ctrl+A) e copie (Ctrl+C).
2. Na **árvore de telas** do Studio, clique com o botão direito em uma tela
   existente e escolha **Colar > Colar código** (*Paste > Paste code*).
   - Se o menu não tiver essa opção, clique uma vez na árvore e use **Ctrl+V**.
3. Confira se a tela nova aparece com o nome certo (`scrPrincipal`, `scrRotina`,
   `scrVagas` e assim por diante).

**Se a colagem der erro:**
- Mensagem sobre vírgula ou separador: use a versão da pasta `powerapps/telas/pt-BR/`.
- Mensagem sobre versão de controle (`Label@2.5.1`, por exemplo): anote a mensagem
  e me envie. Ajusto o gerador para a versão do seu Studio.
- Como último recurso, o arquivo YAML também serve de "receita". Cada bloco
  `- nome:` é um controle com tipo (`Control:`), posição (`X`, `Y`, `Width`,
  `Height`) e fórmulas (as linhas que começam com `=`). Dá para inserir o controle
  pelo menu **Inserir** e colar as fórmulas propriedade por propriedade.

## Passo 8 · Tela inicial

1. Clique em **App** e escolha a propriedade **StartScreen**.
2. Cole a fórmula correspondente à sua sintaxe:
   - Com vírgulas: `If(gPerfil = "NIR" || gPerfil = "VISUALIZACAO", scrPrincipal, gPerfil = "PERMANENCIA", scrPermanencia, scrVagas)`
   - Com ponto e vírgula: `If(gPerfil = "NIR" || gPerfil = "VISUALIZACAO"; scrPrincipal; gPerfil = "PERMANENCIA"; scrPermanencia; scrVagas)`
3. Apague a **Screen1**: botão direito > **Excluir**.

## Passo 9 · Formulários de anexo (Rotina de Atualização)

O controle de anexos do Power Apps só funciona dentro de um formulário. Por isso
estes dois são criados à mão:

**frmAnexo** (seção "a"):
1. Na árvore, abra `scrRotina > conRotina > conImportR` e **selecione `conImportR`**.
2. **Inserir > Formulário de edição** (*Edit form*). Ele entra dentro de `conImportR`.
3. Renomeie para **`frmAnexo`**. O nome precisa ser exatamente este.
4. Propriedades:
   - `DataSource`: `Importacoes`
   - `DefaultMode`: `FormMode.New`
   - `X`: `24` · `Y`: `140` · `Width`: `504` · `Height`: `140`
   - **Colunas**: `1`
5. No painel da direita, clique em **Editar campos**:
   - Remova todos os campos, menos **Anexos** (*Attachments*).
   - Se **Anexos** não estiver na lista, use **+ Adicionar campo > Anexos**.

**frmAnexoMetas** (seção "b"):
1. Repita o processo selecionando `conMetasR`.
2. Use o nome **`frmAnexoMetas`** e as posições `X 24` · `Y 86` · `Width 504` ·
   `Height 128`.

Depois disso, os erros vermelhos que citam `frmAnexo` e `frmAnexoMetas` desaparecem.

## Passo 10 · Verificar erros

1. Abra o **Verificador de aplicativo** (ícone de estetoscópio, no canto superior
   direito).
2. **Erros (vermelho) devem ser zero.** Se sobrar algum, me envie o print da
   mensagem.
3. **Avisos de delegação (sublinhado azul) são esperados** em alguns pontos, como
   `CountRows` e `FirstN`. O app foi desenhado para trabalhar com até 2.000 linhas
   nessas consultas, e as listas grandes são sempre filtradas antes.
4. **Aviso de desempenho** ("o app tem muitos controles") também é esperado. São
   cerca de 700 controles nas 10 telas. Se o app abrir devagar nos computadores do
   hospital, dá para separar em dois apps que usam as mesmas listas (ex.: "NIR" e
   "Permanência").

## Passo 11 · Salvar, publicar e compartilhar

1. **Salvar** e depois **Publicar** (canto superior direito).
2. Compartilhe: em make.powerapps.com > **Aplicativos**, clique em **…** no app,
   depois em **Compartilhar**, e adicione pessoas ou grupos.
   - Permissão no app: **Usuário**. Só a equipe que vai editar o app recebe
     **Coproprietário**.
3. **Atenção:** compartilhar o app **não** dá acesso às listas. As permissões das
   listas são dadas no SharePoint, pelos grupos do site
   ([05-perfis-lgpd.md](05-perfis-lgpd.md)).
4. Cadastre as pessoas na lista **PerfisUsuarios**, com e-mail em minúsculas e
   perfil `NIR`, `SOLICITANTE`, `PERMANENCIA` ou `VISUALIZACAO`.

## Passo 12 · Onde o app vai ficar

- **Página do SharePoint do NIR:** edite a página, clique em **+**, escolha a web
  part **Power Apps** e cole o link do app (em *Detalhes* do app > *Link da Web*).
- **Teams:** em make.powerapps.com, clique em **…** no app e depois em **Adicionar
  ao Teams**. Ou, no canal do NIR, use **+ (Adicionar guia) > Power Apps**.
- **TV da sala do NIR (Modo TV):** abra o link do app no navegador da TV com
  `&hidenavbar=true` no final do endereço. Pressione **F11** para tela cheia e clique
  em **Modo TV** na Principal.

---

## Roteiro de aceite (faça com dados de teste antes de usar com dados reais)

Use os arquivos de `exemplos/`. São censos fictícios em texto separado por
tabulação: abra no Excel e use Ctrl+A, Ctrl+C.

| # | Teste | Resultado esperado |
|---|---|---|
| 1 | Rotina: tipo "Censo", setor **PS Geral**, rotina **Manhã**, colar `exemplos/manha-PS_GERAL.tsv`, Pré-visualizar, Confirmar | Prévia com 6 pacientes "Novo no censo". Barra da manhã: 1 de 14. Principal: 6 internados no PS |
| 2 | Repetir com `manha-UTI.tsv` (setor UTI) e `manha-UI6_P1.tsv` (setor UI 6º P1) | Barra da manhã: 3 de 14. Cards dos setores com os números certos |
| 3 | Rotina **Tarde**: importar `tarde-UI6_P1.tsv` no setor UI 6º P1 | Prévia mostra: 1 transferido para cá (veio do PS-G), 1 troca de leito, 1 "não aparece mais" (vira saída a verificar) |
| 4 | Gestão de Vagas, com um usuário de perfil **SOLICITANTE**: escolher um paciente do PS, destino UTI, "Apto ao transporte", **Solicitar vaga** | A solicitação aparece para o NIR com o cronômetro correndo. Principal: "Aguardando leito: 1" |
| 5 | Com o perfil NIR: **Em análise**, depois informar o leito e clicar em **Leito cedido** | Status "Leito cedido". `MinutosAteCessao` e `DentroSLA` preenchidos. A lista `EventosVaga` tem 3 linhas para essa solicitação ("Ver log" no Histórico) |
| 6 | Na lista `Setores`, colocar `SLAMinutos = 1` na UTI e fazer nova solicitação para a UTI | Depois de 1 minuto, o cronômetro fica vermelho e a Principal mostra "Fora do SLA: 1". O fluxo F2 avisa no Teams em até 15 min |
| 7 | Rodar o fluxo F3 manualmente (Testar > Manualmente) | Linhas novas em `IndicadoresDiarios` |

**Testes das demais guias:**

| # | Guia | Teste | Resultado esperado |
|---|---|---|---|
| 8 | Previsões de Alta | Aba "Sem previsão", escolher uma data em um paciente e clicar em **Salvar previsão** | O paciente sai da aba. Em **Histórico** aparece o registro com o seu nome |
| 9 | Gestão da Permanência | Marcar **Serviço Social** em um paciente, incluir o tópico "Aguarda vaga em ILPI" e clicar em **Iniciar ▶** | O tópico aparece em Em andamento. O painel de cima conta 1 em andamento para Serviço Social |
| 10 | Ambulâncias | **+ Novo transporte** para amanhã às 08:00, marcar 3 itens do checklist e clicar em **Ambulância solicitada** | O cartão aparece em "Próximas 24 h" com "checklist 3/9" e o status muda |
| 11 | Previsão de Recepção | **+ Novo paciente CROSS** (seção Eletivas), depois **Cateterismo?**, escolher a data e clicar em **Agendar** | Na guia Cateterismos, o paciente aparece na data escolhida como "Externo Eletivo", com "veio da Previsão de Recepção" |
| 12 | Recepção → Cateterismos | No mesmo paciente, informar um atendimento e clicar em **Internado** | Na agenda, o tipo muda para "Internado Eletivo" |
| 13 | Cateterismos | **Importar planilha**, colar 3 linhas da agenda atual, **Pré-visualizar** e **Incluir na agenda** | Os exames aparecem nos dias certos. Linhas repetidas são ignoradas |
| 14 | Passagem de Plantão | Escrever uma observação geral e **Registrar passagem**. Entrar com outro usuário NIR e clicar em **Recebi o plantão** | Em "Passagens anteriores" aparece a passagem; **Ver** mostra a cópia completa |
| 15 | Rotina → Metas | Na seção b, colar o modelo de metas (Indicador, Competência, Meta, Realizado) com uma linha de `GIRO_LEITO`, **Pré-visualizar** e **Gravar valores** | Na guia Metas, o card "Giro de leito" mostra o valor no mês da linha |

Depois dos testes:
1. Apague os itens de teste de todas as listas, **menos** `Setores`,
   `PerfisUsuarios` e `MetasIndicadores`.
2. Volte o SLA da UTI para o valor correto.

---

## Solução de problemas

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Tudo vermelho depois de colar as fórmulas | Sintaxe errada (vírgula × ponto e vírgula) | Use o arquivo da outra pasta (passo 4) |
| "Name isn't valid" citando uma lista | A lista não foi conectada ou tem outro nome | Passo 3. Os nomes devem ser exatamente os do modelo de dados |
| "Name isn't valid" citando `frmAnexo` | Formulário ainda não criado | Passo 9 |
| Usuário vê "Seu perfil é só de visualização" | E-mail não está em `PerfisUsuarios` ou perfil diferente de NIR/SOLICITANTE | Cadastre o e-mail em minúsculas |
| Erro de permissão ao salvar | Falta permissão na lista no SharePoint | [05-perfis-lgpd.md](05-perfis-lgpd.md) |
| Horários 3 h adiantados ou atrasados | Fuso do site errado | [00](00-verificacao-ambiente.md), passo 4 |
| Prévia diz "Não encontrei a linha de cabeçalho" | O cabeçalho do Tasy usa um nome que não está nos sinônimos | Acrescente o nome em `tblMapaColunas` (App.Formulas) ou me envie o print do cabeçalho |
| Data de internação vazia na prévia | A data veio em formato diferente de dd/mm/aaaa | Me envie um exemplo do formato (sem dados de paciente) |
