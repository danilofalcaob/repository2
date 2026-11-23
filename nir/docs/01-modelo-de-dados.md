# 01 · Modelo de dados e criação das listas

Os dados do NIR ficam em **9 listas do SharePoint** no site "NIR – Command Center".

## Como as listas foram pensadas

- **Histórico sem estourar limites.** O censo completo não é gravado 4 vezes ao dia
  (seriam cerca de 600 mil linhas por ano). Gravam-se só três coisas:
  - o **estado atual** de cada internação (`Internacoes`);
  - **as mudanças** detectadas (`Movimentacoes`);
  - um **resumo por setor e por janela** (`CensoResumo`).

  Isso dá cerca de 20 mil linhas por ano e preserva todo o histórico de que os
  dashboards precisam.
- **Filtros rápidos (delegação).** Colunas usadas em filtros são **texto simples
  indexado**. Não há colunas de Escolha, Pesquisa ou Pessoa. Assim o Power Apps
  consulta direto no SharePoint, sem o limite de 2.000 linhas.
- **Nomes internos sem acento nem espaço** (`SetorCodigo`, `DataInternacao`…). O
  nome de exibição é igual ao interno, para que as fórmulas do app funcionem sem
  ajustes.
- **Códigos fixos em maiúsculas** (`INTERNADO`, `LEITO_CEDIDO`…). O app traduz para
  texto amigável na tela.
- **Chaves de data em texto** (`ChaveData` = `AAAA-MM-DD`, `JanelaChave` =
  `AAAA-MM-DD|MANHA`). Isso evita problemas de fuso horário entre o SharePoint,
  o Power Apps e o Power Automate.
- **Dia do NIR:** vai das **07:00 às 06:59**. Por isso a rotina da madrugada (05h)
  pertence ao dia que começou na manhã anterior.

---

## Opção A (recomendada): criar tudo com o script

1. Crie o site do NIR (veja [00-verificacao-ambiente.md](00-verificacao-ambiente.md)).
   Você precisa ser **proprietário** dele.
2. Abra a **página inicial do site** no Edge ou no Chrome, por exemplo
   `https://SEUTENANT.sharepoint.com/sites/NIR`.
3. Pressione **F12**, ou clique com o botão direito em "Inspecionar", e vá para a
   aba **Console**.
4. Abra o arquivo [`../sharepoint/provisionar-listas.js`](../sharepoint/provisionar-listas.js),
   copie **todo** o conteúdo, cole no Console e pressione **Enter**.
   - Se o navegador mostrar o aviso *"Don't paste code…"* / *"Não cole código…"*,
     digite `allow pasting` (ou `permitir colar`), Enter, e cole de novo.
5. Aguarde as mensagens azuis `[NIR]` até aparecer **"Concluído"**. Leva de 1 a 3
   minutos.
6. Se aparecer um aviso sobre fuso horário, ajuste conforme o
   [00-verificacao-ambiente.md](00-verificacao-ambiente.md).

O script pode ser executado de novo sem problema: ele só cria o que falta e nunca
apaga nada. Se o console estiver bloqueado pela política do navegador do hospital,
use a opção B.

## Opção B: criar manualmente

Para cada lista abaixo, faça o seguinte no site:
1. Vá em **Novo > Lista > Lista em branco**, com o nome exatamente igual ao da tabela.
2. Para cada coluna, use **+ Adicionar coluna** com o tipo indicado e o nome exato,
   sem acento e sem espaço.
   - "Data e hora": ative "Incluir hora".
   - "Data": deixe "Incluir hora" desativado.
3. Configure os índices: **Configurações da lista > Colunas indexadas > Criar novo
   índice**, para cada coluna marcada com ✔ em "Índice".
4. Configure os valores únicos: abra a coluna e marque "Impor valores exclusivos"
   nas colunas marcadas com ✔ em "Único".

Depois, cadastre os setores na lista `Setores` e o seu e-mail na lista
`PerfisUsuarios`, com Perfil = `NIR`.

---

## As listas

Legenda dos tipos: **Texto** = uma linha de texto · **Nota** = várias linhas de texto
(texto simples) · **Número** · **Data e hora** · **Data** (sem hora) · **Sim/Não**.

