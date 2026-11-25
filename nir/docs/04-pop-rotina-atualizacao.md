# 04 · POPs do NIR — Rotina de Atualização e demais guias

**Procedimento Operacional Padrão · Núcleo Interno de Regulação**

| | |
|---|---|
| **Objetivo** | Manter o programa do NIR atualizado com o censo de todos os setores de internação, gerando histórico para dashboards e indicadores |
| **Responsável** | Profissional do NIR em plantão |
| **Frequência** | 4 vezes ao dia: **Manhã 09h · Tarde 17h · Noite 23h · Madrugada 05h** |
| **Tempo estimado** | 15 a 25 minutos por rotina (cerca de 1 minuto por setor) |
| **Ferramentas** | Tasy (Ctrl+E), Excel e o app NIR – Command Center, tela **Rotina de Atualização** |

---

## Janelas de cada rotina

| Rotina | Horário previsto | Pode ser feita entre | Fica "Atrasada" depois de |
|---|---|---|---|
| Manhã | 09:00 | 07:00 e 12:59 | 10:00 |
| Tarde | 17:00 | 13:00 e 19:59 | 18:00 |
| Noite | 23:00 | 20:00 e 02:59 | 00:00 |
| Madrugada | 05:00 | 03:00 e 06:59 | 06:00 |

O "dia do NIR" vai das **07:00 às 06:59**: a rotina da madrugada pertence ao dia que
começou na manhã anterior. O app escolhe a rotina e o dia sozinho pelo horário. Só
mude esses campos para registrar uma rotina atrasada.

## Passo a passo (para cada setor)

1. **No Tasy:** entre no setor e pressione **Ctrl+E**. O arquivo é baixado.
2. **No Excel:** abra o arquivo baixado. Pressione **Ctrl+A** (selecionar tudo) e
   **Ctrl+C** (copiar).
3. **No app**, tela **Rotina de Atualização**, seção **a)**:
   1. **Tipo de arquivo:** "Censo do setor (Ctrl+E do Tasy)".
   2. **Setor:** depois do primeiro, o app já sugere o próximo setor que falta.
   3. **Anexo:** clique em **Anexar arquivo** e escolha o arquivo baixado. Ele fica
      guardado para auditoria.
   4. Clique na caixa de colar e pressione **Ctrl+V**.
   5. Clique em **Pré-visualizar**.
4. **Confira a prévia** antes de gravar:
   - O número de pacientes bate com o setor?
   - Os **transferidos para cá** e as **trocas de leito** fazem sentido?
   - Os pacientes que **não aparecem mais** realmente saíram do setor?
   - Algum **aviso em vermelho**? Por exemplo, "a coluna Setor não bate", que indica
     um arquivo do setor errado.
5. Clique em **Confirmar importação**. Aguarde a mensagem verde.
6. Repita para o próximo setor. A barra de progresso mostra quantos faltam e quais.

**Dica:** baixe primeiro o Ctrl+E de todos os setores e depois faça a sequência
colar → conferir → confirmar. O trabalho fica bem mais rápido.

## Ao terminar a rotina

- Quando o último setor é confirmado, o app avisa **"Rotina completa"**.
- Os pacientes que sumiram de um setor e não apareceram em nenhum outro viram
  **alta presumida**.
- No painel **"Saídas a verificar e altas presumidas"**, confirme o desfecho de cada
  um: **Alta confirmada**, **Óbito**, **Transf. externa** ou **Segue internado** (se
  foi um engano, por exemplo um setor importado com o arquivo errado).

## Outros arquivos (seção a, tipos "arquivar")

Previsões de alta, documentos de ambulância e outros documentos que precisam ficar
registrados:
1. Escolha o **tipo**, anexe o arquivo, escreva uma observação e clique em
   **Registrar arquivo**.
2. Esses tipos ficam arquivados, com data e autor. A agenda de cateterismos e as
   metas têm importação própria: a primeira na guia Cateterismos, a segunda na
   seção b desta tela.

