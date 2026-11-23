# 03 · Fluxos do Power Automate

São três fluxos, todos com **conectores standard**: SharePoint, Microsoft Teams e
Office 365 Outlook. Nenhum exige licença premium.

| Fluxo | Quando roda | O que faz |
|---|---|---|
| **F1 · Lembrete da rotina** | 05:30, 06:30, 09:30, 10:30, 17:30, 18:30, 23:30 e 00:30 | Avisa no Teams quais setores ainda faltam na rotina atual |
| **F2 · Alerta de SLA** | A cada 15 minutos | Avisa no Teams quando uma solicitação atinge 80% do SLA e quando estoura (uma vez cada) |
| **F3 · Fechamento diário** | Todo dia às 00:10 | Grava os indicadores do dia anterior em `IndicadoresDiarios` |

**Antes de começar:**
1. Crie no Teams do NIR um canal para os avisos, por exemplo **"Alertas NIR"**. Pode
   ser o canal Geral.
2. Em todos os gatilhos de **Recorrência**, ajuste **Fuso horário = (UTC-03:00) Brasília**.
3. Os nomes das ações aparecem em português no Power Automate. Quando uma expressão
   citar o nome de uma ação, por exemplo `outputs('Agora')`, **renomeie a ação
   exatamente com esse nome**. Para renomear: clique nos **…** da ação e escolha
   **Renomear**.
4. Para colar uma expressão: clique no campo, depois no ícone **fx** (Expressão),
   cole e clique em **Adicionar**.

> **Fuso de Brasília:** nas expressões aparece `'E. South America Standard Time'`,
> que é o nome técnico do fuso de Brasília. O Brasil não tem horário de verão desde
> 2019, então a diferença para o UTC é sempre de 3 horas.

---

## F1 · Lembrete da rotina

**Criar:** make.powerautomate.com > **+ Criar** > **Fluxo da nuvem agendado**. Nome:
`NIR F1 - Lembrete da rotina`.

1. **Recorrência**
   - Intervalo: `1` · Frequência: **Dia**
   - Fuso horário: **(UTC-03:00) Brasília**
   - Nestas horas: `0, 5, 6, 9, 10, 17, 18, 23` · Nestes minutos: `30`
2. **Compor**, renomeada para **`Agora`**:
   `convertFromUtc(utcNow(), 'E. South America Standard Time', 'yyyy-MM-ddTHH:mm:ss')`
3. **Compor**, renomeada para **`Hora`**:
   `int(formatDateTime(outputs('Agora'), 'HH'))`
4. **Compor**, renomeada para **`DataRef`** (o dia do NIR começa às 07h):
   `if(less(outputs('Hora'), 7), formatDateTime(addDays(outputs('Agora'), -1), 'yyyy-MM-dd'), formatDateTime(outputs('Agora'), 'yyyy-MM-dd'))`
5. **Compor**, renomeada para **`Janela`**:
   `if(and(greaterOrEquals(outputs('Hora'), 7), less(outputs('Hora'), 13)), 'MANHA', if(and(greaterOrEquals(outputs('Hora'), 13), less(outputs('Hora'), 20)), 'TARDE', if(or(greaterOrEquals(outputs('Hora'), 20), less(outputs('Hora'), 3)), 'NOITE', 'MADRUGADA')))`
6. **SharePoint · Obter itens**, renomeada para **`Setores`**
   - Endereço do site: o site do NIR · Nome da lista: `Setores`
   - Consulta de filtro: `ExigeNaRotina eq 1 and Ativo eq 1`
7. **SharePoint · Obter itens**, renomeada para **`Importacoes`**
   - Lista: `Importacoes`
   - Consulta de filtro (o texto entre chaves são as saídas das ações 4 e 5; insira
     pelo conteúdo dinâmico):
     `JanelaChave eq '{DataRef}|{Janela}' and TipoGuia eq 'CENSO'`
8. **Operação de Dados · Selecionar**, renomeada para **`Recebidos`**
   - De: `value` de **Importacoes**
   - Mapa: clique em **Alternar para modo de texto** e use a expressão
     `item()?['SetorCodigo']`
9. **Operação de Dados · Filtrar matriz**, renomeada para **`Faltam`**
   - De: `value` de **Setores**
   - **Editar no modo avançado** e cole: `@not(contains(body('Recebidos'), item()?['Codigo']))`
