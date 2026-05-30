FROM node:20-alpine AS builder

# Prisma necesita OpenSSL para generar/correr sus engines en Alpine
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma/
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src/
RUN npm run build

# ─── Production image ───────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# OpenSSL para el schema engine de Prisma (prisma migrate deploy en el arranque)
RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma/

EXPOSE 3000

CMD ["npm", "run", "start"]
