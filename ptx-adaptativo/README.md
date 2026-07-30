# PTx Adaptativo

Assistente de elaboração de **Plano Terapêutico** para pacientes internados, voltado a médicos assistentes e plantonistas de hospitais brasileiros. Gera sugestões de itens de plano com **metas mensuráveis**, **critérios de alta** e **data provável de alta (DPA)**, e **aprende progressivamente com o feedback da equipe** (👍/👎/editado) para se adaptar à realidade e à logística do serviço.

> ⚕️ As sugestões são **apoio à decisão**. A conduta final é sempre do médico assistente.

## Fundamentação clínica

O motor de sugestões é instruído a cobrir os 8 componentes de um bom plano terapêutico hospitalar validados pela literatura:

1. Objetivo claro da internação ("why is this patient here today?")
2. Metas diárias explícitas e mensuráveis (*daily goals* de Pronovost)
3. Critérios de alta explícitos e DPA revisada diariamente
4. Planejamento de alta desde o dia 1
5. Multidisciplinaridade (fisioterapia, nutrição, farmácia clínica, enfermagem, serviço social)
6. Individualização e proporcionalidade (metas de cuidado / cuidados paliativos quando aplicável)
7. Registro claro e transmissível (estilo I-PASS) — saída pronta para colar no prontuário
8. Profilaxias e segurança (TEV, LPP, broncoaspiração, delirium)

Se o médico colar um **plano já elaborado**, o app analisa lacunas contra esses 8 componentes e sugere **complementos**, em vez de gerar do zero.

## Arquitetura

```
ptx-adaptativo/
├── backend/                 # Node.js 22+ (Express, ESM)
│   ├── src/
│   │   ├── server.js        # entrada: seed idempotente, expurgo LGPD agendado, serve o frontend buildado
│   │   ├── app.js           # rotas da API (auth, geração, feedback, dashboard, regras, expurgo)
│   │   ├── db.js            # camada de acesso a dados (SQLite via node:sqlite embutido)
│   │   ├── auth.js          # login local (scrypt) + token HMAC; perfis medico/admin
│   │   ├── llm.js           # API Anthropic (claude-sonnet-4-6), prompt clínico, parser JSON tolerante
│   │   ├── learning.js      # scores adaptativos (EWMA + Laplace), resumo injetado no prompt
│   │   └── seed.js          # base de conhecimento por síndrome + admin inicial
│   └── tests/               # vitest (26 testes): parser, aprendizado, API com LLM mockado
└── frontend/                # React 18 + Vite + Tailwind, pt-BR, responsivo (desktop e celular)
    └── src/pages/           # Login, Plano do dia, Painel de aprendizado, Regras do serviço
```

**Banco de dados**: SQLite pelo módulo nativo `node:sqlite` (sem dependência nativa de compilação). Todo acesso passa por `backend/src/db.js` — para migrar para PostgreSQL, basta reimplementar as funções desse módulo (mesmas assinaturas) sobre `pg`; nenhum outro arquivo importa SQLite.

**Aprendizado adaptativo** (sem treinar modelos):
- Cada feedback atualiza contadores (aceitos / aceitos com modificação / rejeitados) e uma **média móvel exponencial** por padrão de item + categoria + setor.
- A taxa de aceitação usa **suavização de Laplace** (prior Beta(1,1), espírito de Thompson sampling): padrões com pouca evidência ficam neutros e só influenciam com volume.
- A cada geração, o prompt recebe um **resumo do conhecimento do serviço**: padrões bem aceitos (reforçar), padrões rejeitados com motivos (evitar/adaptar) e **regras aprovadas pelo administrador** (prioridade máxima).
- No painel admin, um padrão de rejeição recorrente pode ser **promovido a regra explícita** (ex.: "não sugerir X; o serviço usa Y").

## Instalação e execução

Pré-requisito: **Node.js ≥ 22.13** (usa `node:sqlite` embutido).

