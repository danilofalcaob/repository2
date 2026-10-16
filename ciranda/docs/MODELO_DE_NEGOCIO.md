# Ciranda — modelo de negócio

> Nome provisório. Este documento descreve a lógica do produto, as regras
> financeiras implementadas no protótipo e os pontos que precisam de validação
> (jurídica, contábil e de mercado) antes de operar com clientes reais.

## 1. O problema

Quem troca de carro hoje costuma fazer duas operações ruins em sequência:

1. **vende** o carro para uma loja de seminovos com um deságio grande — a loja
   precisa cobrir capital parado, preparação, IPVA/estoque, risco e margem;
2. **compra** o próximo carro pelo preço de vitrine.

Para a loja, a "troca com troco" é o melhor negócio possível: ela ganha na
compra (deságio) e na venda (margem). Para o cliente, é onde mais se perde
dinheiro.

## 2. A ideia: troca em roda

Se quatro pessoas se cadastram dizendo o que têm e o que querem…

| Pessoa    | Tem               | Quer              |
|-----------|-------------------|-------------------|
| João      | Audi A3 branco    | Jeep Compass azul |
| Maria     | Jeep Compass azul | VW Nivus cinza    |
| Pedro     | BMW X1 prata      | Audi A3 branco    |
| Guilherme | VW Nivus cinza    | BMW X1 prata      |

…nenhum par troca diretamente, mas **a roda fecha**:
João ← Maria ← Guilherme ← Pedro ← João. Cada um recebe o carro que quer e
paga (ou recebe) só a diferença. Uma loja parceira valida tudo e formaliza as
quatro vendas de uma vez.

Esse é exatamente o problema das **trocas cruzadas de rim** (*kidney
exchange*): encontrar, num grafo de "quem aceita o quê", o conjunto de ciclos
disjuntos que atende o maior número de pessoas. É um problema bem estudado — o
que dá base técnica sólida para o produto.

## 3. Os três lados

| Lado | O que ganha | O que faz |
|------|-------------|-----------|
| **Cliente** | Vende pelo valor de mercado validado, compra o carro que escolheu, paga só a diferença + taxas | Cadastra o carro, até 3 opções do que quer e o troco máximo; aceita a proposta; leva o carro à vistoria; confirma os valores finais |
| **Loja parceira** | Taxa de serviço por carro (configurável por loja, padrão 3%), **sem imobilizar capital nem ter risco de estoque** | Assume a ciranda, faz vistoria e laudo cautelar, checa documentação e gravame, valida o valor, atende os clientes, recebe e paga os trocos, formaliza as transferências |
| **Plataforma** | **5% do valor bruto de cada carro negociado**, só quando a ciranda é concluída | Motor de casamento, aquisição de clientes, rede de lojas, regras, auditoria |

## 4. Regras financeiras (como o app calcula)

Implementadas em [`src/lib/liquidacao.ts`](../src/lib/liquidacao.ts):

- **Diferença (troco)** = valor do carro recebido − valor do carro entregue.
- **Quem entrega um carro paga as taxas sobre ele**, como numa venda
  consignada: 5% da plataforma + a taxa da loja. Quem só compra não paga taxa.
- **Saldo** = diferença + taxas. Positivo: o cliente paga à loja. Negativo: a
  loja paga ao cliente.
- A loja concentra o caixa: recebe os saldos positivos, paga os negativos, fica
  com a taxa dela e repassa os 5%. **A soma dos saldos é sempre exatamente a
  receita da plataforma + a da loja** (há teste automatizado para isso).
- Até a vistoria, vale o preço pedido pelo dono. Depois, vale o valor validado
  pela loja — e todos confirmam de novo antes de fechar.

### O exemplo em números

Valores ilustrativos; taxa da loja 3%. Na coluna "Loja tradicional", a
premissa é que a loja paga 15% abaixo do valor de mercado e vende pelo valor de
mercado — **ajuste esse número com dados reais da sua praça**.

| Pessoa | Entrega | Recebe | Troco | Taxas (8%) | Na Ciranda | Loja tradicional | Economia |
|--------|---------|--------|------:|-----------:|-----------:|-----------------:|---------:|
| João | Audi A3 branco (R$ 152.000) | Jeep Compass azul (R$ 139.000) | −13.000 | 12.160 | recebe R$ 840 | paga R$ 9.800 | R$ 10.640 |
| Maria | Jeep Compass azul (R$ 139.000) | VW Nivus cinza (R$ 124.000) | −15.000 | 11.120 | recebe R$ 3.880 | paga R$ 5.850 | R$ 9.730 |
| Guilherme | VW Nivus cinza (R$ 124.000) | BMW X1 prata (R$ 168.000) | +44.000 | 9.920 | paga R$ 53.920 | paga R$ 62.600 | R$ 8.680 |
| Pedro | BMW X1 prata (R$ 168.000) | Audi A3 branco (R$ 152.000) | −16.000 | 13.440 | recebe R$ 2.560 | paga R$ 9.200 | R$ 11.760 |

- Valor bruto dos carros: **R$ 583.000**
- Receita da plataforma (5%): **R$ 29.150**
- Receita da loja (3%): **R$ 17.490**, sem comprar nenhum carro
- Economia somada dos quatro clientes: **R$ 40.810**

### A conta que decide o negócio

Para cada cliente, a economia é aproximadamente
**deságio da loja tradicional − (5% + taxa da loja)**. Com 5% + 3% = 8%:

