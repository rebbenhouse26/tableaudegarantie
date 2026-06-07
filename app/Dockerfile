# Frontend — build Vite puis service statique via nginx (avec reverse-proxy /api)
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# URL de l'API côté navigateur. Par défaut "/api" → servi par nginx sur la même
# origine (reverse-proxy vers le backend), donc aucun souci de CORS.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# --- Image de service ---
FROM nginx:1.27-alpine AS serve
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
