# Imagem única: a API serve o app compilado (mesma origem para /api, /share e o PWA).
# Atenção: este Dockerfile ainda não foi executado (sem Docker no ambiente de desenvolvimento).
FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/domain/package.json packages/domain/
COPY packages/contracts/package.json packages/contracts/
RUN npm ci && npm rebuild better-sqlite3
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3333 \
    DATABASE_PATH=/data/role.db \
    UPLOAD_DIR=/data/uploads \
    WEB_DIST_DIR=/app/apps/web/dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
VOLUME /data
EXPOSE 3333
# SESSION_SECRET (32+ caracteres) e PUBLIC_WEB_URL precisam ser informados ao rodar.
CMD ["node", "apps/api/dist/server.js"]
