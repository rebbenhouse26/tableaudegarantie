# Déploiement — Tableau de Garanti

> ⚠️ **Données de santé.** L'app stocke des garanties et devis = **données de santé**.
> En France, leur hébergement doit se faire chez un **hébergeur certifié HDS**
> (OVHcloud HDS, Scaleway, AWS/Azure offres HDS…). **Render, Fly.io, Vercel ne sont PAS HDS.**
> Ils conviennent pour **tester** ; pour de **vrais patients**, voir [`HDS-RGPD.md`](./HDS-RGPD.md).

## Architecture

```
Patient / Cabinet ──HTTPS──> Front (React)  ──/api──>  Back (Express) ──> SQLite (volume chiffré)
                                                            │
                                                  Gemini · Brevo · Alma · Klarna
```

Deux façons de déployer :

| Option | Front | Back + DB | Quand |
|---|---|---|---|
| **A. Tout-en-un (recommandé)** | servi par nginx dans la même image | même conteneur | 1 seul déploiement, même origine (pas de CORS), simple à mettre sur un **hébergeur HDS** |
| **B. Séparé** | **Vercel** | conteneur sur **hébergeur HDS** | si tu veux un CDN front mondial |

## Option A — Image tout-en-un (Docker)

Image combinée `Dockerfile` (nginx + Node + SQLite). Build/run local :

```bash
docker build -t tableau-de-garanti .
docker run -p 8080:80 -v tdg:/api/data \
  -e JWT_SECRET=$(openssl rand -hex 32) \
  -e GEMINI_API_KEY=... \
  tableau-de-garanti
# → http://localhost:8080
```

Ou `docker compose up --build` (voir `docker-compose.yml`).

**Sur un hébergeur HDS** (ex. OVHcloud Managed Kubernetes/Instance HDS, Scaleway) : pousser cette
même image, monter un **volume persistant chiffré** sur `/api/data`, définir les secrets (ci-dessous),
activer **HTTPS** (certificat TLS) et brancher le **nom de domaine**.

Blueprints fournis pour les tests : `render.yaml` (Render, Frankfurt), `fly.toml` (Fly.io, `cdg`).

## Option B — Front sur Vercel + Back sur HDS

1. **Back** : déployer `server/Dockerfile` sur l'hébergeur HDS (volume `/api/data`, secrets, HTTPS) → API sur `https://api.mon-domaine.fr`.
2. **Front** : sur Vercel, *Root Directory* = `app`, variable **`VITE_API_URL=https://api.mon-domaine.fr/api`** (`app/vercel.json` gère le build SPA + le routing).
3. Définir `CORS_ORIGIN=https://app.mon-domaine.fr` côté back.

## Variables d'environnement (secrets)

Modèle complet : [`server/.env.production.example`](./server/.env.production.example).

| Variable | Rôle | Obligatoire |
|---|---|---|
| `JWT_SECRET` | signature des sessions (`openssl rand -hex 32`) | ✅ |
| `CORS_ORIGIN` | domaine du front autorisé | ✅ |
| `APP_BASE_URL` | URL publique (liens e-mail/SMS/paiement) | ✅ |
| `DB_PATH` | base SQLite sur volume persistant | ✅ |
| `GEMINI_API_KEY` | extraction IA (⚠️ **régénérer** l'ancienne) | recommandé |
| `BREVO_API_KEY` + `EMAIL_SENDER` | e-mails patients (+ SMS) | si espace patient |
| `ALMA_API_KEY` / `KLARNA_*` | paiement en plusieurs fois | si activé |

## Checklist avant ouverture au public

- [ ] Hébergement **HDS** pour back + base (cf. `HDS-RGPD.md`)
- [ ] **HTTPS** actif + nom de domaine
- [ ] `JWT_SECRET` fort, `GEMINI_API_KEY` **régénérée**
- [ ] Volume de base **chiffré** + **sauvegardes** automatiques
- [ ] Pages légales (CGU, confidentialité, mentions) + **consentement RGPD** (déjà dans l'app)
- [ ] Brevo : domaine vérifié (SPF/DKIM) pour l'expéditeur e-mail
- [ ] Test bout-en-bout sur **mobile** (QR + dépôt patient)

## Note base de données

SQLite (un fichier sur volume) convient à un démarrage mono-instance. Pour monter en charge /
haute dispo (plusieurs instances), prévoir une migration vers **PostgreSQL managé HDS** — voir la
section dédiée de `HDS-RGPD.md`.
