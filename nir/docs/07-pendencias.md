# 07 · Pendências do projeto

Lista única do que falta resolver ou confirmar. Marque cada item ao concluir. A coluna
**Destrava** diz o que depende dele:
- **F1** = montagem da fase 1
- **Uso** = uso com dados reais
- **F2 / F3 / F4** = fases seguintes

## Padrões assumidos no app (revise e me diga o que mudar)

As 10 guias estão implementadas. Onde a definição ainda não existia, usei o padrão
abaixo. A coluna **Onde mudar** diz se a mudança é só de configuração (sem mexer nas
telas) ou se precisa de um ajuste no código, que eu faço.

| # | Pendência | Como ficou no app | Onde mudar |
|---|---|---|---|
| C3 | SLA por setor | 120 min para todos (provisório) | Lista `Setores`, coluna `SLAMinutos` |
| C4 | Fim do cronômetro do SLA | No clique **Leito cedido** | Ajuste no código (Vagas e F2) |
| C5 | Pausa no "Inapto ao transporte" | Não pausa | Ajuste no código |
| C6 | O que o solicitante escolhe | O **setor** de destino; o NIR informa o leito na cessão | Ajuste no código |
| C9 | Motivos de cancelamento | Alta, óbito, mudança de conduta, transferência externa, duplicada, outro | `App.Formulas` → `tblMotivosCancelamento` |
| C10 | Horários das rotinas e dia do NIR | 09h, 17h, 23h e 05h; tolerância de 60 min; dia das 07h às 06h59 | `App.Formulas` → `tblJanelas`, `gToleranciaRotinaMin`, `gHoraInicioDia` |
| D2 | Quem não está cadastrado | Entra como Solicitante | `App.Formulas` → `gPerfilPadrao` |
| E1 | Campos da Permanência | Destino de alta previsto, plano terapêutico e observações | Lista `PermanenciaAcompanhamento` + `tblDestinosAlta` |
| E2 | Contagem dos 15 dias | Desde a data de internação que vem do Tasy | `App.Formulas` → `gDiasPermanencia` (corte) |
| E3/E4 | Tópicos do Kanban | Texto livre; responsável e prazo opcionais | Ajuste no código, se quiser um catálogo |
| E5 | Quem edita o quê | Perfis NIR e Permanência editam qualquer especialidade | Ajuste no código, se cada um só puder a sua |
| E6 | Previsão de alta | NIR e Permanência registram; "sem previsão" fica em destaque | Ajuste no código |
| F1 | Entrada das ambulâncias | Formulário no app | — |
| F2 | Tipos de transporte | USA, USB, remoção simples, outro | `App.Formulas` → `tblTiposTransporte` |
| F3 | Etapas | Agendado → solicitada → confirmada → chegou → saiu → retornou/concluído; sem SLA | `App.Formulas` → `tblStatusTransporte` |
| F4 | Checklist | 9 itens (autorização, relatório, exames, contato com o destino, agenda confirmada, acompanhante, equipamentos/O2, documentos, família) | `tblChecklist` + colunas `Chk…` da lista (trocar item = ajuste no código) |
| F5 | Radar | Enquanto estiver "Paciente saiu" e puder retornar, sem prazo | Ajuste no código |
| G1 | Metas | 8 exemplos: 5 automáticas e 3 de planilha | Lista `MetasIndicadores` |
| G3 | Modelo de metas | Colunas Indicador, Competência, Meta, Realizado | `App.Formulas` → `tblMapaMetas` |
| I1 | Seções da Recepção | Ambulatoriais e Eletivas | `App.Formulas` → `tblSecoesRecepcao` (nova seção = mais um ajuste de tela) |
| I2/I3 | Entrada e campos da Recepção | Formulário: paciente, idade, sexo, CNS, ficha CROSS, seção, origem, município, especialidade, motivo, previsão, setor previsto | Lista `Recepcoes` |
| I4 | Desfechos | Chegou, Internado (pede atendimento), Retornou à origem, Não veio, Cancelado | `tblStatusRecepcao` |
| I6 | Dias à frente | 7 | `App.Formulas` → `gDiasRecepcao` |
| J1 | Colunas da planilha de cateterismos | Data, Hora, Paciente, Tipo, Atendimento, Prontuário, Idade, Procedimento, Médico, Convênio, Procedência, Observação | `App.Formulas` → `tblMapaCate` (acrescente sinônimos) |
| J2 | Planilha × app | Importação inicial e reimportações sem duplicar (mesmo dia + mesmo paciente) | — |
| J4 | Status do cateterismo | Agendado, realizado, remarcado, suspenso, cancelado | `tblStatusCate` |
| J5 | Tipo vindo da Recepção | Escolhido ao marcar o check (padrão: Externo Eletivo) | — |
| J6/J7 | Internar e desmarcar | Internar troca para "Internado"; desmarcar, "Não veio" ou "Cancelar" cancelam o exame | Ajuste no código |
| J8 | Destino após o exame | Alta, retorna ao setor, UCO/UTI, enfermaria, cirurgia cardíaca, transferência | `tblDestinosPosCate` |
| J9 | Quem edita a agenda | Só o NIR; Visualização só lê | `tblMenu` / perfis (perfil da hemodinâmica = ajuste no código) |
| K1 | Turnos do NIR | 07h–19h e 19h–07h | `tblTurnos` + regra de turno na tela da Passagem (ajuste no código) |
| K2 | PS na passagem | Só com vaga solicitada, com botão para mostrar todos | — |
| K3/K4 | Registro e observações | Registrar + "Recebi" + histórico com cópia; observações por seção e gerais | — |
| K5 | Horizonte da passagem | 24 h | `App.Formulas` → `gHorizontePassagemH` |
| L2 | Ordem do menu | As 7 originais e as 3 novas no fim | `App.Formulas` → `tblMenu` (a ordem da tabela é a do menu) |

