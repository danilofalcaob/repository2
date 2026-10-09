# Imagem única (build + runtime) para simplicidade na demonstração.
FROM node:20-slim AS base
WORKDIR /app

# Dependências de sistema para o Prisma (OpenSSL).
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Instala dependências (camada cacheável).
COPY package.json package-lock.json* ./
RUN npm install

# Copia o restante e gera o Prisma Client + build.
COPY . .
ENV DATABASE_URL="file:./prisma/dev.db"
RUN npx prisma generate && npm run build

EXPOSE 3000
ENV NODE_ENV=production
ENV DATABASE_URL="file:./prisma/dev.db"

# Na inicialização: sincroniza o schema, carrega os dados de demonstração só se
# o banco estiver vazio (nunca apaga o que a equipe registrou) e sobe o servidor.
CMD ["sh", "-c", "node scripts/preparar-ambiente.mjs && npm run start"]