### 1. `Setores` — cadastro, leitos e SLA

| Coluna | Tipo | Índice | Único | Uso |
|---|---|:-:|:-:|---|
| Title | Texto | | | Nome de exibição ("UI 6º andar – Posto 1") |
| Codigo | Texto | ✔ | ✔ | Código fixo (`UI6_P1`) usado em todas as listas |
| Sigla | Texto | | | Nome curto para cards e gráficos (`UI6-P1`) |
| Grupo | Texto | ✔ | | `PS`, `UTI` ou `UI` |
| Andar | Número | | | 4, 6, 7… |
| Posto | Texto | | | "Posto 1", "Saúde Mental" |
| NomeTasy | Texto | | | Nome do setor exatamente como aparece no Tasy (usado para conferir o arquivo colado) |
| LeitosOperacionais | Número | | | Leitos disponíveis. É a base da ocupação. **Preencher.** |
| SLAMinutos | Número | | | SLA de cessão de leito para este setor como **destino**. Provisório: 120 |
| ExigeNaRotina | Sim/Não | | | Entra na barra de progresso das 4 rotinas |
| RecebeSolicitacao | Sim/Não | | | Aparece como opção de destino na solicitação de vaga |
| Ordem | Número | | | Ordem de exibição |
| Ativo | Sim/Não | | | Desative em vez de apagar |

**Setores cadastrados pelo script:**

| Ordem | Codigo | Nome | Sigla | Grupo |
|---|---|---|---|---|
| 1 | PS_GERAL | PS Geral | PS-G | PS |
| 2 | PS_ONCO | PS Oncologia | PS-O | PS |
| 3 | EMERGENCIA | Emergência | EMERG | PS |
| 4 | UTI | UTI | UTI | UTI |
| 5 | UI4_P1 | UI 4º andar – Posto 1 | UI4-P1 | UI |
| 6 | UI4_SM | UI 4º andar – Saúde Mental | UI4-SM | UI |
| 7–10 | UI6_P1 … UI6_P4 | UI 6º andar – Postos 1 a 4 | UI6-P1 … | UI |
| 11–14 | UI7_P1 … UI7_P4 | UI 7º andar – Postos 1 a 4 | UI7-P1 … | UI |

### 2. `Importacoes` — log da Rotina de Atualização

Cada arquivo importado ou arquivado gera um item. O **arquivo original fica como
anexo do item**, para auditoria.

| Coluna | Tipo | Índice | Uso |
|---|---|:-:|---|
| Title | Texto | | `2026-11-23\|MANHA\|UTI\|CENSO` |
| ChaveData | Texto | ✔ | Dia do NIR (`2026-11-23`) |
| DataRef | Data | | Mesmo dia, em formato de data (para relatórios) |
| Janela | Texto | | `MANHA`, `TARDE`, `NOITE`, `MADRUGADA` |
| JanelaChave | Texto | ✔ | `2026-11-23\|MANHA` |
| TipoGuia | Texto | ✔ | `CENSO`, `PREVISAO_ALTA`, `PERMANENCIA`, `AMBULANCIAS`, `METAS`, `OUTRO` |
| SetorCodigo | Texto | ✔ | Setor do arquivo (vazio para tipos sem setor) |
| Linhas | Número | | Pacientes lidos |
| Novos · Transferidos · TrocasLeito · Retornos · Saidas · Ignoradas | Número | | Resultado da comparação com o censo anterior |
| Status | Texto | | `PROCESSADO` (censo gravado) ou `ARQUIVADO` (só guardado) |
| EnviadoPorEmail · EnviadoPorNome | Texto | | Quem importou |
| ImportadoEm | Data e hora | ✔ | Momento da importação |
| Observacao | Nota | | Livre |

### 3. `Internacoes` — estado atual de cada internação

**Title = nº de atendimento do Tasy** (índice e valor único).

