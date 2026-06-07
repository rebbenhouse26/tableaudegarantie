# Image de production COMBINÉE : frontend (nginx) + backend (Node) + SQLite.
# nginx sert la SPA et reverse-proxy /api vers le backend sur 127.0.0.1:4000
# (même origine → aucun souci de CORS). Le port public est paramétrable via $PORT
# (par défaut 80) pour s'adapter à Fly.io / Render / Railway / VPS.
#
# Utilisée par fly.toml et render.yaml. Build local :
#   docker build -t tableau-de-garanti .
#   docker run -p 8080:80 -v tdg:/api/data tableau-de-garanti  → http://localhost:8080

# --- 1. Build du frontend ---
FROM node:22-bookworm-slim AS web
WORKDIR /web
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# --- 2. Dépendances du backend (better-sqlite3 compilé pour Linux) ---
FROM node:22-bookworm-slim AS api
WORKDIR /api
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/tsconfig.json ./
COPY server/src ./src

# --- 3. Image d'exécution : Node + nginx ---
FROM node:22-bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends nginx gettext-base \
  && rm -rf /var/lib/apt/lists/* \
  && rm -f /etc/nginx/sites-enabled/default

WORKDIR /api
COPY --from=api /api /api
COPY --from=web /web/dist /usr/share/nginx/html
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && mkdir -p /api/data

ENV NODE_ENV=production
ENV DB_PATH=/api/data/tableau-de-garanti.db
# Port public par défaut (les plateformes type Render surchargent $PORT).
ENV PORT=80
VOLUME ["/api/data"]
EXPOSE 80
CMD ["/entrypoint.sh"]
