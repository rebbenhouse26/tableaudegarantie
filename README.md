# Tableau de Garanti

> Le copilote financier du devis dentaire — un SaaS qui lit les garanties mutuelle des patients,
> estime leur remboursement et clarifie leur reste à charge avant le rendez-vous.

Projet construit à partir des documents de cadrage présents à la racine :

- `Business_Plan_Tableau_de_Garanti.docx` — vision, marché, modèle économique
- `Demo_MVP_Tableau_de_Garanti.html` — maquette du parcours produit
- `Site_Marketing_Tableau_de_Garanti.html` — maquette de la landing page

## Structure

```
.
├── app/                 # Frontend React + Vite + TypeScript (site + démo + espace cabinet)
│   ├── Dockerfile       # build Vite → service nginx (+ reverse-proxy /api)
│   └── nginx.conf
├── server/              # API Node + Express + SQLite (auth, devis, leads, invitations)
│   └── Dockerfile
├── docker-compose.yml   # lance frontend + backend en une commande
└── docs/                # notes de recherche (structure des tableaux de garanties)
```

Chaque dossier a son propre `README.md` détaillé.

## Déploiement avec Docker (recommandé)

Tout l'applicatif (frontend + backend) se lance en **une commande**. Prérequis : Docker + Docker
Compose.

```bash
cp .env.example .env        # optionnel : changer JWT_SECRET
docker compose up --build
```

Puis ouvrir **http://localhost:8080**.

- Le **frontend** (nginx) sert l'app et **reverse-proxy `/api`** vers le backend : même origine côté
  navigateur, donc aucun souci de CORS.
- Le **backend** persiste la base SQLite dans un volume Docker (`tdg-data`) — les données survivent
  aux redémarrages.
- Pour la production : définir un `JWT_SECRET` long et aléatoire, servir derrière HTTPS, et héberger
  les données de santé chez un hébergeur **certifié HDS** (cf. business plan).

Arrêter : `docker compose down` (ajouter `-v` pour effacer aussi la base).

## Déploiement cloud

Pour les hébergeurs (PaaS), une **image de production combinée** unique ([`Dockerfile`](Dockerfile)
à la racine) regroupe le frontend (nginx) et le backend (Node + SQLite) : nginx sert la SPA et
reverse-proxy `/api` en interne, le port public s'adapte à `$PORT`. Une seule URL, pas de CORS.

> ⚠️ SQLite ⇒ **une seule instance** + un disque persistant. Ne pas répliquer sur plusieurs
> machines. Pour monter en charge, prévoir une bascule vers PostgreSQL.

### Fly.io
```bash
fly launch --no-deploy                      # crée l'app à partir de fly.toml
fly volumes create tdg_data --size 1
fly secrets set JWT_SECRET=$(openssl rand -hex 32)
fly deploy
```
Le volume `tdg_data` est monté sur `/api/data` (cf. [`fly.toml`](fly.toml)).

### Render
New ▸ **Blueprint** ▸ pointer ce dépôt : Render lit [`render.yaml`](render.yaml) (service web
Docker + disque pour SQLite, `JWT_SECRET` généré automatiquement). Le disque persistant requiert au
moins le plan *starter*.

### Railway
Nouveau projet ▸ *Deploy from repo* : Railway détecte le `Dockerfile` racine. Ajouter un **volume**
monté sur `/api/data` et la variable `JWT_SECRET`.

### VPS (Docker Compose + HTTPS)
Sur un serveur Ubuntu avec Docker : `docker compose up -d --build`, puis placer un reverse-proxy
**Caddy** devant pour le TLS automatique :
```caddyfile
votre-domaine.fr {
    reverse_proxy localhost:8080
}
```
(Caddy gère Let's Encrypt automatiquement.)

### Construire/lancer l'image combinée en local
```bash
docker build -t tableau-de-garanti .
docker run -p 8080:80 -v tdg:/api/data -e JWT_SECRET=dev tableau-de-garanti
# → http://localhost:8080
```

## CI/CD (GitHub Actions)

Deux workflows dans [`.github/workflows`](.github/workflows) :

- **[ci.yml](.github/workflows/ci.yml)** — à chaque push / pull request sur `main` :
  build du frontend, typecheck du backend, et **build de l'image Docker combinée** (valide le
  `Dockerfile` de bout en bout sur le runner).
