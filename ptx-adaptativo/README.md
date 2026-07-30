# PTx Adaptativo

Assistente de elaboração de **Plano Terapêutico** para pacientes internados, voltado a médicos
assistentes e plantonistas de hospitais brasileiros. Gera sugestões de itens de plano com **metas
mensuráveis**, **critérios de alta** e **data provável de alta (DPA)** — e **aprende com o feedback
da equipe** para se adaptar à realidade e à logística do serviço.

> ⚠️ **Apoio à decisão:** as sugestões geradas são apoio à decisão clínica. A conduta final é
> sempre do médico assistente.

> ⚠️ **LGPD:** o app não solicita nem armazena identificadores do paciente (nome, registro,
> data de nascimento). Apenas o contexto clínico mínimo é persistido, com rotina automática de
> anonimização/expurgo.

## Fundamentação

As sugestões seguem os 8 componentes de um bom plano terapêutico hospitalar validados pela
literatura: objetivo claro da internação (“why is this patient here today?”), metas diárias
mensuráveis (daily goals de Pronovost), critérios de alta explícitos + DPA, planejamento de alta
desde o dia 1, multidisciplinaridade, individualização/proporcionalidade (incl. metas de
cuidado/paliação quando aplicável), registro claro e transmissível (estilo I-PASS) e
profilaxias/segurança (TEV, LPP, broncoaspiração, delirium).

## Funcionalidades

- **Entrada:** problemas ativos (múltiplos), evolução do dia, HPMA opcional, plano já elaborado
  opcional (→ o app aponta **lacunas** e complementa em vez de duplicar) e campos estruturados
  (dias de internação, setor, dispositivos, dieta, O₂).
- **Motor de sugestões:** API da Anthropic (modelo `claude-sonnet-4-6`) com saída JSON estruturada
  (`categoria`, `item`, `meta`, `justificativa`, `prioridade`) + critérios de alta + DPA. Parsing
  tolerante a falhas.
- **Aprendizado adaptativo:** feedback 👍 *Conforme* / 👎 *Não conforme* (com motivo) / ✏️ *aceito
  com modificação* por item, persistido com contexto clínico resumido, setor e timestamp.
  Score estilo Beta/Thompson por padrão de item + contexto. A cada geração, o prompt recebe um
  resumo do conhecimento do serviço: padrões bem aceitos (reforçar), rejeitados com motivos
  (evitar/adaptar) e regras explícitas aprovadas pelo administrador.
- **Painel:** conformidade global e por categoria, evolução semanal da assertividade, itens mais
  aceitos/rejeitados e principais motivos de rejeição.
- **Regras aprendidas (admin):** cadastro manual e “promoção” de padrões de rejeição a regra
  explícita (ex.: “não sugerir X; o serviço usa Y”).
- **Saída:** sugestões agrupadas por categoria com metas em destaque; botão para copiar o plano
  final (itens aceitos + editados) em texto formatado para o prontuário.
- **Seed inicial** por síndrome (pneumonia, ICC, DPOC, ITU/sepse, AVC, pós-operatório, etc.) —
  o app já nasce útil antes de acumular feedback.

## Stack

- **Frontend:** React 18 (Vite) + Tailwind CSS — responsivo (desktop e celular).
- **Backend:** Node.js + Express — todas as chamadas ao modelo passam pelo servidor;
  a chave da API **nunca** chega ao cliente.
- **Banco:** SQLite (better-sqlite3) com camada de acesso isolada em `server/src/db.js`
  (migrar para PostgreSQL = reimplementar apenas esse módulo).
- **Autenticação:** local (e-mail/senha com bcrypt + sessão em cookie httpOnly).
  O primeiro usuário cadastrado torna-se administrador.
- **Testes:** Vitest (parsing tolerante do JSON da IA, gravação de feedback, cálculo de scores,
  montagem do prompt e expurgo LGPD).

## Instalação

Requisitos: Node.js 18+ (recomendado 20/22).

```bash
cd ptx-adaptativo

# backend
cd server
npm install
cp .env.example .env        # configure ANTHROPIC_API_KEY
npm run dev                 # http://localhost:3001

# frontend (em outro terminal)
cd ../client
npm install
npm run dev                 # http://localhost:5173 (proxy /api -> 3001)
```

### Configuração da chave da API

No arquivo `server/.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

A chave é lida apenas pelo backend. Variáveis opcionais:

| Variável        | Padrão              | Descrição                                   |
|-----------------|---------------------|---------------------------------------------|
| `PORT`          | `3001`              | Porta do backend                            |
| `DATABASE_PATH` | `server/data/ptx.db`| Caminho do SQLite                           |
| `PURGE_DAYS`    | `90`                | Idade (dias) para expurgo do texto clínico  |
| `PTX_MODEL`     | `claude-sonnet-4-6` | Modelo da Anthropic                         |

### Produção (um único processo)

```bash
cd client && npm run build     # gera client/dist
cd ../server && npm start      # Express serve API + frontend compilado
```

## Testes

```bash
cd server
npm test
```

## Primeiro acesso

1. Abra o app e **cadastre-se** — o primeiro usuário vira administrador.
2. Na aba **Plano**, informe problemas ativos + evolução do dia e gere as sugestões.
3. Avalie cada item (👍/👎/editar) — o feedback alimenta o aprendizado imediatamente.
4. Acompanhe a evolução na aba **Painel**; gerencie regras e expurgo na aba **Regras** (admin).
