# 06 · Roadmap das próximas fases

A fase 1 deixa a **fundação** pronta: censo com histórico, movimentações, Gestão de
Vagas com SLA, Principal e indicadores diários. As fases seguintes **acrescentam**
listas e telas sem refazer o que existe.

Os itens ainda **a definir com a equipe** estão marcados com ❓. A lista completa
fica em [07-pendencias.md](07-pendencias.md).

> **Novas guias (incluídas em 23/11/2026):** Cateterismos, Passagem de Plantão e
> Previsão de Recepção. O desenho delas está na seção [Novas guias](#novas-guias),
> mais abaixo. A **ordem final das fases** será decidida no planejamento, depois de
> resolvida parte das pendências. A seção
> [Ordem sugerida](#ordem-sugerida-a-decidir) traz uma proposta.

---

## Fase 2 · Gestão da Permanência + Previsões de Alta

### Gestão da Permanência (pacientes com ≥ 15 dias)

**Quem acessa:** perfis `NIR` e `PERMANENCIA` (enfermeiros supervisores e seniores,
Serviço Social, coordenadores médicos, fisioterapeutas supervisores).

**Tela, em duas seções:**

- **Seção superior, dashboard** (também resumido na Principal):
  - Pacientes com ≥ 15 dias, total e por setor.
  - Distribuição por faixa de permanência: 15–29, 30–59, ≥ 60 dias.
  - Pacientes com pendência por especialidade.
  - Tópicos do Kanban por status (Planejado / Em andamento / Concluído), por
    especialidade, e os mais antigos sem andamento.
  - % de pacientes com previsão de alta registrada.
  - Tempo médio para concluir um tópico.
- **Seção inferior, tabela de pacientes:**
  - Um paciente por linha. A lista vem do censo: `Internacoes` com
    `DataInternacao` de 15 dias ou mais.
  - Colunas: leito, setor, paciente, dias de internação, médico, previsão de alta e
    as quatro flags de pendência (**Médico · Enfermagem · Serviço Social ·
    Fisioterapia**).
  - Ao marcar a flag de uma especialidade, abre o **Kanban** daquela especialidade
    para o paciente. Cada item é um **tópico** (ex.: "aguarda vaga em ILPI",
    "aguarda laudo de exame"), que anda entre **Planejado → Em andamento →
    Concluído**.
  - Campos que o arquivo não traz podem ser completados pela equipe ❓ (lista final
    a definir).
  - **Previsão de alta obrigatória:** pacientes sem previsão ficam destacados.

**Listas novas:**

| Lista | Colunas principais |
|---|---|
| `PermanenciaAcompanhamento` | Title = nº atendimento · PendMedico, PendEnfermagem, PendServicoSocial, PendFisioterapia (Sim/Não) · campos complementares ❓ · UltimaRevisaoEm · UltimaRevisaoPor |
| `PermanenciaTopicos` | NrAtendimento · Especialidade · Titulo · Descricao · Status (`PLANEJADO`/`EM_ANDAMENTO`/`CONCLUIDO`) · Responsavel · Prazo · CriadoEm · IniciadoEm · ConcluidoEm |
| `PrevisoesAlta` | NrAtendimento · DataPrevista · RegistradoEm · RegistradoPor · Origem (equipe/Tasy) — histórico; o valor atual é espelhado em `Internacoes.PrevisaoAlta` por um fluxo |

### Previsões de Alta

A guia mostra:
- Altas previstas para **hoje, amanhã e 48 h**, por setor.
- Previsões **vencidas** (a data passou e o paciente continua internado).
- Pacientes **sem previsão**.
- **Acurácia**: compara previsto × realizado. A data real da saída vem das
  `Movimentacoes` (alta presumida ou confirmada).
- A Principal ganha o card de altas previstas, que hoje já mostra o que vier do
  Tasy.

---

## Fase 3 · Ambulâncias

**Objetivo:** controlar as ambulâncias solicitadas e os tempos de cada etapa, ver
os transportes das próximas 24 h e 48 h com checklist, e manter no radar os
pacientes que foram para serviços externos e podem retornar.

**Lista `Transportes`:**
- **Identificação:** NrAtendimento · Paciente · SetorOrigem.
- **Transporte:** Tipo (USA / USB / remoção simples ❓) · Motivo (exame externo,
  procedimento, transferência definitiva, alta) · Destino (serviço) · Empresa.
- **Horários:** AgendadoPara · SolicitadoEm · ConfirmadoEm · ChegadaAmbulanciaEm ·
  SaidaPacienteEm · RetornoPrevisto · RetornouEm.
- **Situação:** Status (`AGENDADO`, `SOLICITADO`, `CONFIRMADO`, `EM_TRANSITO`,
  `NO_SERVICO_EXTERNO`, `RETORNOU`, `NAO_RETORNARA`, `CANCELADO`) ·
  **PodeRetornar** (Sim/Não).
- **Checklist** (Sim/Não) ❓: autorização/guia · relatório médico · exames e imagens ·
  contato com o destino · vaga/agenda confirmada · acompanhante · equipamentos/O₂ ·
  documentos · família avisada.

**Tela:**
- **Abas:** Próximas 24 h · 24–48 h · Em andamento · **Radar** (pacientes fora que
  podem voltar) · Histórico.
- Cronômetros de cada etapa.
- Checklist com destaque do que falta.
- Botões de horário, no mesmo padrão da Gestão de Vagas.
- Lembrete do Power Automate na véspera dos transportes com checklist incompleto.

---

## Fase 4 · Metas

**Objetivo:** mostrar as metas institucionais, a evolução mês a mês e a comparação
com o histórico (gráficos de linha e tendência).

- **Modelo padrão em Excel** (`.xlsx` com uma Tabela chamada `Metas`): colunas
  Indicador · Competência (AAAA-MM) · Meta · Realizado · Sentido (maior/menor é
  melhor) · Fonte.
- Esse formato o Power Automate *standard* lê. Um fluxo importa o arquivo anexado
  na seção **b) Metas** da Rotina de Atualização.
- **Listas:**
  - `MetasIndicadores`: cadastro, unidade, sentido e meta vigente.
  - `MetasValores`: um valor por mês.
- **Metas automáticas**, calculadas a partir de `IndicadoresDiarios`, sem planilha:
  - tempo médio de cessão de leito;
  - % de cessões dentro do SLA;
  - ocupação média;
  - pacientes com ≥ 15 dias.
- **Tela:**
  - Card por meta com o valor do mês, a meta e o semáforo.
  - Linha de 12 meses com a meta tracejada.
  - Seta de tendência comparando os últimos 3 meses com os 3 anteriores.
- **Power BI (opcional):** se a equipe tiver licença Pro, o mesmo conteúdo pode ser
  publicado como relatório e incorporado no site.

---

## Novas guias

### Como elas se ligam ao resto

```
Previsão de Recepção (CROSS) ──check "Cateterismo" + data──► Cateterismos
         │                                                        │
         │ chegou e internou: nº de atendimento ─► Internacoes    │ internado: nº de atendimento ─► Internacoes
         ▼                                                        ▼
Gestão de Vagas (só PS) ──┐                                       │
Previsão de Recepção ─────┼──────────────► PASSAGEM DE PLANTÃO ◄──┘
Ambulâncias (transportes)─┘          (só leitura + registro de quem passou/recebeu)
```

- O **nº de atendimento** continua sendo a chave. Quando um paciente da Recepção ou
  de um cateterismo externo é internado, o NIR informa o atendimento. A partir daí,
  setor e leito vêm do censo automaticamente.
- A **Passagem de Plantão não tem dados próprios**, só o registro da passagem
  (quem passou, quem recebeu, observações e uma cópia congelada para o histórico).
  Ela lê das outras guias.

### Previsão de Recepção (casos aceitos via CROSS)

**Objetivo:** listar os pacientes que serão recebidos nos próximos dias, aceitos
pelo CROSS. Alguns serão avaliados e voltarão ao serviço de origem.

**Tela:**
- Duas seções: **Ambulatoriais** e **Eletivas** ❓ (confirmar se entram também as
  urgências reguladas).
- Abas: **Hoje · Amanhã · Próximos 7 dias · Atrasados** (a data prevista passou e o
  paciente não chegou) · **Histórico**.
- Em cada paciente, o check **"Cateterismo"**. Ao marcar, o app pede a **data do
  exame** (e a hora, se houver) e **cria automaticamente o paciente na guia
  Cateterismos**, com um vínculo entre os dois registros:
  - mudar a data na Recepção atualiza o cateterismo;
  - desmarcar o check cancela o cateterismo ❓.
- Botões de desfecho:
  - **Chegou**: registra a data/hora;
  - **Internado**: pede o nº de atendimento;
  - **Avaliado e retornou à origem**;
  - **Não compareceu**;
  - **Cancelado**.
- Card na Principal: recepções previstas para **hoje** e **amanhã**.

**Lista nova `Recepcoes`:**

| Grupo | Colunas |
|---|---|
| Identificação | Title = paciente · Idade · Sexo · CNS ❓ · NrFichaCROSS |
| Previsão | Secao (`AMBULATORIAL` / `ELETIVA`) · ServicoOrigem · MunicipioOrigem · Especialidade · Motivo/diagnóstico · PrevistoPara (data e hora) · SetorPrevisto |
| Cateterismo | PrecisaCateterismo (Sim/Não) · DataCateterismo · CateterismoId |
| Desfecho | Status (`PREVISTO`, `CHEGOU`, `INTERNADO`, `RETORNOU_ORIGEM`, `NAO_COMPARECEU`, `CANCELADO`) · ChegadaEm · NrAtendimento (ao internar) |
| Registro | Observacao · RegistradoPor · AtualizadoPor |

- **Indicadores:**
  - recebidos por mês;
  - % de retorno à origem;
  - % de não comparecimento;
  - diferença entre a data prevista e a chegada.
- **Entrada dos dados:** formulário no app. Se o CROSS gerar relatório em Excel,
  também por colagem, como no censo ❓.

### Cateterismos

**Objetivo:** agenda dos cateterismos cardíacos, com o tipo de cada paciente.

**Tela:**
- Agenda **por dia**, em ordem de horário, com filtros por **tipo** e **status**.
- **Tipo**, com cor e rótulo:
  - **Externo Eletivo**;
  - **Externo Urgência Relativa** (ainda não internados);
  - **Internado Eletivo**;
  - **Internado Urgência**.
- **Entrada dos dados:**
  - **migração da planilha Excel atual** por colagem (Ctrl+A, Ctrl+C, Ctrl+V), com
    prévia, como no censo;
  - cadastro manual;
  - **automática pela Previsão de Recepção** (check "Cateterismo").
- Paciente **internado**: com o nº de atendimento, o app mostra o setor e o leito
  atuais a partir do censo.
- **Status:** `AGENDADO`, `REALIZADO`, `CANCELADO`, `REMARCADO` (nova data) e
  `SUSPENSO` ❓.
- **Possíveis integrações** ❓:
  - **Destino após o exame** (alta, UCO/UTI, enfermaria, cirurgia), para o NIR
    antecipar a vaga. Daria para gerar a solicitação na Gestão de Vagas com um
    clique.
  - **Internado aguardando cateterismo** como pendência da Gestão da Permanência,
    porque é um dos motivos clássicos de internação prolongada.
- Card na Principal: cateterismos **de hoje** por tipo.

**Lista nova `Cateterismos`:**

| Grupo | Colunas |
|---|---|
| Identificação | Title = paciente · NrAtendimento (internados) · Prontuario · Idade |
| Agenda | DataHoraExame · Tipo (`EXTERNO_ELETIVO`, `EXTERNO_URGENCIA_RELATIVA`, `INTERNADO_ELETIVO`, `INTERNADO_URGENCIA`) · Procedimento ❓ · MedicoSolicitante · Convenio · ServicoOrigem (externos) |
| Situação | Status · DestinoPosExame ❓ · Observacao |
| Origem | Origem (`PLANILHA`, `RECEPCAO`, `MANUAL`) · RecepcaoId |

- **Indicadores:**
  - exames por dia e por tipo;
  - taxa de cancelamento e de remarcação;
  - **dias de internação aguardando o exame** (internados).

### Passagem de Plantão (NIR)

**Objetivo:** reunir em uma tela, separada por seções, tudo o que o plantão que
chega precisa saber. A tela é **montada automaticamente**: ninguém digita os
pacientes.

| Seção | De onde vem | O que mostra |
|---|---|---|
| **1. PS com vaga solicitada** | Gestão de Vagas, apenas PS Geral, PS Oncologia e Emergência | Paciente, leito, setor de destino, status da solicitação, condição de transporte e cronômetro do SLA ❓ (todos os pacientes do PS ou só os com vaga) |
| **2. Previsão de Recepção** | Previsão de Recepção | Quem deve chegar até o fim do próximo plantão, mais os atrasados ❓ (horizonte) |
| **3. Cateterismos** | Cateterismos | Agenda do próximo plantão e internados aguardando o exame |
| **4. Previsão de transporte** | Ambulâncias | Transportes nas próximas 24 h e pacientes fora do hospital que podem voltar |

**Registro da passagem**, para o histórico:
- quem passou e quem recebeu;
- o botão **"Recebi"**, que é o ciente de quem assume;
- observações por seção e gerais;
- uma **cópia congelada** do conteúdo naquele momento, para consultar depois como
  estava o plantão.

**Lista nova `PassagensPlantao`:**
- Data · Turno ❓ · PassadoPor · RecebidoPor
- IniciadaEm · RecebidaEm · Status (`RASCUNHO` / `CONCLUIDA`)
- ObservacoesGerais · ObsSecoes · Snapshot (cópia em texto)

**Dependência:** a seção 4 depende da guia Ambulâncias. Se a Passagem vier antes,
a seção fica como "em breve" ou recebe um registro simples de transportes ❓.

---

## Ordem sugerida (a decidir)

Proposta para discutir no planejamento. Ela considera as dependências entre as
guias e o tempo que cada uma leva para ter dados úteis:

| Ordem | Bloco | Por quê |
|---|---|---|
| 1 | **Fase 1 (pronta):** Principal, Rotina de Atualização, Gestão de Vagas | Fundação, já entregue |
| 2 | **Previsão de Recepção + Cateterismos** | São ligadas entre si, não dependem do censo para funcionar e dão resultado imediato |
| 3 | **Ambulâncias + Passagem de Plantão** | A passagem precisa das guias 2 e das ambulâncias para ficar completa |
| 4 | **Gestão da Permanência + Previsões de Alta** | Usa o histórico do censo, que já estará acumulando desde a fase 1 |
| 5 | **Metas** | Precisa de meses de indicadores para comparar |
| 6 | **Command Center** | Painel de TV, alertas e integração direta com o Tasy |

---

## Command Center (etapa final)

- **Painel de TV dedicado:**
  - Ocupação em tempo real.
  - Fila de vagas com cronômetros.
  - Ambulâncias do dia.
  - Altas previstas e pendências críticas.
  - Rotação automática entre telas.
- **Alertas ativos:**
  - SLA (já existe).
  - Rotina atrasada (já existe).
  - Ocupação acima de um limite.
  - Paciente acima de N dias sem tópico em andamento.
- **Giro de leito e higienização:** tempo entre a alta e o leito liberado. Precisa
  de um registro da higienização ❓.
- **Integração direta com o Tasy:** quando a TI puder, por exemplo com uma *view* do
  banco ou uma API do Tasy, o copiar-e-colar é substituído por uma carga automática
  que grava **nas mesmas listas**. As telas e os dashboards não mudam.
- **Escala:** se o volume crescer ou a TI quiser, é possível migrar sem perder o
  modelo de dados:
  - para **Dataverse** (licença premium);
  - para um app **SPFx**;
  - para um web app no **Azure**.

---

## Pontos em aberto (não bloqueiam a fase 1)

A lista completa e atualizada, incluindo as novas guias, está em
[07-pendencias.md](07-pendencias.md). Os principais:

| # | Ponto | Onde muda |
|---|---|---|
| 1 | **SLA por setor de destino** (hoje provisório: 120 min) | Coluna `SLAMinutos` da lista `Setores`: muda sem mexer no app |
| 2 | O relógio do SLA **pausa** enquanto o paciente está "Inapto ao transporte"? | Regra no app e no fluxo F2 |
| 3 | Campos complementares da Gestão da Permanência | Lista `PermanenciaAcompanhamento` |
| 4 | Itens do checklist de ambulâncias | Lista `Transportes` |
| 5 | Lista oficial de leitos operacionais por setor | Coluna `LeitosOperacionais` |
| 6 | Indicadores e metas institucionais que entram na guia Metas | Modelo de metas (fase 4) |
