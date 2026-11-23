# 07 · Pendências do projeto

Lista única do que falta resolver. Marque cada item ao concluir. A coluna
**Destrava** diz o que depende dele:
- **F1** = montagem da fase 1
- **Uso** = uso com dados reais
- **F2 / F3 / F4** = fases seguintes

## A. Ambiente Microsoft 365 (você · Fase 0)

| # | Pendência | Destrava |
|---|---|---|
| A1 | [ ] Confirmar que **+ Criar > Criar do zero** abre o editor do Power Apps (sem aviso de licença) | F1 |
| A2 | [ ] Confirmar que o Power Automate permite criar **Fluxo da nuvem agendado** | F1 (alertas) |
| A3 | [ ] Criar o site **NIR – Command Center** (ou equipe no Teams) e confirmar que você é proprietário | F1 |
| A4 | [ ] Ajustar o fuso do site para **(UTC-03:00) Brasília** | F1 |
| A5 | [ ] Testar o console do navegador (F12) ou decidir criar as listas à mão | F1 |
| A6 | [ ] Ver se o seu Power Apps usa vírgula ou ponto e vírgula nas fórmulas | F1 |
| A7 | [ ] Colar **uma tela** (a Principal) e me informar se foi aceita ou o erro exato | F1 e todas as fases |
| A8 | [ ] Criar ou indicar o canal do Teams para os alertas (rotina e SLA) | F1 (alertas) |

## B. Arquivo do Tasy (Ctrl+E)

| # | Pendência | Destrava |
|---|---|---|
| B1 | [ ] Print **só da linha de cabeçalho** do Ctrl+E (sem dados de paciente) | F1 |
| B2 | [ ] Confirmar que o arquivo traz o **nº de atendimento**, que é a chave que liga tudo. Se não trouxer, definimos outra chave (ex.: prontuário + data de entrada) | F1 |
| B3 | [ ] Confirmar o formato da **data de internação** (ex.: 22/11/2026 14:35) | F1 |
| B4 | [ ] Confirmar se o Ctrl+E tem **as mesmas colunas em todos os setores** (PS, UTI, UIs) | F1 |
| B5 | [ ] Nome de cada setor como aparece no Tasy (campo `NomeTasy`, para conferir se o arquivo colado é do setor certo) | F1 (opcional) |
| B6 | [ ] Informar se o arquivo traz **previsão de alta** | F2 |
| B7 | [ ] Medir o tempo real de uma rotina completa (14 setores) depois de montado | Uso |

## C. Regras da Gestão de Vagas e da rotina (NIR / coordenação)

| # | Pendência | Destrava |
|---|---|---|
| C1 | [ ] **Lista de setores está completa?** Hoje são 14. Há outros (outra UTI, observação, pediatria, centro cirúrgico/RPA)? | F1 |
| C2 | [ ] **Leitos operacionais** de cada setor | F1 (ocupação) |
| C3 | [ ] **SLA de cada setor de destino**, em minutos (hoje provisório: 120) | Uso |
| C4 | [ ] O SLA termina em **"Leito cedido"** (como está) ou em **"Paciente no leito"**? | Uso |
| C5 | [ ] O cronômetro **pausa** em "Inapto ao transporte"? E em "Em definição"? | Uso |
| C6 | [ ] O solicitante escolhe o **setor** de destino (como está) ou um **leito específico**? Hoje o NIR informa o leito na cessão | Uso |
| C7 | [ ] Paciente que ainda **não apareceu em nenhuma rotina** (internado depois do último censo): permitir cadastro manual na Gestão de Vagas? | Uso |
| C8 | [ ] Precisa de **prioridade** na solicitação (ex.: urgente / eletiva)? | Uso |
| C9 | [ ] Lista de **motivos de cancelamento** (hoje: alta, óbito, mudança de conduta, transferência externa, duplicada, outro) | Uso |
| C10 | [ ] Confirmar horários das rotinas (09h, 17h, 23h, 05h), a **tolerância** de 60 min e o **dia do NIR das 07h às 06h59** | Uso |
| C11 | [ ] Quem confirma as **altas presumidas** e em que momento do plantão | Uso |

## D. Pessoas, acesso e governança

