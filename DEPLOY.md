# Guia de Deploy — Passagem de Plantão

Este guia mostra como colocar o app no ar. Há duas rotas:

- **A) Servidor próprio com Docker** — funciona como está (SQLite persistente em volume). Mais simples para um piloto interno.
- **B) Vercel + PostgreSQL** — URL pública gerenciada, ideal para acesso de qualquer lugar.

> ⚠️ **Antes de dados reais:** sirva sob **HTTPS**, defina um `SESSION_SECRET` forte, use **PostgreSQL** (não SQLite) e obtenha aprovação **LGPD/institucional** (e atenção às normas do CFM). Durante avaliação, use os **dados fictícios** do seed.

---

## A) Servidor próprio com Docker (recomendado para piloto)

Pré-requisito: Docker instalado no servidor/VM.

```bash
git clone https://github.com/danilofalcaob/repository2.git
cd repository2

# Suba o app (build + migração + seed automáticos no primeiro start)
SESSION_SECRET="defina-um-segredo-forte-e-aleatorio" docker compose up --build -d
```

- Acesse em **http://SEU_SERVIDOR:3000**
- O banco SQLite fica em um **volume persistente** (`passagem_dados`), sobrevivendo a reinícios.
- Logs: `docker compose logs -f`  ·  Parar: `docker compose down`

Para um domínio com HTTPS, coloque um proxy reverso na frente (ex.: Nginx, Caddy ou Traefik) apontando para a porta 3000. Exemplo mínimo com Caddy (`Caddyfile`):

```
plantao.suaclinica.com.br {
    reverse_proxy localhost:3000
}
```

> Para produção com vários acessos simultâneos, prefira PostgreSQL também aqui (veja a seção de migração abaixo) em vez do SQLite.

---

## B) Vercel + PostgreSQL (URL pública)

O SQLite **não** funciona bem em hospedagem serverless (sistema de arquivos efêmero), então no Vercel use **PostgreSQL**.

### Passo 1 — Crie um PostgreSQL gerenciado
Use **Vercel Postgres**, **Neon** (neon.tech) ou **Supabase**. Copie a connection string (algo como `postgresql://usuario:senha@host/db?sslmode=require`).

### Passo 2 — Troque o provider do Prisma para PostgreSQL
Em [`prisma/schema.prisma`](prisma/schema.prisma), altere o bloco `datasource`:

```prisma
datasource db {
  provider = "postgresql"   // era "sqlite"
  url      = env("DATABASE_URL")
}
```

Faça commit dessa mudança (ou mantenha uma branch de deploy). O restante do schema é compatível — os "enums" são `String` validadas na aplicação.

### Passo 3 — Importe o projeto na Vercel
1. Em **vercel.com** → **Add New… → Project** → importe o `danilofalcaob/repository2`.
2. Em **Environment Variables**, defina:
   - `DATABASE_URL` = a connection string do passo 1
   - `SESSION_SECRET` = uma string longa e aleatória (32+ caracteres)
3. O **Build Command** já está pronto: o script `vercel-build` roda
   `prisma generate && prisma db push && next build`, criando as tabelas no primeiro deploy.
4. Clique em **Deploy**. Ao final, a Vercel te dá a **URL pública**.

### Passo 4 — Popular dados de demonstração (uma vez)
Rode o seed apontando para o banco de produção (a partir da sua máquina):

```bash
# use a MESMA DATABASE_URL de produção
DATABASE_URL="postgresql://...sslmode=require" npm run db:seed
```

Pronto — acesse a URL da Vercel e entre com `admin@demo.com` / `demo123`.

> Em produção real, **remova/zere os usuários de demonstração** e crie usuários próprios pela tela de Admin.

---

## Migrar de SQLite para PostgreSQL (servidor próprio)

1. Troque o `provider` para `postgresql` (passo 2 acima).
2. Aponte `DATABASE_URL` para o Postgres.
3. Rode `npm run setup` (gera client, cria o schema e popula). Em produção, prefira
   `prisma migrate` para versionar o schema:
   ```bash
   npx prisma migrate dev --name init     # gera a primeira migração (ambiente de dev)
   npx prisma migrate deploy              # aplica migrações no servidor
   ```

---

## Variáveis de ambiente (resumo)

| Variável         | Obrigatória | Descrição                                                        |
|------------------|-------------|------------------------------------------------------------------|
| `DATABASE_URL`   | sim         | SQLite (`file:./dev.db`) em dev; PostgreSQL em produção          |
| `SESSION_SECRET` | sim         | Segredo (32+ chars) para assinar sessões. **Troque em produção** |

---

## Checklist de produção

- [ ] `SESSION_SECRET` forte e único definido
- [ ] PostgreSQL no lugar do SQLite
- [ ] HTTPS ativo (proxy reverso ou plataforma)
- [ ] Usuários de demonstração removidos; usuários reais criados
- [ ] Política de backup do banco
- [ ] Aprovação LGPD/institucional concluída antes de qualquer dado real
