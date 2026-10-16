# Ciranda — troca de carros em roda

Aplicativo web (protótipo funcional, em português, mobile-first) em que pessoas
que querem **trocar, vender ou comprar** carro se cadastram, um **motor de
casamento** encontra as rodas de troca em que cada um recebe o carro que quer, e
uma **loja de seminovos parceira** valida e formaliza todas as vendas de uma
vez. A plataforma fica com **5% do valor bruto** dos carros negociados.

> Exemplo que originou o app: João tem um Audi A3 e quer um Compass; Maria tem
> o Compass e quer um Nivus; Guilherme tem o Nivus e quer uma X1; Pedro tem a X1
> e quer o A3. Nenhum par troca diretamente — mas a roda fecha com os quatro.

📄 **Modelo de negócio, números do exemplo e riscos:** [docs/MODELO_DE_NEGOCIO.md](docs/MODELO_DE_NEGOCIO.md)

⚠️ Protótipo com **dados fictícios**. Valores de carros e taxas são
ilustrativos. Antes de operar com clientes reais, veja a seção 8 do modelo de
negócio (validação jurídica e contábil).

---

## Como rodar

Pré-requisito: **Node.js 18+** (recomendado 20 ou 22).

```bash
cd ciranda
npm install
npm run dev
# abra http://localhost:3000
```

Na primeira vez, o `npm run dev` cria o `.env`, o banco SQLite e os dados de
demonstração sozinho. Nas seguintes, preserva o que foi registrado.

| Script | O que faz |
|--------|-----------|
| `npm run dev` | Servidor de desenvolvimento (prepara o ambiente antes) |
| `npm run setup` | Só prepara o ambiente (`.env`, tabelas, demo se o banco estiver vazio) |
| `npm run db:reset` | **Apaga tudo** e recria a demonstração |
| `npm test` | Testes do motor de casamento, da liquidação e do fluxo |
| `npm run build` / `npm start` | Produção |

## Usuários de demonstração

Senha de todos: **`demo123`**

| E-mail | Quem é | O que mostrar |
|--------|--------|---------------|
| `joao@`, `maria@`, `pedro@`, `guilherme@demo.com` | O exemplo original | Ciranda **CR-7JMP** aguardando aceites (João e Maria já aceitaram) |
| `ana@`, `bruno@`, `carla@demo.com` | Roda de 3 | Ciranda **CR-3ABC** em vistoria na Prime (carro da Ana já aprovado, com valor ajustado) |
| `loja@demo.com` | Prime Seminovos (SP, taxa 3%) | Painel da loja, vistoria, liquidação |
| `loja2@demo.com` | Auto Vale Seminovos (SP, taxa 2,5%) | Outra loja da mesma cidade |
| `admin@demo.com` | A plataforma (sua empresa) | Receita de 5%, funil, fila de casamento, lojas |

Também há cirandas concluídas (Diego/Elisa; Felipe/Gabriela/Henrique — com
venda e compra puras), uma cancelada (Mariana recusou) e uma fila de espera.

## Roteiro de demonstração (10 minutos)

1. **A roda do exemplo** — entre como `pedro@demo.com`, abra a ciranda
   CR-7JMP e aceite. Faça o mesmo com `guilherme@demo.com`: com todos os
   aceites, ela vai para as lojas.
2. **A loja conduz** — entre como `loja@demo.com`, assuma a CR-7JMP (agora os
   contatos aparecem), aprove os quatro carros no checklist (mude o valor de um
   deles para ver o ajuste) → todos confirmam os valores finais (entre com cada
   um) → a loja marca acertos e transferências → **Concluir**.
3. **O elo que falta** — Rafael (Corolla Cross, quer Compass) e Sabrina
   (Compass, quer T-Cross) estão na fila sem fechar. Crie uma conta nova em
   São Paulo e cadastre: **VW T-Cross 2023, R$ 140.000**, querendo **Toyota
   Corolla Cross**, aceitando pagar até **R$ 20.000** de diferença. A ciranda de
   três fecha **na hora** e você cai direto nela.
4. **A plataforma** — entre como `admin@demo.com`: receita realizada (5%),
   receita em andamento, funil de cirandas e a fila de quem ainda espera.

## O que cada perfil faz

**Cliente**
- Cadastro em 3 modalidades: **trocar** (tem e quer), **só vender**, **só comprar**.
- Até **3 opções** de carro desejado, em ordem de preferência, com marca,
  modelo (ou qualquer um da marca), cores aceitas, ano mínimo, km máximo e câmbio.
- Troco máximo que aceita pagar (ou orçamento, para quem só compra).
- Vê a roda desenhada, o carro que recebe, e o **acerto detalhado**: diferença,
  comissão da plataforma, taxa da loja e quanto paga ou recebe.
- Aceita/recusa a proposta e confirma os valores finais após a vistoria.
- Pausa, reativa, cancela ou ajusta preço/troco de um cadastro (ajustar
  costuma destravar novas rodas).

**Loja parceira**
- Vê as cirandas da sua cidade em que todos aceitaram, com a receita estimada,
  e **assume** (a primeira que assumir fica com ela).
- Só depois de assumir vê nome completo, telefone, e-mail e placa.
- **Vistoria** de cada carro: documento/débitos, gravame, laudo cautelar,
  estado geral e **valor validado**. Reprovar exige justificativa.
