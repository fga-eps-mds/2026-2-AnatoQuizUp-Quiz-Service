FROM node:24-alpine AS deps

WORKDIR /app

COPY package*.json ./

RUN npm ci

FROM node:24-alpine AS build

WORKDIR /app

ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5433/anatoquizup_quiz?schema=public"

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
RUN npm run build

FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3334

CMD ["sh", "-c", "npx prisma migrate deploy && npm run prisma:seed:catalogo:prod && node dist/src/server.js"]
