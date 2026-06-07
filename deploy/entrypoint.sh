#!/bin/sh
set -e

# Port public servi par nginx ($PORT fourni par la plateforme, 80 par défaut).
: "${PORT:=80}"
export PUBLIC_PORT="$PORT"
envsubst '${PUBLIC_PORT}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

# Backend Node sur un port interne FIXE (4000), indépendant du port public.
# On force PORT=4000 pour ce process uniquement (sans toucher au $PORT public).
PORT=4000 /api/node_modules/.bin/tsx /api/src/index.ts &
API_PID=$!

# Si le backend meurt, on arrête le conteneur (la plateforme le relancera).
trap 'kill "$API_PID" 2>/dev/null || true' TERM INT

exec nginx -g 'daemon off;'
