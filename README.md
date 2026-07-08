# Passagem de Plantão Médico (I-PASS)

Aplicativo web **full-stack** para **passagem de plantão médico** (handoff/sign-out),
em **português do Brasil**, **mobile-first** e usável em desktop. Estrutura a
passagem no formato **I-PASS** (padrão internacional baseado em evidência),
captura e analisa dados para auditoria/gestão e fecha o ciclo entre passagem e
deterioração clínica (Time de Resposta Rápida — TRR).

> ⚠️ **Aviso importante (LGPD/CFM):** este projeto usa **apenas dados fictícios**
> de demonstração. **Não insira dados reais de pacientes** sem hospedagem
> adequada, criptografia, revisão de segurança e aprovação institucional/LGPD,
> além de atenção às normas do CFM sobre registros e assinatura.

---

## Stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Tailwind CSS** (tema claro/escuro — modo noturno para plantões)
- **Prisma ORM** + **SQLite** (desenvolvimento/demo) — pronto para **PostgreSQL** em produção
- Autenticação própria: **e-mail/senha** com **bcrypt** (hash forte) + sessões em banco com cookie `httpOnly` assinado (HMAC)
- **Recharts** (gráficos do painel) · **SheetJS/xlsx** (exportação Excel)
- **Vitest** (testes das regras críticas)
- Captura por voz e **escuta contínua com roteamento por seção** via
  **Web Speech API** (pt-BR, nativa do navegador; Chrome/Edge)

---

## Pré-requisitos

- **Node.js 18+** (recomendado 20/22) e **npm**.
- Nada além disso para a demo (SQLite é embutido — sem servidor de banco).

---

## Instalação e execução (demo local)

```bash
# 1. Instalar dependências
npm install

# 2. Variáveis de ambiente
cp .env.example .env
#   (o .env padrão já aponta para SQLite: DATABASE_URL="file:./dev.db")
#   Defina um SESSION_SECRET forte.

# 3. Preparar banco + gerar client + popular dados de demonstração
npm run setup      # = prisma generate + db push + seed

# 4. Rodar em desenvolvimento
npm run dev
# abra http://localhost:3000
```

Para produção local:

```bash
npm run build
npm run start
```

### Usuários de demonstração

Senha para todos: **`demo123`**

| E-mail            | Perfil        | O que acessa                                  |
|-------------------|---------------|-----------------------------------------------|
| `admin@demo.com`  | Administrador | Tudo + configuração de setores/turnos/usuários |
| `coord@demo.com`  | Coordenador   | Histórico, auditoria, indicadores e exportação |
| `bruno@demo.com`  | Plantonista   | Quadro, passagens, pacientes, TRR              |
| `daniela@demo.com`| Plantonista   | Idem (use para simular quem **recebe**)        |

> Dica: para testar o **read-back**, inicie uma passagem com um usuário (quem
> passa) e faça login com o receptor escolhido para reconhecer pacientes e
> contingências.

---

## Scripts úteis

| Script            | Descrição                                            |
|-------------------|------------------------------------------------------|
| `npm run dev`     | Servidor de desenvolvimento                          |
| `npm run build`   | Build de produção (gera o Prisma Client)             |
| `npm run start`   | Servidor de produção                                 |
| `npm run setup`   | `prisma generate` + `db push` + `seed`               |
| `npm run db:seed` | (Re)popula dados de demonstração                     |
| `npm run db:reset`| Recria o banco do zero e popula                      |
| `npm test`        | Testes (Vitest) das regras críticas                  |

---

## Funcionalidades

### Passagem estruturada I-PASS
- **I** – Gravidade (estável / cuidado / instável) com código de cores.
- **P** – Resumo do paciente.
- **A** – Pendências/ações com responsável, prazo, prioridade e **herança entre turnos**.
- **S** – Consciência situacional e **contingências estruturadas** (parâmetro + limiar → ação).
- **S** – **Síntese do receptor** (read-back) + campo de **nível de preocupação / intuição clínica**.

### Quadro de passagem (tela inicial)
- Lista de pacientes **ordenada por prioridade clínica** (gravidade → preocupação → contingências → pendências vencidas).
- Resumo por paciente: leito, gravidade (cor), preocupação, pendências abertas/vencidas, contingências ativas.
- Filtro por setor e busca por paciente/leito/diagnóstico.

### Passagem "viva" e segurança
- **"O que mudou desde a última passagem"** (resumo automático + anotação).
- **Contingências** como item de primeira classe, em destaque, com **read-back obrigatório** e **lembrete agendável**; botão **"o gatilho ocorreu"**.
- **Conclusão** só é permitida com read-back dos pacientes **instáveis** e das **contingências ativas**.
- **Captura por voz** (pt-BR) em todos os campos de texto.
- **Escuta contínua da passagem com roteamento**: em cada paciente, o botão
  **🎧 Escutar a passagem** transcreve a fala em tempo real e **direciona cada
  trecho para a seção pertinente** do I-PASS. O destino muda por **comando de
  voz** — dizer *“resumo”*, *“o que me preocupa”*, *“o que mudou”* ou *“síntese”*
  antes de falar — ou tocando na seção-alvo (útil no celular). Um mesmo trecho de
  fala pode conter várias seções: a frase é fatiada nos comandos reconhecidos e
  cada pedaço vai para o seu campo. Transcrição interina exibida ao vivo.
