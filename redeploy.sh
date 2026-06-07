#!/bin/sh
# Pousse sur GitHub puis déclenche le déploiement Render (deploy hook).
set -e
cd "$(dirname "$0")"
git push origin main || true
HOOK="$(cat .render-deploy-hook 2>/dev/null)"
[ -n "$HOOK" ] || { echo "⚠️ .render-deploy-hook manquant"; exit 1; }
echo "→ déclenchement du déploiement Render…"
curl -fsS "$HOOK" && echo "\n✅ déploiement Render déclenché."