- **Liquidação**: para cada cliente, quanto cobrar ou pagar; marca acertos e
  transferências (ATPV-e) e conclui.

**Plataforma (admin)**
- Receita realizada e em andamento, valor bruto, conversão, funil por etapa.
- Fila de casamento e botão para rodar o motor manualmente.
- Cadastro de lojas (com o acesso do responsável), ativação e taxa de serviço.

## Ciclo de vida de uma ciranda

```
proposta ──todos aceitam──▶ aguardando_loja ──loja assume──▶ em_avaliacao
em_avaliacao ──todos os carros aprovados──▶ confirmacao_final
confirmacao_final ──todos confirmam──▶ em_liquidacao ──tudo pago e transferido──▶ concluida

qualquer recusa, reprovação, prazo vencido ou cancelamento ──▶ cancelada
```

É **tudo ou nada**: se um elo cai, a ciranda é cancelada e os demais voltam
para a fila — e o motor roda de novo na hora, buscando outra combinação.
Regras de proteção:

- prazo de **48h** para aceite e para a confirmação final; quem não responde é
  **pausado** (para não travar novas rodas). Os prazos são conferidos sempre que
  alguém abre um painel ou uma ciranda — em produção, vale somar um agendador;
- quem recusa uma proposta **não recebe o mesmo carro** de novo;
- carro reprovado na vistoria pausa o cadastro do dono, com o motivo;
- as taxas ficam **congeladas** na ciranda (a da loja, no momento em que ela assume).

## O motor de casamento

Código: [`src/lib/casamento.ts`](src/lib/casamento.ts) (lógica pura, sem
banco, com testes em [`tests/casamento.test.ts`](tests/casamento.test.ts)).

1. **Grafo**: cada cadastro ativo é um nó; a aresta *i → j* existe se o carro
   de *j* atende a um dos desejos de *i*, na mesma cidade, e a diferença de
   valor cabe no troco máximo de *i*. Quem só vende "recebe" de quem só compra
   (aresta de dinheiro), o que transforma cadeias comprador → … → vendedor em
   ciclos (no máximo uma aresta de dinheiro por ciclo).
2. **Ciclos candidatos**: enumera os ciclos simples de até **6 participantes**,
   por tamanho crescente e com cota por participante (num pool grande, ninguém
   fica sem candidatos).
3. **Escolha**: conjunto de ciclos **disjuntos** de maior pontuação — solução
   gulosa como ponto de partida, melhorada por busca exata (*branch and bound*)
   com orçamento de passos.

**Pontuação** de um ciclo: cada pessoa atendida vale 1000, menos 50 por
posição de preferência abaixo da 1ª opção; penalidade de 10·k² pelo tamanho
(duas trocas de 2 são mais seguras que uma roda de 4 com as mesmas pessoas) e
1 ponto por R$ 10 mil de troco movimentado. Atender uma pessoa a mais sempre
vale mais que as penalidades.

O motor roda a cada novo cadastro, reativação ou ajuste de valores, a cada
ciranda cancelada e pelo botão do admin. Numa máquina comum, 500 cadastros
ativos na mesma cidade são processados em cerca de 1 segundo.

## Estrutura

```
ciranda/
├── prisma/schema.prisma        # Usuário, Loja, Veículo, Intenção, Desejo, Bloqueio, Ciranda, Elo, Evento
├── prisma/seed.ts              # demonstração (cada cenário passa pelo motor real)
├── src/lib/casamento.ts        # motor de casamento (puro)
├── src/lib/liquidacao.ts       # regras financeiras (puras)
├── src/lib/fluxo.ts            # máquina de estados (pura)
├── src/lib/motor.ts            # motor + banco: forma, cancela e expira cirandas
├── src/app/(app)/painel        # cliente
├── src/app/(app)/intencoes     # cadastro de carro/desejos
├── src/app/(app)/cirandas      # página e ações da ciranda (todos os perfis)
├── src/app/(app)/loja          # loja parceira
├── src/app/(app)/admin         # plataforma
└── tests/                      # Vitest
```

Stack: Next.js 14 (App Router, server actions) · React 18 · TypeScript ·
Tailwind (tema claro/escuro) · Prisma + SQLite (pronto para PostgreSQL) ·
autenticação própria (bcrypt + sessão em cookie `httpOnly` assinado) · Vitest.

## Deploy

**Docker** (servidor próprio, SQLite em volume persistente):

```bash
cd ciranda
SESSION_SECRET="um-segredo-forte-com-32-caracteres" docker compose up --build -d
```

**Vercel + PostgreSQL**: crie um Postgres gerenciado (Neon, Supabase, Vercel
Postgres), troque `provider = "sqlite"` por `"postgresql"` em
`prisma/schema.prisma`, importe o repositório na Vercel com **Root Directory =
`ciranda`**, defina `DATABASE_URL` e `SESSION_SECRET`, e use como comando de
build `prisma generate && prisma db push && next build`. Rode o seed uma vez
(`npm run db:seed` apontando para o banco) se quiser a demonstração.

## Limitações conhecidas do protótipo

- Avisos só dentro do app (sem WhatsApp/e-mail ainda).
- Sem fotos, laudo anexado ou integração com a tabela FIPE.
- O dinheiro é registrado, não movimentado: falta integrar conta de garantia
  ou split de pagamento.
- Cidade é texto livre (normalizado: "Sao Paulo" = "São Paulo").
