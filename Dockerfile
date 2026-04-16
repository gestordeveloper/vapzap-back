# Estágio de build
FROM node:20-alpine AS builder

WORKDIR /app

# Copia os arquivos de dependência
COPY package.json package-lock.json* ./

# Instala as dependências
RUN npm ci

# Copia o código fonte e os arquivos env/prisma
COPY . .

# Gera o client do Prisma e realiza o build da aplicação TypeScript
RUN npx prisma generate
RUN npm run build

# Estágio de produção
FROM node:20-alpine

WORKDIR /app

# Copia package.json para as dependências de produção
COPY --from=builder /app/package.json /app/package-lock.json* ./

# Instala somente as dependências de produção
RUN npm ci --omit=dev

# Copia os arquivos necessários do estágio anterior
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

RUN npm install -g prisma

EXPOSE 3000

# Sincroniza o banco e executa o servidor
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npm start"]
