# Imagem única (build + runtime) para simplicidade no piloto.
FROM node:20-slim
WORKDIR /app

# Dependências de sistema para o Prisma (OpenSSL).
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install

COPY . .
ENV DATABASE_URL="file:/app/dados/ciranda.db"
RUN npx prisma generate && npm run build

EXPOSE 3000
ENV NODE_ENV=production

# Na inicialização: sincroniza o schema, carrega a demonstração só se o banco
# estiver vazio (nunca apaga dados registrados) e sobe o servidor.
CMD ["sh", "-c", "node scripts/preparar-ambiente.mjs && npm run start"]