| Coluna | Tipo | Índice | Uso |
|---|---|:-:|---|
| Title | Texto | ✔ (único) | Nº de atendimento |
| Prontuario | Texto | ✔ | |
| Paciente · Idade · Sexo | Texto | | |
| SetorCodigo | Texto | ✔ | Setor atual |
| Leito | Texto | | Leito atual |
| DataInternacao | Data e hora | | Base dos dias de internação (≥ 15 dias → Gestão da Permanência) |
| Medico · Especialidade · Convenio | Texto | | |
| Diagnostico | Nota | | |
| Status | Texto | ✔ | Ver tabela de status |
| PrimeiraVezVistoEm · UltimaVezVistoEm | Data e hora | | Primeira e última vez que o paciente apareceu em um censo |
| UltimaJanelaChave | Texto | | Última janela em que apareceu |
| SaidaDetectadaEm | Data e hora | ✔ | Quando sumiu do setor |
| SaidaConfirmadaEm | Data e hora | | Quando o NIR confirmou a saída |
| PrevisaoAlta | Data | | Previsão de alta (do Tasy, se vier no arquivo; na fase 2, também registrada pela equipe) |
| Observacao | Nota | | |

**Status da internação**

| Código | Significado |
|---|---|
| `INTERNADO` | Apareceu no último censo do setor |
| `SAIDA_VERIFICAR` | Sumiu do censo do setor e ainda não apareceu em outro setor na mesma janela |
| `ALTA_PRESUMIDA` | A janela fechou (todos os setores importados) e o paciente não apareceu em nenhum setor |
| `ALTA_CONFIRMADA` · `OBITO` · `TRANSFERIDO_EXTERNO` | Confirmado pelo NIR no painel de saídas |

### 4. `Movimentacoes` — histórico de mudanças

| Coluna | Tipo | Índice | Uso |
|---|---|:-:|---|
| Title | Texto | ✔ | Nº de atendimento |
| Paciente | Texto | | |
| SetorDe · LeitoDe · SetorPara · LeitoPara | Texto | | Origem e destino |
| Tipo | Texto | ✔ | `ADMISSAO`, `TRANSFERENCIA`, `TROCA_LEITO`, `RETORNO`, `SAIDA_VERIFICAR`, `ALTA_PRESUMIDA`, `ALTA_CONFIRMADA`, `OBITO`, `TRANSFERIDO_EXTERNO`, `CORRECAO` |
| DetectadoEm | Data e hora | ✔ | |
| JanelaChave | Texto | | |
| PorEmail | Texto | | |

`ADMISSAO` significa "primeira vez que o paciente aparece em um censo". No começo do
uso, todos os pacientes aparecem como admissão.

### 5. `CensoResumo` — tendência por setor e janela

| Coluna | Tipo | Índice | Uso |
|---|---|:-:|---|
| Title | Texto | ✔ | `2026-11-23\|MANHA\|UTI` (reimportar a mesma janela atualiza o item) |
| ChaveData | Texto | ✔ | |
| DataRef | Data | ✔ | |
| Janela | Texto | | |
| SetorCodigo | Texto | ✔ | |
| Pacientes · Leitos | Número | | |
| OcupacaoPct | Número | | Pacientes ÷ leitos × 100 |
| Perm15d | Número | | Pacientes com ≥ 15 dias de internação |
| PermMediaDias | Número | | Média de dias de internação |
| ImportadoEm | Data e hora | | |

### 6. `SolicitacoesVaga` — pedidos de leito

Esta lista tem **versionamento** ativado: o SharePoint guarda cada versão do item.

| Coluna | Tipo | Índice | Uso |
|---|---|:-:|---|
| Title | Texto | ✔ | Nº de atendimento |
| Paciente | Texto | | |
| SetorOrigem · LeitoOrigem | Texto | ✔ / – | |
| SetorDestino | Texto | ✔ | Setor solicitado |
| CondicaoTransporte | Texto | | `APTO`, `EM_DEFINICAO`, `INAPTO` |
| Status | Texto | ✔ | `SOLICITADA` → `EM_ANALISE` → `LEITO_CEDIDO` → `CONCLUIDA`, ou `CANCELADA` |
| SolicitadoEm | Data e hora | ✔ | Início do cronômetro |
| SolicitadoPorEmail · SolicitadoPorNome | Texto | ✔ / – | |
| EmAnaliseEm | Data e hora | | Clique "Em análise" |
| LeitoCedidoEm | Data e hora | ✔ | Clique "Leito cedido": **fim do cronômetro do SLA** |
| LeitoCedido | Texto | | Leito informado pelo NIR |
| ConcluidoEm | Data e hora | | Paciente chegou ao leito (clique ou detectado pela rotina) |
| CanceladoEm · MotivoCancelamento | Data e hora / Texto | | |
| SLAMinutos | Número | | SLA do destino **congelado no momento do pedido** |
| MinutosAteCessao | Número | | Solicitação → leito cedido |
| DentroSLA | Texto | | `SIM` / `NAO` |
| AlertaNivel | Número | | 0 = sem alerta · 1 = avisou 80% · 2 = avisou estouro (usado pelo fluxo F2) |
| Observacao | Nota | | |
| AtualizadoPorEmail | Texto | | Último a alterar |