10. **Condição**: `length(body('Faltam'))` **é maior que** `0`
11. Em **Se sim**:
    - **Operação de Dados · Selecionar**, renomeada para **`Siglas`**: De
      `body('Faltam')`, mapa em modo texto `item()?['Sigla']`.
    - **Microsoft Teams · Postar mensagem em um chat ou canal**
      - Postar como: **Flow bot** · Postar em: **Canal** · Equipe: NIR · Canal: Alertas NIR
      - Mensagem (as partes com `@{...}` são expressões):
        `⏰ Rotina @{outputs('Janela')} de @{outputs('DataRef')}: faltam @{length(body('Faltam'))} setor(es): @{join(body('Siglas'), ', ')}`

**Teste:** clique em **Testar > Manualmente**. Se nenhum censo foi importado, a
mensagem lista os 14 setores.

---

## F2 · Alerta de SLA

**Criar:** fluxo da nuvem agendado `NIR F2 - Alerta de SLA`.

1. **Recorrência**: Intervalo `15` · Frequência **Minuto**.
2. **SharePoint · Obter itens**, renomeada para **`Abertas`**
   - Lista: `SolicitacoesVaga`
   - Consulta de filtro: `Status eq 'SOLICITADA' or Status eq 'EM_ANALISE'`
3. **Aplicar a cada**, renomeada para **`Cada`**, sobre o `value` de **Abertas**. Dentro
   dele:
   1. **Compor**, renomeada para **`Minutos`**:
      `div(sub(ticks(utcNow()), ticks(items('Cada')?['SolicitadoEm'])), 600000000)`
   2. **Compor**, renomeada para **`SLA`**:
      `if(empty(items('Cada')?['SLAMinutos']), 120, items('Cada')?['SLAMinutos'])`
   3. **Compor**, renomeada para **`Pct`**:
      `div(mul(outputs('Minutos'), 100), outputs('SLA'))`
   4. **Compor**, renomeada para **`Nivel`**:
      `coalesce(items('Cada')?['AlertaNivel'], 0)`
   5. **Condição** **`Estourou`**: `outputs('Pct')` maior ou igual a `100` **E**
      `outputs('Nivel')` menor que `2`
      - **Se sim:**
        - **Teams · Postar mensagem** no canal:
          `🔴 SLA estourado: @{items('Cada')?['Paciente']} (@{items('Cada')?['SetorOrigem']} → @{items('Cada')?['SetorDestino']}) aguarda há @{outputs('Minutos')} min (SLA @{outputs('SLA')} min).`
        - **SharePoint · Atualizar item**: lista `SolicitacoesVaga` · Id
          `items('Cada')?['ID']` · Title `items('Cada')?['Title']` · **AlertaNivel = 2**
      - **Se não:** outra **Condição** **`Oitenta`**: `outputs('Pct')` maior ou igual
        a `80` **E** `outputs('Nivel')` menor que `1`
        - **Se sim:** a mesma postagem com
          `🟡 80% do SLA: @{items('Cada')?['Paciente']} ... há @{outputs('Minutos')} min.`
          e **Atualizar item** com **AlertaNivel = 1**.

O fluxo só olha `SOLICITADA` e `EM_ANALISE`. Depois de **Leito cedido**, o cronômetro
para e não há mais alerta.

---

## F3 · Fechamento diário (indicadores)

**Criar:** fluxo da nuvem agendado `NIR F3 - Fechamento diario`.

1. **Recorrência**: Intervalo `1` · Frequência **Dia** · Fuso **Brasília** · Nestas
   horas `0` · Nestes minutos `10`.
2. **Compor** **`Ontem`**:
   `formatDateTime(addDays(convertFromUtc(utcNow(), 'E. South America Standard Time'), -1), 'yyyy-MM-dd')`
3. **Compor** **`Hoje`**:
   `formatDateTime(convertFromUtc(utcNow(), 'E. South America Standard Time'), 'yyyy-MM-dd')`
4. **Compor** **`Ini`** (00:00 de ontem em Brasília = 03:00 UTC): `concat(outputs('Ontem'), 'T03:00:00Z')`
5. **Compor** **`Fim`**: `concat(outputs('Hoje'), 'T03:00:00Z')`
6. **SharePoint · Obter itens** **`JaFeito`**: lista `IndicadoresDiarios` · filtro
   `ChaveData eq '{Ontem}'` · Contagem superior `1`.
   **Condição**: `length(body('JaFeito')?['value'])` maior que `0` → **Se sim:**
   **Encerrar** (status *Êxito*). Isso evita duplicar o dia se o fluxo rodar duas vezes.
7. **SharePoint · Obter itens** **`Solicitadas`**: lista `SolicitacoesVaga` · filtro
   `SolicitadoEm ge '{Ini}' and SolicitadoEm lt '{Fim}'`. Em **Configurações** da
   ação, ative **Paginação** com limite `5000`.
