# 04 · POP — Rotina de Atualização do NIR

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
2. Nesta fase eles ficam só arquivados, com data e autor. A leitura automática vem
   nas próximas fases.

## Metas (seção b)

Planilhas de metas e indicadores institucionais: anexe e clique em **Registrar
arquivo de metas**. Na fase 4 haverá um modelo padrão que o app lê sozinho.

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
