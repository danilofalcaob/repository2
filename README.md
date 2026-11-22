# Jornada do Paciente — CRM de deshospitalização + Passagem de Plantão (I-PASS) + Evolução de exames na UTI

Aplicativo web **full-stack**, em **português do Brasil**, **mobile-first** e
usável em desktop, com três módulos que se complementam:

1. **Jornada de Alta (CRM de deshospitalização)** — acompanha cada internação
   como um caso em um **funil**, no estilo das ferramentas de CRM, para alinhar
   médicos, enfermagem, fisioterapia, serviço social, farmácia, nutrição e
   gestão de leitos em torno de **um plano, um responsável e uma data de alta
   prevista**. O objetivo é **alta precoce e segura**: atacar o que trava o
   paciente no hospital antes que vire mais um dia de internação.
2. **Passagem de plantão (I-PASS)** — handoff/sign-out estruturado no padrão
   internacional baseado em evidência, com histórico imutável, auditoria e
   ligação com deterioração clínica (Time de Resposta Rápida — TRR).
3. **UTI · Evolução de exames** — mapa de leitos da UTI e, para cada paciente,
   os laudos laboratoriais (PDF, printscreen ou texto) viram **pontos de
   atenção**, **gráficos de tendência**, **exames em linha** prontos para o
   prontuário e um **resumo evolutivo** para o item "Evolução" das evoluções
   diurna e noturna.

> **Por que CRM?** Em vendas, um negócio sem dono, sem próxima etapa e sem data
> prevista simplesmente para no funil. Uma internação funciona igual: o que
> atrasa a alta raramente é a doença — é a barreira sem responsável, o exame sem
> prazo, o parecer que ninguém cobrou, a autorização que ninguém acompanhou.
> O módulo de jornada traz do CRM exatamente isso: **pipeline visível, dono do
> caso, atividades com prazo, histórico de interações e previsão de fechamento**
> — aplicados à alta hospitalar.

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
- Captura por voz via **Web Speech API** (pt-BR, nativa do navegador)

---

## Pré-requisitos

- **Node.js 18+** (recomendado 20/22) e **npm**.
- Nada além disso para a demo (SQLite é embutido — sem servidor de banco).

---

## Instalação e execução (demo local)

```bash
# 1. Baixar o código (o módulo UTI · Exames está nesta branch até ser mergeado)
git clone https://github.com/danilofalcaob/repository2.git
cd repository2
git checkout claude/loving-hamilton-cno10j

# 2. Instalar dependências
npm install

# 3. Rodar
npm run dev
# abra http://localhost:3000
```

Na primeira execução, o `npm run dev` prepara tudo sozinho (script
[`scripts/preparar-ambiente.mjs`](scripts/preparar-ambiente.mjs)): cria o `.env`
com um `SESSION_SECRET` aleatório, cria as tabelas do banco SQLite e carrega os
dados de demonstração. Nas execuções seguintes ele só confere o banco — **nunca
apaga o que foi registrado**. Funciona igual no Windows, macOS e Linux (não é
preciso copiar o `.env` à mão).

Para preparar o ambiente sem subir o servidor, use `npm run setup`. Para apagar
tudo e recomeçar com os dados de demonstração, use `npm run db:reset`.

Para produção local:

```bash
npm run setup
npm run build
npm run start
```

### Problemas comuns

