# NIR · Command Center — Hospital Rubens Furlan Júnior

Programa para a **Gestão Plena do Núcleo Interno de Regulação (NIR)**. É a primeira
etapa do futuro **Command Center** do hospital.

**O problema:** hoje a informação do NIR fica espalhada entre o Tasy, planilhas do
Excel e Forms. Sem histórico, não há como comparar com meses anteriores nem enxergar
tendências.

**A solução:** um aplicativo dentro do **Microsoft 365 do hospital**, sem depender
da TI e sem custo extra de licença:

| Peça | Ferramenta Microsoft | Papel |
|---|---|---|
| Dados e histórico | **Listas do SharePoint** (site "NIR – Command Center") | Guardam pacientes, solicitações de vaga, rotina, movimentações e indicadores |
| Telas | **Power Apps** (aplicativo de tela, *Canvas app*) | As 10 guias do NIR (lista completa abaixo) |
| Automação | **Power Automate** (só conectores *standard*) | Lembretes da rotina, alerta de SLA no Teams, fechamento diário dos indicadores |
| Login | Conta Microsoft institucional | Automático: quem abre o app já está identificado |

```
Tasy (Ctrl+E em cada setor) ──copiar/colar──► Power Apps "NIR – Command Center"
                                                │
                                                ▼
                                Listas do SharePoint (histórico)
                                                ▲
                Power Automate: lembretes 05h/09h/17h/23h · alerta de SLA · fechamento diário
```

> **Dados reais de pacientes:** tudo fica dentro do *tenant* Microsoft 365 do
> hospital, com acesso controlado pelos grupos do site SharePoint. Leia
> [`docs/05-perfis-lgpd.md`](docs/05-perfis-lgpd.md) antes de usar com dados reais.

---

## Por onde começar

| Passo | Documento | Quem | Tempo estimado |
|---|---|---|---|
| 0 | [Verificação do ambiente](docs/00-verificacao-ambiente.md) | Você | 30 min |
| 1 | [Modelo de dados + criação das listas](docs/01-modelo-de-dados.md) | Você (script pronto) | 20 min |
| 2 | [Montagem do aplicativo](docs/02-guia-montagem-app.md) | Você (código pronto para colar) | 3–4 h |
| 3 | [Fluxos do Power Automate](docs/03-fluxos-power-automate.md) | Você | 1–2 h |
| 4 | [POPs do NIR (rotina e demais guias)](docs/04-pop-rotina-atualizacao.md) | Equipe do NIR | treinamento de 1 h |
| 5 | [Perfis, permissões e LGPD](docs/05-perfis-lgpd.md) | Você + coordenação | 30 min |
| — | [Desenho das guias e próximos passos](docs/06-roadmap-fases.md) | — | — |
| — | [Pendências do projeto](docs/07-pendencias.md) | Você + NIR + coordenação | — |

Antes de montar no Power Apps, abra o **protótipo visual**:
**https://claude.ai/artifact/QQGAFStk4wuUNwmejzQgP2** (código em
[`prototipo/`](prototipo/)).
- Usa dados fictícios e mostra como ficam as **10 guias**.
- Dá para testar os fluxos principais: colar um Ctrl+E de exemplo, solicitar vaga e
  ceder leito, marcar pendências no Kanban, agendar cateterismo pela Recepção,
  importar a agenda e as metas, registrar a passagem de plantão.
- Também dá para trocar o perfil simulado (NIR, Solicitante, Permanência,
  Visualização).
- Serve para validar o layout com a equipe do NIR antes da montagem.

---

## As 10 guias