| # | Pendência | Destrava |
|---|---|---|
| D1 | [ ] Lista de usuários com **e-mail e perfil** (NIR, Solicitante, Visualização; na fase 2, Permanência) | Uso |
| D2 | [ ] Quem não estiver cadastrado entra como **Solicitante** (como está) ou não entra? | Uso |
| D3 | [ ] Membros dos **grupos do SharePoint**. Há grupos do Microsoft 365/Teams já existentes para usar (ex.: todos os enfermeiros)? | Uso |
| D4 | [ ] **Comunicar o DPO** (Encarregado de Dados) e registrar o aceite do uso de dados de pacientes no SharePoint | Uso |
| D5 | [ ] Prazo de **retenção** dos arquivos anexados (sugestão: 1 ano) | Uso |
| D6 | [ ] TV da sala do NIR: fica em local de circulação? Mostrar só **iniciais** dos pacientes? | Uso |
| D7 | [ ] Indicar pelo menos 1 **coproprietário** do app e dos fluxos (continuidade se alguém sair) | Uso |
| D8 | [ ] Licença **Power BI Pro** para quem vê os dashboards? | F4 (opcional) |

## E. Fase 2 · Gestão da Permanência e Previsões de Alta

| # | Pendência | Destrava |
|---|---|---|
| E1 | [ ] **Campos da tabela** da Permanência além dos que vêm do Tasy | F2 |
| E2 | [ ] Os **15 dias** contam da entrada no hospital (incluindo o tempo no PS) ou da internação no setor? | F2 |
| E3 | [ ] Tópicos do Kanban: **texto livre** ou **catálogo** de pendências comuns (ex.: aguarda vaga em ILPI, aguarda exame externo)? | F2 |
| E4 | [ ] Cada tópico tem **responsável** e **prazo**? | F2 |
| E5 | [ ] **Quem edita o quê**: cada especialidade só no seu Kanban? NIR em todos? | F2 |
| E6 | [ ] **Previsão de alta**: quem registra (médico assistente? NIR?), para todos os pacientes ou só ≥ 15 dias, e com que frequência é revisada | F2 |
| E7 | [ ] **Indicadores** do dashboard da Permanência | F2 |
| E8 | [ ] Nomes e e-mails de enfermeiros supervisores e seniores, Serviço Social, coordenadores médicos e fisioterapeutas supervisores | F2 |

## F. Fase 3 · Ambulâncias

| # | Pendência | Destrava |
|---|---|---|
| F1 | [ ] Como as solicitações de ambulância chegam hoje (Forms, planilha, telefone)? Há arquivo para importar? | F3 |
| F2 | [ ] Tipos de transporte (USA, USB, remoção) e **empresas** contratadas | F3 |
| F3 | [ ] **Marcos de tempo** a registrar e se há SLA para algum deles | F3 |
| F4 | [ ] Itens do **checklist** de rotina | F3 |
| F5 | [ ] Regra do **radar**: por quanto tempo acompanhar quem foi para serviço externo e pode voltar | F3 |

## G. Fase 4 · Metas

| # | Pendência | Destrava |
|---|---|---|
| G1 | [ ] **Lista das metas institucionais**: nome, fórmula, unidade, meta e se "maior" ou "menor" é melhor | F4 |
| G2 | [ ] **Fonte** e periodicidade de cada indicador (Tasy, Qualidade, planilha própria) | F4 |
| G3 | [ ] Aceite de um **modelo padrão de planilha** por quem envia os dados | F4 |
| G4 | [ ] **Histórico** dos meses anteriores para a carga inicial (comparações e tendências) | F4 |

## H. Ajustes técnicos (comigo, depois dos testes)

| # | Pendência | Depende de |
|---|---|---|
| H1 | [ ] Ajustar o código das telas se a colagem falhar (versões de controles ou sintaxe) | A7 |
| H2 | [ ] Ajustar os sinônimos de colunas e a leitura de datas ao formato real do Tasy | B1–B4 |
| H3 | [ ] Corrigir os erros que o Verificador do Power Apps apontar na montagem | A7 |
| H4 | [ ] Implementar as regras definidas em C4–C8 | C4–C8 |
| H5 | [ ] Rever desempenho com volume real (tempo de importação por setor) | B7 |