- deságio de 15% → o cliente economiza ~7% do valor do carro: proposta forte;
- deságio de 10% → economiza ~2%: proposta fraca diante do trabalho de esperar
  a roda fechar;
- carros de altíssima liquidez (deságio baixo) quase não ganham nada.

**Recomendação:** antes de fixar os 5%, levante o deságio real praticado na
cidade de lançamento por faixa de preço e modelo. Alternativas a testar, se o
deságio for menor que o esperado: percentual decrescente por faixa de valor,
teto em reais por carro, ou cobrar a comissão só do lado que "sobe" de carro.
No código, a regra está concentrada em `calcularLiquidacao`.

## 5. Por que a loja aceitaria (e o risco de canibalização)

O ponto sensível: na troca tradicional a loja ganha o deságio inteiro; na
Ciranda, ganha só a taxa de serviço. Argumentos para a loja:

- **zero capital imobilizado** e zero risco de estoque (o carro nunca é dela);
- **volume**: uma ciranda de 4 carros rende ~R$ 17 mil em poucos dias de
  trabalho, sem preparação nem anúncio;
- **cliente na porta**: financiamento, seguro, garantia, estética e
  despachante continuam sendo receitas da loja;
- **o estoque da própria loja pode entrar na roda** — o app já suporta
  participantes "só vende" e "só compra": a loja cadastra carros do pátio como
  vendas e pode comprar um carro para fechar uma cadeia incompleta. Isso
  transforma a loja de concorrente em aliada e aumenta muito a liquidez.

## 6. Liquidez: o que faz a roda fechar

Um teste do motor com cadastros aleatórios (3 opções por pessoa, uma cidade)
atendeu **57% com 60 cadastros, 78% com 200 e 85% com 500**. O número exato
depende das preferências reais, mas a tendência é clara: **a densidade por
cidade é o principal ativo do negócio**. Alavancas:

1. lançar em **uma cidade só** e concentrar marketing lá;
2. incentivar desejos flexíveis (até 3 opções, várias cores, ano/km com folga);
3. trazer o **estoque das lojas** como participantes;
4. permitir **só comprar** e **só vender** (já implementado) — compradores e
   vendedores puros fecham cadeias que não seriam ciclos;
5. sugerir ajustes que fechariam uma roda ("se você aceitar um Compass prata,
   fechamos agora") — próxima funcionalidade natural do motor.

## 7. Riscos e como o protótipo já trata

| Risco | Tratamento no app | O que falta |
|-------|-------------------|-------------|
| Um elo desiste e derruba todos ("tudo ou nada") | Preferência por rodas curtas; prazo de 48h; quem não responde é pausado; quem recusa não recebe o mesmo carro de novo; os demais voltam à fila e o motor tenta de novo na hora | Sinal/caução no aceite; reputação do participante |
| Carro com problema (sinistro, leilão, adulteração, débitos, gravame) | Vistoria obrigatória com checklist: documento e débitos, gravame, laudo cautelar, estado geral; reprovação pausa o cadastro do dono | Anexar laudo e fotos; vistoria prévia opcional ("selo") |
| Valor declarado irreal | Valor da loja substitui o declarado; confirmação final de todos com os valores validados | Integração com a tabela FIPE para sugerir e alertar |
| Dinheiro trocando de mãos fora de ordem | Liquidação centralizada na loja, com registro de cada acerto e transferência antes de concluir | Conta de garantia (escrow) ou split de pagamento via intermediador; fechamento simultâneo no mesmo dia |
| Carro financiado | Item "gravame" no checklist | Fluxo de quitação com o banco usando o próprio saldo da ciranda |
| Privacidade (LGPD) | Entre participantes, só primeiro nome e dados do carro; contato e placa só para a loja que conduz; consentimento no cadastro | Política de privacidade, termos de uso, retenção de dados |

## 8. Pontos a validar com advogado e contador

- **Estrutura jurídica de cada venda**: a loja compra e revende (com nota de
  entrada e saída) ou atua como intermediária com transferência direta entre
  os donos? Isso muda tributação, responsabilidade e o contrato com o cliente.
- **Natureza da comissão da plataforma** (intermediação/serviço) e como é
  faturada: plataforma → loja, ou plataforma → cliente.
- **Responsabilidade por vícios ocultos** (Código de Defesa do Consumidor)
  entre plataforma, loja e particulares.
- **Contrato padrão loja–plataforma**: exclusividade por ciranda, prazos, SLA
  de vistoria, repasse dos 5%, auditoria.
- **Transferência no DETRAN** (ATPV-e) e comunicação de venda para cada carro.

## 9. Próximos passos sugeridos

1. Entrevistar 5–10 lojas da cidade-piloto: aceitam a taxa de serviço? Querem
   colocar o estoque na roda?
2. Levantar o deságio real por faixa de preço para calibrar a comissão.
3. Piloto controlado: uma loja, uma cidade, lista de espera de clientes.
4. Notificações por WhatsApp (hoje o aviso é só dentro do app).
5. Sinal no aceite + conta de garantia para a liquidação.
6. Integração FIPE, fotos e laudo anexado.
7. Motor em lote periódico (por exemplo, a cada hora) com solver de
   programação inteira quando o volume crescer — rodar a cada cadastro é ótimo
   para a demonstração, mas lotes encontram combinações globais melhores.