### 7. `EventosVaga` — log de cada ação

Só recebe inclusões; os itens nunca são alterados.

| Coluna | Tipo | Índice | Uso |
|---|---|:-:|---|
| Title | Texto | | Evento: `SOLICITADA`, `CONDICAO`, `EM_ANALISE`, `LEITO_CEDIDO`, `CONCLUIDA`, `CANCELADA` |
| SolicitacaoId | Número | ✔ | ID do item em `SolicitacoesVaga` |
| NrAtendimento | Texto | | |
| ValorDe · ValorPara | Texto | | Antes e depois |
| Em | Data e hora | ✔ | |
| PorEmail · PorNome | Texto | | |
| Observacao | Nota | | |

### 8. `IndicadoresDiarios` — consolidação diária

Gravada pelo fluxo F3 todo dia às 00:10, com os números do dia anterior. É a base das
tendências longas e, na fase 4, das metas automáticas.

| Coluna | Tipo | Índice | Uso |
|---|---|:-:|---|
| Title | Texto | ✔ | `2026-11-23\|VAGAS_SOLICITADAS\|TODOS` |
| ChaveData | Texto | ✔ | |
| DataRef | Data | ✔ | |
| Indicador | Texto | ✔ | Ver lista em [03-fluxos-power-automate.md](03-fluxos-power-automate.md) |
| SetorCodigo | Texto | | Código do setor ou `TODOS` |
| Valor | Número | | |

### 9. `PerfisUsuarios` — perfil no app

| Coluna | Tipo | Índice | Único | Uso |
|---|---|:-:|:-:|---|
| Title | Texto | | | Nome |
| Email | Texto | ✔ | ✔ | **Sempre em minúsculas** |
| Perfil | Texto | | | `NIR`, `SOLICITANTE`, `PERMANENCIA`, `VISUALIZACAO` |
| Especialidade | Texto | | | Fase 2: `MEDICO`, `ENFERMAGEM`, `SERVICO_SOCIAL`, `FISIOTERAPIA` |
| SetorCodigo | Texto | | | Setor padrão do solicitante (o app já abre filtrado nele) |
| Ativo | Sim/Não | | | |

Quem abre o app sem estar nesta lista recebe o perfil **SOLICITANTE**. O padrão é
configurável em `App.Formulas`.

---

## Listas das próximas fases (já desenhadas)

| Fase | Lista | Conteúdo |
|---|---|---|
| 2 | `PrevisoesAlta` | Histórico de cada previsão (atendimento, data prevista, quem, quando). O valor atual é espelhado em `Internacoes.PrevisaoAlta` |
| 2 | `PermanenciaAcompanhamento` | Um item por paciente com ≥ 15 dias: flags de pendência por especialidade (Médico, Enfermagem, Serviço Social, Fisioterapia) e campos complementares |
| 2 | `PermanenciaTopicos` | Kanban: atendimento, especialidade, tópico, status (`PLANEJADO` / `EM_ANDAMENTO` / `CONCLUIDO`), responsável, prazo e datas |
| 3 | `Transportes` | Ambulâncias: tipo, motivo, destino, empresa, horários (agendado, solicitado, confirmado, chegada, saída, retorno), status, "pode retornar" e checklist |
| 4 | `MetasIndicadores` · `MetasValores` | Cadastro das metas institucionais e valores mensais (meta × realizado) |

Os detalhes estão em [06-roadmap-fases.md](06-roadmap-fases.md).