| O que aparece | Causa | Como resolver |
|---|---|---|
| Aviso amarelo **"O app ainda não está pronto para login"** | O servidor foi iniciado sem preparar o banco (por exemplo, com `npx next dev`) | Pare o servidor (Ctrl+C) e rode `npm run dev` — ou `npm run setup` e depois `npm run dev` |
| **"E-mail ou senha incorretos."** com `gustavo@demo.com` | O banco foi criado por uma versão anterior do app, só com os usuários do I-PASS (o terminal mostra um aviso ao iniciar) | `npm run db:reset` — recria a demonstração completa (apaga os dados atuais) |
| Título **"Passagem de Plantão"** e sem o menu **Funil** | Você está na `main`, que ainda não tem o CRM | `git checkout claude/crm-patient-tracking-app-ivvvwp` e `npm run dev` (ou faça o merge do PR #2) |
| **"Falha ao entrar."** | Versão anterior da `main`, que não diagnosticava o erro — quase sempre banco não criado | Atualize para esta branch; o novo aviso indica o passo exato |
| `'npm' não é reconhecido…` (Windows) | Node.js não instalado ou terminal aberto antes da instalação | Instale o Node.js 20+ em nodejs.org e abra um terminal novo |

### Usuários de demonstração

Senha para todos: **`demo123`**

**Equipe multiprofissional da Enfermaria Clínica** (módulo Jornada de Alta):

| E-mail             | Disciplina               | Papel na demonstração                         |
|--------------------|--------------------------|-----------------------------------------------|
| `gustavo@demo.com` | Medicina                 | Diarista e gestor da maioria dos casos         |
| `sofia@demo.com`   | Enfermagem               | Critérios de alta, educação do cuidador        |
| `rafael@demo.com`  | Fisioterapia             | Funcionalidade e barreiras de reabilitação     |
| `marina@demo.com`  | Serviço Social           | Barreiras sociais, cuidador, transporte        |
| `helena@demo.com`  | Farmácia                 | Conversão de antibiótico, conciliação          |
| `camila@demo.com`  | Nutrição                 | Dieta e orientação nutricional                 |
| `paula@demo.com`   | Gestão de Leitos / NIR   | Vaga externa, regulação, autorizações          |

**Gestão e plantão (módulo I-PASS):**

| E-mail            | Perfil        | O que acessa                                   |
|-------------------|---------------|------------------------------------------------|
| `admin@demo.com`  | Administrador | Tudo + configuração de setores/turnos/usuários |
| `coord@demo.com`  | Coordenador   | Painel, indicadores, histórico e exportação    |
| `bruno@demo.com`  | Plantonista   | Quadro, passagens, pacientes, TRR (PS/UTI)     |
| `daniela@demo.com`| Plantonista   | Idem (use para simular quem **recebe**)        |

> Dica 1: entre com `marina@demo.com` e depois com `gustavo@demo.com` para ver
> como a **mesma jornada** aparece para o serviço social e para a medicina —
> cada um com sua caixa de entrada, sobre o mesmo plano.
>
> Dica 2: para testar o **read-back** do I-PASS, inicie uma passagem com um
> usuário e faça login com o receptor escolhido para reconhecer pacientes e
> contingências.

---

## Scripts úteis

| Script            | Descrição                                            |
|-------------------|------------------------------------------------------|
| `npm run dev`     | Servidor de desenvolvimento                          |
| `npm run build`   | Build de produção (gera o Prisma Client)             |
| `npm run start`   | Servidor de produção                                 |
| `npm run setup`   | Prepara o ambiente: `.env`, Prisma Client, tabelas e dados de demonstração **se o banco estiver vazio** (roda sozinho antes do `npm run dev`) |
| `npm run db:seed` | Recarrega os dados de demonstração (**apaga** os dados atuais) |
| `npm run db:reset`| Recria o banco do zero e popula (**apaga** os dados atuais) |
| `npm run db:seed:uti` | Num banco já existente, carrega só a demonstração da UTI (leitos + pacientes com exames), se a "UTI Geral" ainda não tiver leitos |
| `npm test`        | Testes (Vitest) das regras críticas                  |

---

## Funcionalidades — Jornada de Alta (CRM de deshospitalização)

### Funil de alta (pipeline)
Cada internação vira uma **jornada** que percorre sete etapas:

`Admissão → Investigação → Tratamento → Critérios de alta → Planejamento de alta
→ Alta pactuada (D-1) → Alta efetivada`

- Quadro estilo Kanban com **arrastar e soltar** entre etapas (e seletor
  equivalente para celular e navegação por teclado).
- Cartão mostra permanência, **data de alta prevista (DAP)**, prontidão em
  critérios objetivos, barreiras abertas, gestor do caso e alertas.
- Ordenação automática por prioridade: quem precisa de decisão aparece primeiro.
- Filtros por setor, disciplina, busca e "só casos com pendência da minha área".

### Barreiras à alta — o item central
O que trava o paciente é registrado com **categoria, disciplina dona,
responsável, prazo e impacto estimado em dias**, e separado entre:

- **clínicas** (condição, exame, parecer, procedimento, medicamento, reabilitação);
- **não clínicas** (social, transporte, suporte domiciliar, autorização,
  documentação, vaga externa) — as que costumam ser evitáveis.

Isso permite responder à pergunta que mais importa: *quantos pacientes estão
clinicamente prontos e continuam internados por um problema de processo?*

### Critérios objetivos de alta
Checklist padrão (clínicos, funcionais, educacionais e logísticos) criado junto
com a jornada, marcável por qualquer disciplina, com opção "não se aplica".
O percentual atingido funciona como a "probabilidade de fechamento" do CRM —
só que ancorada em critérios clínicos.

### Tarefas por disciplina e caixa de entrada
Cada ação do plano de alta tem título, disciplina, responsável, prazo e
prioridade, agrupadas por equipe. Cada profissional vê no funil quantas tarefas
e barreiras estão sob sua responsabilidade.

### Linha do tempo do caso (append-only)
Notas de round, decisões, conversas com a família, mudanças de etapa e alertas
ficam registrados em ordem, com autor e disciplina. **Menções `@disciplina`**
(ex.: `@servico_social`) direcionam o pedido — substituindo o "avisa lá no
corredor" por um registro rastreável. Suporta **ditado por voz** (pt-BR).

### Round multiprofissional diário
Tela dedicada ao ritual que mantém a equipe alinhada:

- Casos na ordem em que precisam de decisão, com barra de **cobertura do round**.
- Em cada caso: resolver barreiras na hora, repactuar a DAP e a confiança,
  registrar o combinado e avançar a etapa — tudo em um formulário só.
- Se o avanço for bloqueado pela regra de segurança, **o motivo entra na
  timeline** para a equipe ver.

### Regra de alta segura
A alta só é efetivada com as **barreiras bloqueantes resolvidas** e os critérios
fechados (ou marcados como não aplicáveis); pactuar alta exige DAP definida.
Antecipar sem resolver o que trava é empurrar o problema para a reinternação.

### Painel de deshospitalização
Indicadores voltados a **dias de internação evitáveis**:

- Casos ativos, permanência média, casos **prontos travados por processo**.
- Altas previstas hoje/amanhã/7 dias, casos **sem DAP** ou com **previsão vencida**.
- Casos **parados** (sem registro de nenhuma equipe há 24h) e sem gestor.
- **Acurácia da previsão de alta** (tolerância de ±1 dia) e desvio médio.
- **Altas até as 12h** (libera o leito no mesmo turno).
- Barreiras por categoria, tempo médio de resolução e **dias evitáveis declarados**.
- Gargalos do funil: tempo médio em cada etapa.

---

## Funcionalidades — UTI · Evolução de exames

Menu **🧪 UTI · Exames**. Para ver com dados prontos, entre com
`admin@demo.com` / `demo123`: a **UTI Geral** da demonstração tem 10 leitos e
4 pacientes com 3 a 6 dias de exames (choque séptico, pneumonia, cetoacidose
diabética e pós-operatório com colestase).

### 1. Configuração inicial dos leitos
Em **⚙️ Leitos** (ou na primeira visita, quando a unidade ainda não tem leitos):

- **Sequência numérica**: quantidade, primeiro número, nº de dígitos e prefixo
  opcional — ex.: 10 leitos a partir de 201 → 201…210; ou `UTI-01`…`UTI-10`.
- **Lista personalizada**: qualquer numeração (salteada, com letras, "Isolamento 1"…).
- Pode ser alterada depois; leitos ocupados não podem ser removidos.
- Coordenação/administração pode criar **mais de uma UTI** (**＋ Nova UTI**).

### Mapa de leitos
Cada leito mostra o paciente, dias de UTI, **quantos exames estão alterados e
quantos são críticos** (borda vermelha), os principais alterados e a hora do
último laboratório. Leito livre → **Admitir paciente** (identificador, idade,
sexo, diagnóstico, data). Na ficha, **Liberar leito** registra alta,
transferência ou óbito (os exames ficam no histórico).

### Anexar exames — sem limite de quantidade
Na ficha do paciente, **＋ Adicionar**:

- **PDF do laboratório** (vários de uma vez, arrastando ou escolhendo);
- **printscreen**: cole com **Ctrl+V** em qualquer lugar da página;
- **texto copiado** do sistema do laboratório — inclusive linhas no próprio
  formato `Lab 01/06/2026 - Hb 14,1 g/dL / K 4,5 mEq/L / ...` (útil para trazer
  exames de evoluções anteriores; cada linha "Lab" vira uma coleta);
- **digitação manual**.

Para testar sem dados reais, use os laudos **fictícios** de
[`exemplos/`](exemplos): `laudo-ficticio.pdf` e `print-laudo-ficticio.png`.

Os arquivos são processados um a um. Duas formas de leitura:

| Leitura | Como funciona | Quando usar |
|---|---|---|
| **Local** (padrão) | PDF: texto extraído no servidor. Imagem: **OCR no próprio navegador** (Tesseract, servido pelo app — a imagem não sai do computador). Um leitor reconhece ~80 exames, valores no padrão brasileiro (`6.520`, `0,62`), unidades, referências (inclusive por sexo) e ignora urina/culturas. | Sempre disponível; ótimo para PDFs com texto. Assume uma coleta por laudo (relatórios cumulativos com várias datas em colunas: use a IA). OCR de prints é bom, mas confira com atenção (há correção automática, sinalizada, para vírgula decimal perdida). |
| **IA (Claude)** | O PDF/imagem é enviado à API da Anthropic e volta estruturado (inclusive relatórios cumulativos com várias datas). | Mais precisa em layouts difíceis, PDFs digitalizados e prints. Exige `ANTHROPIC_API_KEY` e **respaldo LGPD**, pois o laudo sai da instituição. |

**Nada é gravado sem revisão**: cada laudo abre uma tabela editável (exame,
valor, unidade, referência, observação, data/hora da coleta) com a situação
calculada ao vivo e o **laudo original a um clique** para conferência. Valores
já registrados aparecem marcados e desmarcados; um valor diferente para o mesmo
exame e horário **substitui** o anterior (correção).

### 2. Pontos de atenção
Último resultado de cada exame: **valores críticos** em destaque (K, Na, Hb,
plaquetas, glicemia, lactato, pH, INR…), depois os alterados com **tendência**
(piorando · novo · persistente · melhorando — comparando com o exame anterior
e com as últimas 72 h), valor anterior e referência, e os **normalizados no
último exame**. Botão para copiar os pontos de atenção.

### 3. Gráficos de tendência
Um gráfico por exame, agrupados por sistema, com **faixa de referência
sombreada** e pontos alterados/críticos destacados; filtro **"Somente
alterados"** (padrão), período e grupo; tooltip com data/hora, valor e
situação; cada gráfico alterna para **tabela**.

### 4. Exames em linha
Uma linha por coleta, no formato do prontuário, com os alterados em negrito:

```
Lab 01/06/2026 - Eritrócitos **5,19 milhões/mm³ (aumentado)** / Hb 14,1 g/dL / Ht 44,0% / HCM **27,2 pg (diminuído)** / ... / Cortisol 13,5 mcg/dL (colhido às 11:15) / ...
```

Ordem padronizada (hemograma → eletrólitos → função renal → gasometria →
coagulação → hepático → inflamatórios → …), números no padrão brasileiro,
observações entre parênteses, opção de destaque com `**negrito**`,
`(AUMENTADO)` ou sem destaque (para prontuários que não interpretam
asteriscos), copiar uma linha ou todas.

### 5. Resumo evolutivo (item "Evolução")
Texto pronto para as **evoluções diurna e noturna**, no período escolhido
(24 h, 48 h, 72 h, 7 dias, 14 dias ou toda a internação). Exemplo real da
demonstração:

> Evoluiu com leucocitose progressiva (Leucócitos 11.200 → 19.800/mm³),
> plaquetopenia progressiva (Plaquetas 151.000 → 95.000/mm³) e piora da função
> renal (Cr 1,02 → 2,42 mg/dL; KDIGO 2 pelo critério de creatinina). Evoluiu
> com hipercalemia (pico de K 6,2 mEq/L em 18/11), com melhora e normalização
> nos últimos 2 dias (K 4,5 mEq/L). Mantém elevação de PCR, porém em melhora…

As frases saem de **regras determinísticas e auditáveis** (sem IA), em
[`src/lib/exames/evolucao.ts`](src/lib/exames/evolucao.ts):

- para cada exame, a série no período (mais o último exame anterior, como
  base) é classificada em **nova alteração**, **progressiva/piora**, **em
  melhora**, **normalizou** (com "nos últimos N dias") ou **estável**, usando a
  referência do laudo e um limiar de **variação relevante** por exame;
- **função renal** pela creatinina com **estadiamento KDIGO** (critério de
  creatinina); **distúrbio ácido-base** classificado por pH + pCO₂ + HCO₃
  (acidose metabólica/respiratória/mista, alcaloses); transaminases descritas
  em conjunto; cálcio iônico preferido ao total;
- alterações **discretas** (pouco além da referência) ficam de fora por padrão
  — há opção para incluí-las; valores críticos sempre entram;
- opção de incluir ou não os valores e de anexar o último laboratório em linha;
  o texto é editável antes de copiar.

O catálogo de exames (nomes, sinônimos, unidades e conversões, referências
padrão por sexo, valores críticos, síndromes) fica em
[`src/lib/exames/catalogo.ts`](src/lib/exames/catalogo.ts) — ajuste-o às
referências e aos valores de pânico da sua instituição.

> As referências do **laudo** sempre prevalecem; as do catálogo só são usadas
> quando o laudo não traz a faixa. O resumo e os pontos de atenção apoiam — não
> substituem — a leitura do laudo e o julgamento clínico.

### Leitura por IA (opcional)
1. Crie uma chave em console.anthropic.com e defina no servidor
   `ANTHROPIC_API_KEY=...` (veja `.env.example`).
2. Opcional: `EXAMES_IA_MODELO` (padrão `claude-opus-5-5`) e `EXAMES_IA=desligada`
   para desativar mesmo com chave.
3. Na tela de anexar, escolha **IA (Claude)**. A resposta usa saída estruturada
   (JSON validado) e, se o modelo recusar, cai automaticamente para o modelo de
   reserva recomendado (`fallbacks: "default"`).

---

## Funcionalidades — Passagem de plantão (I-PASS)

### Passagem estruturada I-PASS
- **I** – Gravidade (estável / cuidado / instável) com código de cores.
- **P** – Resumo do paciente.
- **A** – Pendências/ações com responsável, prazo, prioridade e **herança entre turnos**.
- **S** – Consciência situacional e **contingências estruturadas** (parâmetro + limiar → ação).
- **S** – **Síntese do receptor** (read-back) + campo de **nível de preocupação / intuição clínica**.

### Quadro de passagem
- Lista de pacientes **ordenada por prioridade clínica** (gravidade → preocupação → contingências → pendências vencidas).
- Resumo por paciente: leito, gravidade (cor), preocupação, pendências abertas/vencidas, contingências ativas.
- Filtro por setor e busca por paciente/leito/diagnóstico.

### Passagem "viva" e segurança
- **"O que mudou desde a última passagem"** (resumo automático + anotação).
- **Contingências** como item de primeira classe, em destaque, com **read-back obrigatório** e **lembrete agendável**; botão **"o gatilho ocorreu"**.
- **Conclusão** só é permitida com read-back dos pacientes **instáveis** e das **contingências ativas**.
- **Captura por voz** (pt-BR) em todos os campos de texto.
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
- **plantonista**, **profissional assistencial**, **coordenador**, **admin** —
  controle por perfil e por setor.
- Cada usuário tem ainda uma **disciplina** (medicina, enfermagem, fisioterapia,
  serviço social, farmácia, nutrição, fonoaudiologia, psicologia, terapia
  ocupacional, gestão de leitos), que define sua caixa de entrada no CRM.

### Integração entre os dois módulos
- A ficha clínica do paciente leva direto ao **plano de alta** (e vice-versa).
- A ficha da jornada mostra o **contexto clínico da última passagem**:
  gravidade, nível de preocupação, contingências ativas e pendências do plantão.
- Efetivar a alta pela jornada atualiza o status do paciente no quadro.

---

## Modelo de dados

Definido em [`prisma/schema.prisma`](prisma/schema.prisma).

**Passagem de plantão:** `Usuario`, `Setor`, `Turno`, `Paciente`,
`PassagemEvento`, `SnapshotPaciente` (+ `SnapshotVersao` para versionamento
append-only), `Pendencia`, `Contingencia`, `Reconhecimento`, `EventoTRR` e
`LogAuditoria`.

**CRM de deshospitalização:** `Jornada` (o caso no funil), `Barreira`,
`TarefaJornada`, `CriterioAlta`, `InteracaoJornada` (timeline append-only),
`MovimentacaoEtapa` (histórico do funil, base dos gargalos) e `MembroEquipe`.

**UTI · Evolução de exames:** `Leito` (leitos configurados por unidade),
`DocumentoExame` (laudo anexado: arquivo original, texto extraído, rascunho
até a revisão) e `ResultadoExame` (um valor de exame, com referência, situação
e data/hora da coleta). A ocupação do leito é o paciente ativo do setor com o
mesmo rótulo de leito.

As regras de negócio do funil ficam isoladas em
[`src/lib/jornada.ts`](src/lib/jornada.ts) — arquivo puro, sem banco nem
framework, coberto por testes.

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

Cobrem regras críticas dos três módulos:

- **Passagem:** conclusão, **imutabilidade e versionamento append-only** do
  histórico, **herança de pendências**, **hash de senha**, lógica de "o que
  mudou" e ordenação por prioridade.
- **Jornada de alta:** prontidão para alta (com "não se aplica"), situação e
  **acurácia da data de alta prevista**, separação entre barreiras clínicas e de
  processo, **regra de alta segura** (bloqueio da alta com barreira pendente),
  alertas (previsão vencida, caso parado, pronto travado por processo),
  priorização do funil e menções a disciplinas.
- **UTI · Exames:** números pt-BR, reconhecimento de nomes, leitura de laudos
  em tabela/blocos e do formato "linha de exames" (o exemplo completo do
  prontuário), referência por sexo e por ordem de grandeza (% × absoluto do
  leucograma), urina ignorada, correção de vírgula do OCR, linha de exames no
  formato exato, resumo evolutivo (normalização "nos últimos 2 dias",
  leucocitose progressiva, KDIGO, ácido-base, alterações discretas, troca de
  direção), pontos de atenção e mapeamento da resposta da IA.

---

## Estrutura do projeto

```
prisma/            schema + seed (dados fictícios)
src/
  app/
    login/                       tela de login
    (app)/                       área autenticada (layout + navegação)
      jornada/                   CRM de deshospitalização
        page.tsx                 funil de alta (Kanban, tela inicial)
        [id]/                    ficha do caso: barreiras, tarefas, critérios, timeline, equipe
        nova/                    abrir jornada para um paciente internado
        round/                   round multiprofissional do dia
        painel/                  indicadores de deshospitalização
      quadro/                    quadro de passagem de plantão
      pacientes/                 lista + ficha (I-PASS, pendências, contingências, timeline)
      passagem/                  iniciar e editar passagem (read-back, voz, conclusão)
      historico/                 histórico imutável, visualização e auditoria
      indicadores/               painel de gestão da passagem + exportação
      trr/                       Time de Resposta Rápida
      uti/                       UTI · Evolução de exames
        page.tsx                 mapa de leitos
        configurar/              configuração inicial dos leitos (sequência ou lista)
        paciente/[id]/           anexar laudos, revisão, pontos de atenção, gráficos, linhas, resumo
      admin/                     setores, turnos, usuários
    api/                         auth (login/logout), exportação e UTI (importar laudo, ver original)
  components/                    NavBar, badges, tema, voz, botão de ação
  lib/
    jornada.ts                   regras do funil (puras e testáveis)
    jornada-queries.ts           leitura do funil e da caixa de entrada
    jornada-metrics.ts           indicadores de deshospitalização
    exames/                      UTI · Exames (puros, exceto pdf/ia/queries)
      catalogo.ts                exames, sinônimos, unidades, referências, críticos, síndromes
      parser.ts                  leitura local de laudos em texto
      valores.ts                 números pt-BR e classificação
      series.ts                  séries na unidade canônica
      atencao.ts                 pontos de atenção
      linha.ts                   exames em linha
      evolucao.ts                resumo evolutivo
      pdf.ts, ia.ts, ia-mapa.ts  texto do PDF e leitura por IA (Claude)
    db, auth, audit, queries, metrics, format, constants, diff
tests/                           Vitest
```
