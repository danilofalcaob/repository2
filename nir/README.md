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
| Telas | **Power Apps** (aplicativo de tela, *Canvas app*) | Principal, Rotina de Atualização, Gestão de Vagas e, nas próximas fases, as demais guias |
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
| 2 | [Montagem do aplicativo](docs/02-guia-montagem-app.md) | Você (código pronto para colar) | 2–3 h |
| 3 | [Fluxos do Power Automate](docs/03-fluxos-power-automate.md) | Você | 1–2 h |
| 4 | [POP da Rotina de Atualização](docs/04-pop-rotina-atualizacao.md) | Equipe do NIR | treinamento de 30 min |
| 5 | [Perfis, permissões e LGPD](docs/05-perfis-lgpd.md) | Você + coordenação | 30 min |
| — | [Roadmap das próximas fases](docs/06-roadmap-fases.md) | — | — |

Antes de montar no Power Apps, abra o **protótipo visual**
([`prototipo/index.html`](prototipo/index.html)). Ele usa dados fictícios e mostra
como ficam as três telas da primeira entrega. Serve para validar o layout com a
equipe do NIR.

---

## Primeira entrega (fase 1)

1. **Principal**
   - Barra de progresso das 4 rotinas do dia (manhã 09h, tarde 17h, noite 23h, madrugada 05h).
   - KPIs: internados, ocupação, vagas abertas, vagas fora do SLA, maior espera, PS aguardando leito e tempo até a cessão.
   - Solicitações críticas com cronômetro.
   - Cards por setor e tendência de 14 dias.
   - Modo TV para a sala do NIR.
2. **Rotina de Atualização**
   - Seção (a), arquivos das guias: o censo do setor (Ctrl+E do Tasy) é colado no app. O arquivo original fica anexado. Uma prévia mostra admissões, transferências, trocas de leito e saídas antes de gravar.
   - Seção (b), Metas: os arquivos já são arquivados agora; a importação automática chega na fase 4.
   - Painel de saídas a verificar e histórico de importações.
3. **Gestão de Vagas**
   - Pacientes internados por setor.
   - Solicitação de vaga com a condição de transporte: Apto / Em definição / Inapto ao transporte.
   - Botões do NIR (Em análise, Leito cedido, Transferência concluída, Cancelar) com log de cada clique.
   - Cronômetro de SLA por setor de destino.
   - Histórico e relatório.

Os setores cadastrados são 14:
- PS Geral, PS Oncologia, Emergência e UTI.
- UI 4º andar: Posto 1 e Saúde Mental.
- UI 6º andar: Postos 1 a 4.
- UI 7º andar: Postos 1 a 4.

## Próximas fases

| Fase | Entrega |
|---|---|
| 2 | Gestão da Permanência (≥ 15 dias, pendências por especialidade em Kanban) + Previsões de Alta |
| 3 | Ambulâncias (próximas 24 h/48 h, tempos, checklist, radar de pacientes em serviço externo) |
| 4 | Metas (modelo padrão em Excel, gráficos de linha e tendência, metas automáticas) |
| 5 | Command Center: painel de TV, alertas, giro de leito e integração direta com o Tasy quando a TI puder |

O modelo de dados já foi desenhado pensando nessas fases. Elas entram como listas e
telas novas, sem refazer o que já existe.

---

## Conteúdo desta pasta

```
nir/
  README.md                          este arquivo
  docs/                              guias passo a passo (00 a 06)
  sharepoint/provisionar-listas.js   cria as 9 listas, colunas, índices, os 14 setores e o seu perfil NIR
  powerapps/App.Formulas.fx          fórmulas globais (sintaxe com vírgula — Power Apps em inglês)
  powerapps/App.OnStart.fx           inicialização do app
  powerapps/pt-BR/                   os mesmos arquivos na sintaxe com ponto e vírgula (Power Apps em português)
  powerapps/telas/*.pa.yaml          telas prontas para colar no Power Apps Studio
  exemplos/*.tsv                     censos fictícios para testar a importação
  prototipo/                         protótipo visual navegável (dados fictícios)
  ferramentas/                       utilitários (conversão de sintaxe pt-BR, testes)
```
