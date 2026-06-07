# Tableau de Garanti — API backend

API REST (Node + Express + SQLite) pour l'application Tableau de Garanti :
comptes cabinets, persistance des devis, collecte des leads du site marketing.

## Prérequis

- Node.js ≥ 18 (testé avec Node 22)

## Démarrer

```bash
cd server
npm install
cp .env.example .env   # optionnel : adapter PORT, JWT_SECRET, CORS_ORIGIN
npm run dev            # démarrage avec rechargement (http://localhost:4000)
```

La base SQLite est créée automatiquement dans `server/data/tableau-de-garanti.db`
au premier démarrage. Pour repartir d'une base vierge, supprimez le dossier `data/`.

## Variables d'environnement

| Variable      | Défaut                   | Rôle                              |
| ------------- | ------------------------ | --------------------------------- |
| `PORT`        | `4000`                   | Port d'écoute                     |
| `JWT_SECRET`  | `dev-secret-change-me`   | Secret de signature des JWT       |
| `CORS_ORIGIN` | `http://localhost:5173`  | Origine autorisée (frontend Vite) |
| `DB_PATH`     | `data/tableau-de-garanti.db` | Chemin du fichier SQLite      |

## Endpoints

| Méthode  | Route                | Auth | Description                                  |
| -------- | -------------------- | ---- | -------------------------------------------- |
| `GET`    | `/api/health`        | —    | Test de disponibilité                        |
| `POST`   | `/api/auth/register` | —    | Crée un compte cabinet, renvoie un JWT       |
| `POST`   | `/api/auth/login`    | —    | Connexion, renvoie un JWT                    |
| `GET`    | `/api/devis`         | ✅   | Liste les devis du cabinet courant           |
| `GET`    | `/api/devis/:id`     | ✅   | Détail d'un devis                            |
| `POST`   | `/api/devis`         | ✅   | Enregistre un devis                          |
| `DELETE` | `/api/devis/:id`     | ✅   | Supprime un devis                            |
| `POST`   | `/api/leads`         | —    | Enregistre une demande de démo (public)      |
| `GET`    | `/api/leads`         | ✅   | Liste les leads (back-office)                |
| `POST`   | `/api/patient-requests`     | ✅ | Crée une invitation patient (renvoie un token) |
| `GET`    | `/api/patient-requests`     | ✅ | Liste les invitations du cabinet             |
| `DELETE` | `/api/patient-requests/:id` | ✅ | Supprime une invitation                      |
| `GET`    | `/api/public/invite/:token` | — | Infos de l'invitation (page patient)         |
| `POST`   | `/api/public/invite/:token` | — | Le patient transmet ses garanties (public)   |

L'authentification se fait par en-tête `Authorization: Bearer <token>`.

## Sécurité

- Mots de passe hachés avec bcrypt.
- Validation des entrées avec Zod.
- Les devis sont strictement cloisonnés par cabinet (`cabinet_id`).

> Pour la production : changer `JWT_SECRET`, servir en HTTPS, et héberger les
> données de santé chez un hébergeur certifié HDS (voir business plan).