- **Resiliência a conexão instável**: rascunho salvo em `localStorage` e restaurado.

### Histórico e auditoria (append-only)
- Cada passagem é gravada de forma **imutável**, com **snapshot congelado** de cada paciente.
- Edições pós-conclusão geram **nova versão** (nada é sobrescrito) — defensibilidade médico-legal.
- Filtros por período, setor, médico e paciente + busca textual.
- **Linha do tempo por paciente** (a "história" atravessando turnos).
- **Trilha de acesso/auditoria** (quem fez o quê e quem exportou).

### Indicadores de gestão
- Passagens por período/setor, média de pacientes, duração média.
- **Completude do I-PASS**, **taxa de read-back**, pendências (criadas/concluídas/vencidas, herança, tempo médio), contingências por status.
- **TRR**: acionamentos e quantos tinham contingência/preocupação registrada na passagem anterior.
- Gráficos (linha/barra/pizza).
- **Exportação** em **CSV, Excel (.xlsx) e JSON**, com **anonimização** opcional.

### TRR / deterioração
- Registro de acionamento vinculado ao paciente, exibindo o **contexto da última passagem**.
- Cruzamentos automáticos (tinha contingência? tinha preocupação?).

### Acesso e perfis
- **plantonista**, **coordenador**, **admin** — controle por perfil e por setor.

---

## Modelo de dados

Definido em [`prisma/schema.prisma`](prisma/schema.prisma). Entidades principais:
`Usuario`, `Setor`, `Turno`, `Paciente`, `PassagemEvento`, `SnapshotPaciente`
(+ `SnapshotVersao` para versionamento append-only), `Pendencia`, `Contingencia`,
`Reconhecimento`, `EventoTRR` e `LogAuditoria`.

### Migrar para PostgreSQL (produção)
1. Em `prisma/schema.prisma`, troque `provider = "sqlite"` por `provider = "postgresql"`.
2. Ajuste `DATABASE_URL` no `.env` (veja `.env.example`).
3. Rode `npx prisma migrate deploy` (ou `prisma db push`).

Os "enums" são representados como `String` validada na aplicação
([`src/lib/constants.ts`](src/lib/constants.ts)) para manter compatibilidade
entre SQLite e PostgreSQL.

---

## Deploy

Para publicar (Docker em servidor próprio ou Vercel + PostgreSQL com URL pública),
veja o guia dedicado: **[DEPLOY.md](DEPLOY.md)**.

## Docker

```bash
# Build da imagem
docker build -t passagem-plantao .

# Executar (SQLite em volume persistente)
docker run -p 3000:3000 \
  -e SESSION_SECRET="troque-por-um-segredo-forte" \
  -v passagem_dados:/app/prisma \
  passagem-plantao
```

Ou com **docker compose**:

```bash
docker compose up --build
```

---

## Segurança e conformidade (LGPD) — implementado por padrão

- Senhas com **bcrypt** (custo 12); sessões com cookie `httpOnly`, `sameSite=lax`,
  `secure` em produção e **token assinado por HMAC**.
- **Controle de acesso** por perfil e por setor em todas as rotas e ações.
- **Nenhum dado pessoal em query string** das telas (identificadores ficam no corpo/rota por id).
- **Trilha de auditoria** append-only de ações, acessos e exportações.
- **Anonimização** na exportação e estrutura pronta para política de retenção.
- **Em produção:** sirva sob **HTTPS** e considere criptografia em repouso.

> A automação de disparo de contingência a partir de **sinal vital ao vivo**
> depende de integração com monitor/PEP (**fora do escopo**). O app implementa a
> versão **manual/estruturada**, com a arquitetura preparada para essa automação.

---

## Testes

```bash
npm test
```

Cobrem regras críticas: **conclusão de passagem**, **imutabilidade e
versionamento append-only** do histórico, **herança de pendências**, **hash de
senha** e a lógica de **"o que mudou"** e ordenação por prioridade.

---

## Estrutura do projeto

```
prisma/            schema + seed (dados fictícios)
src/
  app/
    login/                       tela de login
    (app)/                       área autenticada (layout + navegação)
      quadro/                    quadro de passagem (tela inicial)
      pacientes/                 lista + ficha (I-PASS, pendências, contingências, timeline)
      passagem/                  iniciar e editar passagem (read-back, voz, conclusão)
      historico/                 histórico imutável, visualização e auditoria
      indicadores/               painel de gestão + exportação
      trr/                       Time de Resposta Rápida
      admin/                     setores, turnos, usuários
    api/                         auth (login/logout) e exportação
  components/                    NavBar, badges, tema, voz
  lib/                           db, auth, auditoria, queries, métricas, formatação, constantes
tests/                           Vitest
```
