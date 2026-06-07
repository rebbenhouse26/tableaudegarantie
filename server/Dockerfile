# Backend — API Node + Express + SQLite
FROM node:22-bookworm-slim AS base
WORKDIR /app

# Outils de build au cas où better-sqlite3 n'aurait pas de binaire pré-compilé.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Dépendances (cache séparé de la source).
COPY package.json package-lock.json ./
RUN npm ci

# Code applicatif.
COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production
ENV PORT=4000
ENV DB_PATH=/app/data/tableau-de-garanti.db

# Dossier de persistance SQLite (monté en volume par docker-compose).
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 4000
CMD ["npm", "run", "start"]