| Guia | O que faz | Quem usa |
|---|---|---|
| **Principal** | Rotinas do dia (barra de progresso), KPIs de leitos e vagas, maiores esperas com cronômetro, cards por setor, tendência de 14 dias e um card de cada guia. Tem Modo TV | NIR, Visualização |
| **Rotina de Atualização** | (a) Censo do setor colado do Ctrl+E do Tasy, com prévia e anexo; saídas a verificar; outros documentos arquivados. (b) Metas: anexo + valores do modelo padrão | NIR |
| **Gestão de Vagas** | Solicitação de vaga com condição de transporte, botões do NIR com log, cronômetro de SLA, histórico e relatório | NIR, Solicitante, Visualização |
| **Metas** | Metas automáticas (calculadas pelo app) e de planilha, com o mês atual, a meta, o status (atingida ou não), 12 meses e tendência | NIR, Visualização |
| **Previsões de Alta** | Altas previstas hoje, amanhã e em 48 h; vencidas; sem previsão; acurácia; registro com histórico | NIR, Permanência, Visualização |
| **Gestão da Permanência** | Pacientes com ≥ 15 dias: painel, flags por especialidade, Kanban (Planejado → Em andamento → Concluído), plano e previsão de alta | NIR, Permanência |
| **Ambulâncias** | Próximas 24 h e 24–48 h, etapas com horário, checklist de 9 itens, radar de quem está fora e pode voltar | NIR, Visualização |
| **Cateterismos** | Agenda por dia com os 4 tipos de paciente, importação da planilha, realizado/remarcado/suspenso/cancelado, atalho para solicitar vaga | NIR, Visualização |
| **Previsão de Recepção** | Casos aceitos via CROSS (Ambulatoriais e Eletivas), desfechos e check de cateterismo que agenda o exame na guia Cateterismos | NIR, Visualização |
| **Passagem de Plantão** | PS com vaga, recepções, cateterismos e transportes das próximas 24 h, observações por seção, registro e "Recebi" com histórico | NIR |

Os setores cadastrados são 14:
- PS Geral, PS Oncologia, Emergência e UTI.
- UI 4º andar: Posto 1 e Saúde Mental.
- UI 6º andar: Postos 1 a 4.
- UI 7º andar: Postos 1 a 4.

**Informações que ainda faltam:** onde a definição não veio da equipe, o app usa
um padrão razoável. Exemplos: turnos de 12 h, horizonte de 24 h na passagem,
checklist de 9 itens e destinos pós-cateterismo. Todos estão marcados e listados em
[`docs/07-pendencias.md`](docs/07-pendencias.md), com o lugar exato onde mudar.
Quase todos são tabelas em `App.Formulas` ou colunas de lista: mudam sem mexer nas
telas.

**Próxima etapa (Command Center):** painel de TV dedicado, mais alertas, giro de
leito e higienização, e integração direta com o Tasy quando a TI puder. Veja
[`docs/06-roadmap-fases.md`](docs/06-roadmap-fases.md).

---

## Conteúdo desta pasta

```
nir/
  README.md                          este arquivo
  docs/                              guias passo a passo (00 a 07)
  sharepoint/provisionar-listas.js   cria as 18 listas, colunas, índices, os 14 setores, as metas iniciais e o seu perfil NIR
  powerapps/App.Formulas.fx          fórmulas globais (sintaxe com vírgula — Power Apps em inglês)
  powerapps/App.OnStart.fx           inicialização do app
  powerapps/pt-BR/                   os mesmos arquivos na sintaxe com ponto e vírgula (Power Apps em português)
  powerapps/telas/*.pa.yaml          as 10 telas prontas para colar no Power Apps Studio (e a cópia pt-BR)
  exemplos/*.tsv                     censos fictícios para testar a importação
  prototipo/                         protótipo visual navegável (dados fictícios)
  ferramentas/                       gerador das telas (pa/: uma guia por arquivo), conversor pt-BR e testes
```

## Para quem mantém o código

As telas `.pa.yaml` são **geradas**: edite os módulos em `ferramentas/pa/` (um por guia; blocos comuns em `pa/base.mjs`), não os YAML.

```bash
node nir/ferramentas/gerar-telas.mjs        # regera as telas (en-US e pt-BR)
node nir/ferramentas/converter-ptbr.mjs     # regera powerapps/pt-BR/*.fx a partir de App.Formulas/OnStart
node nir/ferramentas/testar-importacao.mjs  # testa as regras de importação, rotina e SLA
```

O teste também confere se os sinônimos de colunas do protótipo (`prototipo/logica.js`)
são os mesmos do app (`App.Formulas.fx`).
