# 06 · Roadmap das próximas fases

A fase 1 deixa a **fundação** pronta: censo com histórico, movimentações, Gestão de
Vagas com SLA, Principal e indicadores diários. As fases seguintes **acrescentam**
listas e telas sem refazer o que existe.

Os itens ainda **a definir com a equipe** estão marcados com ❓.

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

## Fase 5 · Command Center

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

| # | Ponto | Onde muda |
|---|---|---|
| 1 | **SLA por setor de destino** (hoje provisório: 120 min) | Coluna `SLAMinutos` da lista `Setores`: muda sem mexer no app |
| 2 | O relógio do SLA **pausa** enquanto o paciente está "Inapto ao transporte"? | Regra no app e no fluxo F2 |
| 3 | Campos complementares da Gestão da Permanência | Lista `PermanenciaAcompanhamento` |
| 4 | Itens do checklist de ambulâncias | Lista `Transportes` |
| 5 | Lista oficial de leitos operacionais por setor | Coluna `LeitosOperacionais` |
| 6 | Indicadores e metas institucionais que entram na guia Metas | Modelo de metas (fase 4) |