8. **SharePoint · Obter itens** **`Cedidas`**: mesmo, com filtro
   `LeitoCedidoEm ge '{Ini}' and LeitoCedidoEm lt '{Fim}'`.
9. **Filtrar matriz** **`NoSLA`**: de `body('Cedidas')?['value']`, modo avançado
   `@equals(item()?['DentroSLA'], 'SIM')`.
10. **Filtrar matriz** **`Canceladas`**: de `body('Solicitadas')?['value']`, modo
    avançado `@equals(item()?['Status'], 'CANCELADA')`.
11. **Inicializar variável** `Soma` (tipo *Float*, valor `0`). Esta ação precisa
    ficar no nível de cima do fluxo, logo depois do gatilho.
12. **Aplicar a cada**, renomeado para **`CadaCedida`**, sobre `body('Cedidas')?['value']` →
    **Incrementar variável** `Soma` em `float(coalesce(items('CadaCedida')?['MinutosAteCessao'], 0))`.
13. **Compor** **`NCed`**: `length(body('Cedidas')?['value'])`
14. Crie 5 ações **SharePoint · Criar item** na lista `IndicadoresDiarios`. Em todas:
    - `ChaveData` = `{Ontem}`
    - `DataRef` = `{Ontem}`
    - `SetorCodigo` = `TODOS`
    - `Title` = `{Ontem}|INDICADOR|TODOS`

    | Indicador | Valor (expressão) |
    |---|---|
    | `VAGAS_SOLICITADAS` | `length(body('Solicitadas')?['value'])` |
    | `VAGAS_CEDIDAS` | `outputs('NCed')` |
    | `TEMPO_MEDIO_CESSAO_MIN` | `if(equals(outputs('NCed'), 0), 0, div(variables('Soma'), outputs('NCed')))` |
    | `PCT_CESSAO_NO_SLA` | `if(equals(outputs('NCed'), 0), 0, div(mul(length(body('NoSLA')), 100.0), outputs('NCed')))` |
    | `VAGAS_CANCELADAS` | `length(body('Canceladas'))` |
15. **SharePoint · Obter itens** **`CensoNoite`**: lista `CensoResumo` · filtro
    `ChaveData eq '{Ontem}' and Janela eq 'NOITE'`. Esse é o censo das 23h, o retrato
    diário de cada setor.
16. **Aplicar a cada**, renomeado para **`CadaSetor`**, sobre `body('CensoNoite')?['value']`,
    com 3 **Criar item** em `IndicadoresDiarios`. Em todos, `SetorCodigo` =
    `items('CadaSetor')?['SetorCodigo']`:

    | Indicador | Valor |
    |---|---|
    | `PACIENTES` | `items('CadaSetor')?['Pacientes']` |
    | `OCUPACAO_PCT` | `coalesce(items('CadaSetor')?['OcupacaoPct'], 0)` |
    | `PERMANENCIA_15D` | `items('CadaSetor')?['Perm15d']` |

    Title: `concat(outputs('Ontem'), '|PACIENTES|', items('CadaSetor')?['SetorCodigo'])`,
    e da mesma forma para os outros dois.

**Teste:** rode manualmente e confira as linhas novas em `IndicadoresDiarios`. Se
precisar refazer, apague as linhas do dia antes de rodar de novo.

### Indicadores gravados (base das metas automáticas da fase 4)

| Indicador | Setor | Significado |
|---|---|---|
| `VAGAS_SOLICITADAS` | TODOS | Solicitações abertas no dia |
| `VAGAS_CEDIDAS` | TODOS | Leitos cedidos no dia |
| `TEMPO_MEDIO_CESSAO_MIN` | TODOS | Média de minutos entre a solicitação e a cessão (cessões do dia) |
| `PCT_CESSAO_NO_SLA` | TODOS | % das cessões do dia dentro do SLA |
| `VAGAS_CANCELADAS` | TODOS | Solicitações do dia que foram canceladas |
| `PACIENTES` | cada setor | Pacientes no censo das 23h |
| `OCUPACAO_PCT` | cada setor | Ocupação no censo das 23h |
| `PERMANENCIA_15D` | cada setor | Pacientes com ≥ 15 dias no censo das 23h |

---

## Dono dos fluxos

Os fluxos rodam com a conta de quem os criou. Se essa pessoa sair do hospital, os
fluxos param. Para evitar isso:
- Em cada fluxo, vá em **Detalhes > Proprietários > Editar** e adicione pelo menos
  mais um membro da equipe do NIR como coproprietário.
- O ideal, no futuro, é a TI fornecer uma conta de serviço.
