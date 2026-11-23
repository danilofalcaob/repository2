# Censos fictícios para teste

Arquivos em **texto separado por tabulação**, no mesmo formato que o Excel entrega
quando você copia uma planilha (Ctrl+A, Ctrl+C). Os dados são **inventados**.

Para testar: abra o arquivo no Excel (ou no Bloco de Notas), copie tudo e cole na
caixa da Rotina de Atualização.

| Arquivo | Setor no app | Rotina | O que testa |
|---|---|---|---|
| `manha-PS_GERAL.tsv` | PS Geral | Manhã | 6 pacientes novos; linha de título antes do cabeçalho e linha de total no fim (devem ser ignoradas) |
| `manha-UTI.tsv` | UTI | Manhã | 5 pacientes, 2 com 15 dias ou mais de internação em 23/11/2026 |
| `manha-UI6_P1.tsv` | UI 6º andar – Posto 1 | Manhã | 6 pacientes |
| `tarde-UI6_P1.tsv` | UI 6º andar – Posto 1 | Tarde | 1 transferência (atend. 900102 veio do PS Geral), 1 troca de leito (900302: 602 → 607), 1 saída (900303 não aparece mais) |

O resultado esperado de cada passo está no roteiro de aceite de
[`../docs/02-guia-montagem-app.md`](../docs/02-guia-montagem-app.md). O mesmo
cenário é conferido automaticamente pelo teste `nir/ferramentas/testar-importacao.mjs`.