- **[deploy-fly.yml](.github/workflows/deploy-fly.yml)** — déploie sur Fly.io à chaque push sur
  `main` (ou manuellement). Inactif tant que le secret n'est pas présent (aucun échec).
  Pour l'activer :
  1. `fly tokens create deploy` → copier le jeton.
  2. GitHub ▸ *Settings* ▸ *Secrets and variables* ▸ *Actions* ▸ **New repository secret** →
     nom `FLY_API_TOKEN`.

> **Render** se déploie automatiquement à chaque push (intégration native via le Blueprint) — aucun
> workflow n'est nécessaire de ce côté.

## Démarrage rapide (sans Docker, pour le développement)

Ouvrir **deux terminaux**.

**1. API backend**

```bash
cd server
npm install
npm run dev      # http://localhost:4000
```

**2. Frontend**

```bash
cd app
npm install
npm run dev      # http://localhost:5173
```

Puis ouvrir http://localhost:5173.

> ℹ️ Node.js a été installé localement dans `~/.local/node/`. Si `node` n'est pas trouvé,
> exécuter d'abord : `export PATH="$HOME/.local/node/bin:$PATH"`.

## Parcours de test

**A. Démo directe au cabinet**
1. Page d'accueil → **Connexion** → *Créer un compte* cabinet.
2. **Essayer la démo** → à l'étape 1, soit **importer une photo/PDF** d'un tableau de garanties
   (extraction OCR automatique), soit choisir une mutuelle de démo.
3. Étape 2 : **vérifier / corriger** les garanties extraites (elles pilotent le calcul).
4. Étape 3 : construire le plan de traitement (reste à charge calculé en direct).
5. Étape 4 : saisir le nom du patient → **Télécharger le PDF** et/ou **Enregistrer le devis**.
6. **Espace cabinet** : retrouver le devis enregistré, régénérer son PDF.

**B. Pré-remplissage par le patient (avant le rendez-vous)**
1. Espace cabinet → **Invitations patients** → *Créer un lien patient* (le lien est copié).
2. Ouvrir ce lien (`/patient/:token`, comme le ferait le patient sur son téléphone) →
   **téléverser ses garanties** → l'OCR extrait → **Transmettre à mon cabinet**.
3. De retour dans l'espace cabinet, l'invitation passe à **Reçu** → *Construire le devis*
   ouvre l'app **pré-remplie** avec les garanties du patient, prête avant le rendez-vous.

> L'OCR utilise Tesseract.js : au premier usage, les données de langue sont téléchargées depuis
> un CDN (connexion internet requise).

## Extraction des tableaux et devis : modèle de vision (Gemini)

L'analyse des **tableaux de garanties** et des **devis** (image/PDF) se fait **uniquement par modèle
de vision (Gemini)**, côté **serveur** : le modèle lit le document et renvoie des données
structurées (garanties par niveau/formule S1/S2/S3… ; actes du devis avec code CCAM et honoraires).
C'est nettement plus robuste qu'un OCR classique sur des mises en page variées.

**Indispensable** : définir `GEMINI_API_KEY` (clé [Google AI Studio](https://aistudio.google.com/apikey))
côté serveur (`server/.env` ou variable d'environnement / secret de déploiement). Modèle par défaut :
`gemini-2.5-flash` (configurable via `GEMINI_MODEL`). Sans clé, l'import affiche un message
explicite et les garanties/actes sont à saisir manuellement. Statut : `GET /api/extract/status`.

> Si l'analyse échoue (clé absente, quota free-tier 429…), l'app **n'invente pas** de montants : elle
> le signale. Pour un usage fiable, activer la **facturation** sur le projet Google.

> ⚠️ **Donnée de santé** : envoyer les tableaux patients à une API externe impose, en production,
> un cadre **HDS/RGPD** (DPA avec le fournisseur). Pour constituer un jeu de test, utiliser des
> tableaux **anonymisés**.

## Avertissement

Les mutuelles, actes et montants sont **fictifs** et illustratifs. Les estimations sont
**non contractuelles**. Une mise en production manipulant de vraies données de santé nécessite un
hébergement certifié HDS et la conformité RGPD (voir le business plan).