**Ainda não implementado** (precisa de definição):
- **C7**: cadastro manual, na Gestão de Vagas, de paciente que ainda não apareceu no
  censo.
- **C8**: prioridade da solicitação de vaga.
- **I7**: solicitação de vaga automática para quem vem pela Recepção.
- **J10**: limite de exames por dia ou sala.
- **K7**: impressão da passagem. Hoje dá para abrir a cópia em "Ver" e copiar o texto.

As listas abaixo continuam valendo como checklist do que confirmar.

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

## I. Nova guia · Previsão de Recepção (CROSS)

| # | Pendência | Destrava |
|---|---|---|
| I1 | [ ] Confirmar as seções **Ambulatoriais** e **Eletivas**. Entram também as urgências reguladas pelo CROSS? | Recepção |
| I2 | [ ] Como os casos aceitos chegam hoje: o CROSS gera relatório/planilha ou o NIR copia da tela do CROSS? (Define se a entrada é por formulário ou por colagem) | Recepção |
| I3 | [ ] **Campos** necessários: nº da ficha CROSS, CNS, serviço e município de origem, especialidade, diagnóstico, setor previsto, data e hora previstas… | Recepção |
| I4 | [ ] Confirmar os **desfechos**: chegou · internado · avaliado e retornou à origem · não compareceu · cancelado. Quem registra cada um? | Recepção |
| I5 | [ ] Quando o paciente chega e interna, o NIR informa o **nº de atendimento** para ligar ao censo? | Recepção |
| I6 | [ ] Quantos **dias à frente** a guia deve mostrar? | Recepção |
| I7 | [ ] Paciente que vai precisar de leito: gerar a **solicitação na Gestão de Vagas** antes de ele chegar? | Recepção |

## J. Nova guia · Cateterismos

| # | Pendência | Destrava |
|---|---|---|
| J1 | [ ] Print do **cabeçalho da planilha Excel** atual da agenda (sem dados de paciente) | Cateterismos |
| J2 | [ ] A planilha é **migração única** (depois a agenda passa a viver no app) ou continuará sendo mantida fora e importada de tempos em tempos? Quem a mantém hoje? | Cateterismos |
| J3 | [ ] **Campos**: hora, procedimento (cateterismo diagnóstico, angioplastia, outros?), médico, convênio, procedência… | Cateterismos |
| J4 | [ ] Confirmar os **status**: agendado · realizado · cancelado · remarcado · suspenso | Cateterismos |
| J5 | [ ] **Tipo automático** de quem vem da Recepção: Eletiva → "Externo Eletivo"; Ambulatorial → ?; quando é "Externo Urgência Relativa"? | Cateterismos |
| J6 | [ ] Se o paciente externo é internado antes do exame, o tipo muda para **"Internado"** sozinho ao informar o atendimento? | Cateterismos |
| J7 | [ ] Desmarcar o check na Recepção **cancela** o cateterismo ou só desfaz o vínculo? | Cateterismos |
| J8 | [ ] Registrar o **destino após o exame** (alta, UCO/UTI, enfermaria, cirurgia) para antecipar a vaga? | Cateterismos |
| J9 | [ ] **Quem acessa e edita**: a equipe da hemodinâmica entra no app? (Seria um perfil novo) | Cateterismos |
| J10 | [ ] Há **limite de exames por dia ou sala** que a agenda deve controlar? | Cateterismos |

## K. Nova guia · Passagem de Plantão (NIR)

| # | Pendência | Destrava |
|---|---|---|
| K1 | [ ] **Turnos do NIR** (ex.: 07h–19h e 19h–07h?). Definem o horizonte de cada seção | Passagem |
| K2 | [ ] Seção PS: mostrar **todos os pacientes do PS** (destacando os com vaga) ou **só os com vaga solicitada**? | Passagem |
| K3 | [ ] **Registro formal**: quem passa, quem recebe, botão "Recebi" e histórico imutável? | Passagem |
| K4 | [ ] **Observações**: por paciente, por seção ou só gerais? | Passagem |
| K5 | [ ] **Horizonte** das seções de recepção e cateterismo: até o fim do próximo plantão? 24 h? | Passagem |
| K6 | [ ] A seção de transportes depende da guia Ambulâncias: **antecipar Ambulâncias** ou começar a passagem sem essa seção? | Passagem |
| K7 | [ ] Precisa **imprimir** a passagem? | Passagem |

## L. Planejamento geral

| # | Pendência | Destrava |
|---|---|---|
| L1 | [ ] **Ordem das fases** com as novas guias (proposta em [06-roadmap-fases.md](06-roadmap-fases.md#ordem-sugerida-a-decidir)) | Planejamento |
| L2 | [ ] **Ordem das guias no menu** (hoje as novas aparecem no fim, como "em breve") | Planejamento |
| L3 | [ ] Confirmar os **novos cards na Principal**: recepções previstas hoje/amanhã e cateterismos do dia por tipo | Planejamento |

## H. Ajustes técnicos (comigo, depois dos testes)

| # | Pendência | Depende de |
|---|---|---|
| H1 | [ ] Ajustar o código das telas se a colagem falhar (versões de controles ou sintaxe) | A7 |
| H2 | [ ] Ajustar os sinônimos de colunas e a leitura de datas ao formato real do Tasy | B1–B4 |
| H3 | [ ] Corrigir os erros que o Verificador do Power Apps apontar na montagem | A7 |
| H4 | [ ] Implementar as regras definidas em C4–C8 | C4–C8 |
| H5 | [ ] Rever desempenho com volume real (tempo de importação por setor) | B7 |