## Metas (seção b)

Anexe a planilha, cole as linhas no modelo padrão (Indicador, Competência, Meta,
Realizado) e grave. Os detalhes estão no POP de Metas, no fim deste documento.

---

## Situações especiais

| Situação | O que fazer |
|---|---|
| **Tasy fora do ar** | Registre a rotina assim que o Tasy voltar, escolhendo a **rotina e o dia** corretos nos campos. Anote o motivo na observação do primeiro setor |
| **Importou o setor errado** | Importe de novo o arquivo certo no setor certo: a nova importação atualiza a rotina. Depois corrija no painel de saídas os pacientes marcados por engano ("Segue internado") |
| **Setor sem pacientes** | Importe mesmo assim: o Ctrl+E vem só com o cabeçalho. A prévia avisa "Nenhum paciente" e você confirma |
| **"Não encontrei a linha de cabeçalho"** | Confira se copiou o arquivo inteiro (Ctrl+A). Se o Tasy mudou o nome da coluna de atendimento, avise o responsável pelo app para atualizar os sinônimos |
| **Paciente transferido entre rotinas** | Normal. Se ele sumiu de um setor e só apareceu no outro na rotina seguinte, aparece como "Retorno" ou "Transferência" e o histórico fica registrado |
| **Esqueceu uma rotina** | Registre depois, com a rotina e o dia corretos. A Principal mostra a rotina como "Incompleta" até lá |

## Por que isso importa

Cada rotina completa gera:
- o **retrato do hospital** naquele horário (ocupação e permanência por setor);
- as **movimentações** de pacientes (admissões, transferências e saídas);
- a base para os **indicadores diários** e as **metas**.

É esse histórico que hoje não existe nas planilhas e Forms.

---

# POPs das demais guias

Procedimentos curtos para o uso diário. Onde aparece ❓, o padrão foi assumido e
pode mudar ([07-pendencias.md](07-pendencias.md)).

## Gestão de Vagas (lembrete)

| Quem | Quando | O que fazer |
|---|---|---|
| Médico ou enfermeiro do setor | Ao decidir pela transferência | Escolher o paciente, o **setor de destino** e a **condição de transporte**, e clicar em **Solicitar vaga** |
| NIR | Ao assumir o caso | **Em análise** |
| NIR | Quando o leito é liberado | Informar o leito e clicar em **Leito cedido**. É aqui que o cronômetro do SLA para |
| NIR | Quando o paciente chega ao leito | **Transferência concluída**. A rotina também conclui sozinha quando o paciente aparece no censo do setor de destino |

## Passagem de Plantão do NIR

1. **Quem passa**, uns 15 minutos antes da troca:
   1. Abrir **Passagem de Plantão** e clicar em **Atualizar**.
   2. Revisar as 4 seções: PS com vaga, Recepção, Cateterismos e Transportes. Elas se
      montam sozinhas a partir das outras guias.
   3. Escrever as **observações** de cada seção e as **gerais**.
   4. Clicar em **Registrar passagem**.
2. **Quem assume**, logado com a própria conta:
   1. Ler a tela.
   2. Tirar dúvidas na hora.
   3. Clicar em **Recebi o plantão**.
3. Os turnos estão configurados em 07h–19h e 19h–07h ❓. O horizonte das seções é de
   24 h ❓.

## Previsão de Recepção (CROSS)

1. Ao **aceitar um caso no CROSS**:
   1. Clicar em **+ Novo paciente CROSS**.
   2. Preencher paciente, nº da ficha, **seção** (Ambulatorial ou Eletiva), origem,
      especialidade e **data/hora prevista**.
2. Se o paciente vai fazer **cateterismo**:
   1. No cartão dele, clicar em **Cateterismo?**.
   2. Escolher a data, a hora e o tipo (Externo Eletivo ou Externo Urgência
      Relativa).
   3. Clicar em **Agendar**.

   O exame entra sozinho na guia **Cateterismos**.