```bash
# 1. Backend
cd ptx-adaptativo/backend
npm install
cp .env.example .env        # edite e informe sua ANTHROPIC_API_KEY

# 2. Frontend (build de produção, servido pelo próprio backend)
cd ../frontend
npm install
npm run build

# 3. Subir
cd ../backend
npm start                   # http://localhost:3001
```

Primeiro acesso: `admin@ptx.local` / `admin123` (**troque a senha padrão** via variáveis `PTX_ADMIN_EMAIL`/`PTX_ADMIN_SENHA` antes do primeiro boot, ou crie novos usuários pela tela de login). O seed com a base de conhecimento por síndrome (pneumonia, ICC descompensada, DPOC exacerbado, ITU/sepse, AVC, pós-operatório) roda automaticamente no primeiro boot.

### Desenvolvimento (hot reload)

```bash
# terminal 1 — API em :3001
cd backend && npm run dev

# terminal 2 — Vite em :5173 com proxy de /api para :3001
cd frontend && npm run dev
```

### Variáveis de ambiente (backend/.env)

| Variável | Padrão | Descrição |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | **Obrigatória** para gerar sugestões. Nunca é exposta ao navegador: todas as chamadas ao modelo passam pelo backend. |
| `PORT` | `3001` | Porta do servidor |
| `PTX_DB_PATH` | `./data/ptx.sqlite` | Caminho do banco |
| `PTX_RETENCAO_DIAS` | `90` | Janela de retenção do texto clínico livre (expurgo LGPD) |
| `PTX_ADMIN_EMAIL` / `PTX_ADMIN_SENHA` | `admin@ptx.local` / `admin123` | Credenciais do admin criado no primeiro boot |

### Testes

```bash
cd backend && npm test      # 26 testes: parser tolerante, scores, feedback, API (LLM mockado)
```

## API (resumo)

| Rota | Método | Acesso | Descrição |
|---|---|---|---|
| `/api/auth/registrar` · `/api/auth/login` · `/api/auth/eu` | POST/POST/GET | público/autenticado | Login local por usuário |
| `/api/plano/gerar` | POST | autenticado | Gera sugestões (ou análise de lacunas se `planoExistente` for enviado) |
| `/api/feedback` | POST | autenticado | Persiste 👍/👎/aceito-modificado e atualiza o score adaptativo |
| `/api/dashboard` | GET | autenticado | Taxa de conformidade global/por categoria, série semanal, top aceitos/rejeitados, motivos |
| `/api/regras` | GET/POST/PUT/DELETE | leitura: todos · escrita: admin | Regras aprendidas do serviço |
| `/api/admin/expurgo` | POST | admin | Expurgo manual dos textos clínicos além da retenção |
| `/api/saude` | GET | público | Health check (indica se a IA está configurada) |

## Privacidade / LGPD

- A interface instrui e **não solicita identificadores do paciente** (nome, registro, data de nascimento); avisos permanentes na tela.
- Persiste-se apenas o **contexto clínico mínimo** (lista de problemas + setor) necessário ao aprendizado.
- **Expurgo automático**: na subida do servidor e a cada 24h, textos clínicos livres com mais de `PTX_RETENCAO_DIAS` dias são anulados (ficam apenas agregados estatísticos por item/categoria). Também disponível sob demanda em `/api/admin/expurgo`.
- A chave da API fica somente no ambiente do servidor.

## Critérios de aceite — como verificar

1. **Plano em segundos**: logado, preencha problemas + evolução → sugestões agrupadas por categoria com metas destacadas, critérios de alta e DPA.
2. **Análise de plano existente**: cole um plano no campo opcional → resposta em modo `analise` com lacunas nomeadas pelos 8 componentes + complementos apenas.
3. **Feedback altera sugestões futuras**: rejeite um item 2–3× com motivo ("não disponível no serviço") → nas próximas gerações o resumo injetado no prompt instrui a IA a evitá-lo/adaptá-lo (verificável no painel e nas respostas).
4. **Dashboard**: aba "Painel de aprendizado" mostra taxa de conformidade global, por categoria e evolução semanal.
5. **Privacidade**: nenhum campo de identificação é pedido; a chave só existe no `.env` do backend.
