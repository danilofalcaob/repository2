// Prepara o ambiente para rodar o app, de forma idempotente e multiplataforma
// (Windows, macOS, Linux). Roda automaticamente antes de `npm run dev` e é o
// que `npm run setup` executa. Pode ser chamado quantas vezes for preciso:
//
//   1. cria o .env a partir do .env.example (com SESSION_SECRET aleatório),
//      se ele ainda não existir e o ambiente não trouxer DATABASE_URL;
//   2. regenera o Prisma Client (o schema pode ter mudado após o npm install,
//      por exemplo ao trocar de branch);
//   3. sincroniza as tabelas do banco com o schema;
//   4. carrega os dados de demonstração SOMENTE se o banco estiver vazio —
//      nunca apaga dados já registrados (para recomeçar do zero, use
//      `npm run db:reset`).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arquivoEnv = path.join(raiz, ".env");
const arquivoExemplo = path.join(raiz, ".env.example");

function log(msg) {
  console.log(`[preparar] ${msg}`);
}

function falhar(msg) {
  console.error(`\n[preparar] ✖ ${msg}\n`);
  process.exit(1);
}

// Leitor mínimo de .env (KEY=valor, aspas opcionais, comentários com #).
function lerEnv(conteudo) {
  const vars = {};
  for (const linha of conteudo.split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let valor = m[2].trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    vars[m[1]] = valor;
  }
  return vars;
}

function executar(comando, args) {
  // No Windows, npx é um .cmd e precisa de shell para ser encontrado.
  const r = spawnSync(comando, args, {
    cwd: raiz,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  return r.status === 0;
}

// 1. Variáveis de ambiente ------------------------------------------------
if (!process.env.DATABASE_URL && !existsSync(arquivoEnv)) {
  if (!existsSync(arquivoExemplo)) falhar("Arquivo .env.example não encontrado na raiz do projeto.");
  const segredo = randomBytes(32).toString("hex");
  const conteudo = readFileSync(arquivoExemplo, "utf8").replace(
    /^SESSION_SECRET=.*$/m,
    `SESSION_SECRET="${segredo}"`,
  );
  writeFileSync(arquivoEnv, conteudo);
  log("Arquivo .env criado a partir do .env.example (com SESSION_SECRET aleatório).");
}

if (existsSync(arquivoEnv)) {
  const vars = lerEnv(readFileSync(arquivoEnv, "utf8"));
  for (const [chave, valor] of Object.entries(vars)) {
    if (process.env[chave] === undefined) process.env[chave] = valor;
  }
}

if (!process.env.DATABASE_URL) {
  falhar("DATABASE_URL não definida. Confira o arquivo .env (veja .env.example).");
}

// 2. Prisma Client ---------------------------------------------------------
log("Gerando o Prisma Client…");
if (!executar("npx", ["prisma", "generate"])) {
  falhar("Não foi possível gerar o Prisma Client. Rode `npm install` e tente de novo.");
}

// 3. Tabelas ---------------------------------------------------------------
log("Sincronizando as tabelas do banco com o schema…");
if (!executar("npx", ["prisma", "db", "push", "--skip-generate"])) {
  falhar(
    "Não foi possível atualizar o banco. Se o Prisma avisou que haveria perda de dados " +
      "(banco antigo, de outra versão do app), recrie o banco de demonstração com " +
      "`npm run db:reset` — isso APAGA os dados atuais.",
  );
}

// 4. Dados de demonstração (apenas em banco vazio) -------------------------
// Import dinâmico: o client acabou de ser (re)gerado no passo 2.
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
let usuarios = 0;
let jornadas = 0;
let equipeDemo = 0;
try {
  usuarios = await prisma.usuario.count();
  jornadas = await prisma.jornada.count();
  equipeDemo = await prisma.usuario.count({ where: { email: "gustavo@demo.com" } });
} catch (e) {
  await prisma.$disconnect();
  falhar(`Não foi possível ler o banco: ${e instanceof Error ? e.message : e}`);
}
await prisma.$disconnect();

if (usuarios === 0) {
  log("Banco vazio — carregando os dados de demonstração (fictícios)…");
  if (!executar("npx", ["tsx", "prisma/seed.ts"])) falhar("Falha ao carregar os dados de demonstração.");
} else {
  log(`Banco já tem ${usuarios} usuário(s) — dados preservados.`);
  // Banco de demonstração criado por uma versão anterior do app (só a passagem
  // de plantão): as tabelas novas existem, mas sem a equipe e os casos do CRM.
  if (jornadas === 0 && equipeDemo === 0) {
    console.warn(
      "\n[preparar] ⚠️  Este banco foi criado por uma versão anterior do app e não tem os\n" +
        "           dados de demonstração do CRM (equipe multiprofissional e casos no funil).\n" +
        "           Para carregá-los, rode:  npm run db:reset\n" +
        "           (isso APAGA os dados atuais do banco e recria a demonstração completa).\n",
    );
  }
}

log("Ambiente pronto. ✔");