3. Quando o paciente **chega**, clicar em **Chegou**. Depois, registrar o desfecho:
   - **Internado**: com o nº de atendimento do Tasy. Se houver cateterismo, ele passa
     para "Internado".
   - **Retornou à origem**, depois da avaliação.
   - **Não veio**: cancela o cateterismo ligado.
   - **Cancelar**: também cancela o cateterismo ligado.
4. Olhar todo dia a aba **Atrasados**: pacientes cuja data prevista passou e que não
   chegaram.

## Cateterismos

1. **Primeira vez**:
   1. Clicar em **Importar planilha**.
   2. Colar a agenda atual do Excel (com o cabeçalho).
   3. Clicar em **Pré-visualizar** e conferir os tipos. Os tipos "(deduzido)" vieram do
      atendimento, porque a coluna Tipo estava vazia.
   4. Clicar em **Incluir na agenda**.

   Depois disso, a agenda passa a ser mantida no app ❓. Se a planilha continuar sendo
   usada fora, reimporte: as linhas repetidas são ignoradas.
2. **No dia**, para cada exame, registrar:
   - **Realizado**, escolhendo o **destino após o exame**;
   - **Remarcar**, com a nova data;
   - **Suspender** ou **Cancelar**.
3. Paciente internado que vai precisar de leito (UCO/UTI ou enfermaria): clicar em
   **Solicitar vaga**. A Gestão de Vagas abre já filtrada nele.
4. A aba **Internados aguardando** mostra quem está internado esperando o exame, que é
   um motivo comum de permanência longa.

## Ambulâncias

1. Ao marcar um transporte:
   1. Clicar em **+ Novo transporte** e escolher o paciente internado.
   2. Preencher tipo, motivo, destino, empresa e data/hora.
   3. Indicar se o paciente **deve retornar**.
2. Marcar o **checklist** conforme cada item fica pronto. O fluxo F4 avisa na véspera
   quando faltar algum item.
3. No dia, avançar as etapas com um clique: **solicitada → confirmada → chegou →
   paciente saiu**. Cada clique grava o horário.
4. Quem saiu e deve voltar fica no **Radar**. Quando ele voltar, clicar em **Paciente
   retornou**; se não for voltar, clicar em **Não retornará**.

## Gestão da Permanência (round dos pacientes com 15 dias ou mais)

1. Filtrar pelo setor do round.
2. Para cada paciente:
   1. Marcar a **especialidade** que tem pendência para a alta (Médico, Enfermagem,
      Serviço Social ou Fisioterapia).
   2. No **Kanban** da especialidade, incluir cada pendência como um **tópico**, com
      responsável e prazo.
   3. Avançar os tópicos entre **Planejado → Em andamento → Concluído**.
   4. Garantir que todo paciente tenha **previsão de alta**. Os que não têm aparecem
      em vermelho.
3. O painel de cima mostra o total por especialidade e os tópicos com **prazo
   vencido**.

## Previsões de Alta

1. Todo dia, ver as abas **Hoje**, **Amanhã** e **Vencidas**.
2. Para registrar ou mudar uma previsão: escolher a data e clicar em **Salvar
   previsão**. Cada mudança fica no **Histórico**.
3. A previsão registrada pela equipe tem prioridade sobre a que vier do Tasy.

## Metas (mensal)

1. Até o dia 5 de cada mês:
   1. Na **Rotina de Atualização, seção b**, anexar a planilha das metas de planilha
      (ex.: média de permanência, giro de leito, altas até 12h).
   2. Colar as linhas no modelo **Indicador · Competência · Meta · Realizado**.
   3. Clicar em **Pré-visualizar** e depois em **Gravar valores**.
2. As metas **automáticas** (tempo até a cessão, % no SLA, ocupação, pacientes com 15
   dias ou mais, cancelamentos) se atualizam sozinhas, todo dia, pelo fluxo F3.
3. Para mudar o valor da meta, o nome ou o sentido (maior ou menor é melhor), edite a
   lista **MetasIndicadores** (botão **Cadastro das metas**).
