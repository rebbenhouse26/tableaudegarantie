# Tableau de Garanti

> Le copilote financier du devis dentaire — estimation du reste à charge avant le rendez-vous.

Application web (React + Vite + TypeScript) construite à partir des maquettes du dossier projet
(business plan, démo MVP HTML, site marketing). Elle réunit en une seule app :

- **La landing page marketing** (`/`) — présentation du produit, problème, fonctionnement, tarifs,
  formulaire de demande de démo (les leads sont envoyés à l'API).
- **La démo interactive** (`/app`) — le parcours en 4 étapes :
  1. Le patient transmet ses garanties : **import d'une photo/PDF analysé par IA de vision (Gemini)**
     ou sélection d'une mutuelle fictive
  2. Vérification des garanties extraites dans un **éditeur** (la « vérification humaine » :
     les valeurs corrigées pilotent réellement le calcul)
  3. **Import du devis** (photo/PDF) : extraction automatique des actes et montants **par IA de
     vision** (Gemini), rattachés à la **base CCAM** (libellé/code), table éditable
     (variante/prix/quantité)
  4. **Synthèse garanties × devis** : reste à charge calculé, et **devis optimisé** qui propose pour
     chaque acte la variante minimisant le reste à charge (100 % Santé → RAC 0 quand applicable) —
     informatif, sans dégrader un soin justifié. **Export PDF** et **enregistrement**.
- **L'espace cabinet** (`/connexion`, `/cabinet`) — création de compte, connexion (JWT),
  liste des devis enregistrés, régénération du PDF, suppression, et **invitations patients**
  (générer un lien à envoyer avant le RDV).
- **La page patient** (`/patient/:token`) — page publique où le patient **téléverse ses garanties
  avant le rendez-vous** ; le cabinet les retrouve dans son espace, prêtes à l'emploi.

> Le frontend a besoin de l'**API backend** (dossier `../server`) pour l'authentification, la
> persistance des devis et l'envoi des leads. Voir `../server/README.md`. L'URL de l'API se
> configure via `VITE_API_URL` (voir `.env.example`).

> ⚠️ **Données fictives.** Mutuelles, actes et montants sont illustratifs. Les estimations sont
> non contractuelles et destinées à la démonstration.

## Prérequis

- Node.js ≥ 18 (testé avec Node 22)

## Démarrer

```bash
cd app
npm install
npm run dev      # serveur de développement (http://localhost:5173)
```

## Autres commandes

```bash
npm run build    # vérification des types + build de production (dossier dist/)
npm run preview  # prévisualiser le build de production
npm run lint     # vérification TypeScript (tsc --noEmit)
```

## Architecture

```
app/
├── index.html
├── src/
│   ├── main.tsx              # point d'entrée + routing (react-router)
│   ├── index.css             # design tokens & styles partagés
│   ├── pages/
│   │   ├── LandingPage.tsx   # site marketing
│   │   ├── DemoApp.tsx       # parcours en 4 étapes
│   │   ├── Login.tsx         # connexion / création de compte cabinet
│   │   └── Dashboard.tsx     # espace cabinet : devis enregistrés
│   ├── auth/AuthContext.tsx  # contexte d'authentification (JWT en localStorage)
│   ├── api/                  # client HTTP + types de l'API
│   ├── pdf/rapport.ts        # génération du rapport patient en PDF (jsPDF)
│   └── domain/               # logique métier (sans UI, typée)
│       ├── types.ts          # types du domaine
│       ├── mutuelles.ts      # catalogue de mutuelles (données fictives)
│       ├── actes.ts          # catalogue d'actes dentaires
│       ├── garanties.ts      # helpers sur les garanties par poste
│       ├── actes.ts          # référence CCAM (codes, bases, taux) + matcher de devis
│       ├── devisOcr.ts       # rattachement des lignes de devis (IA) à la référence CCAM
│       ├── calcul.ts         # moteur de calcul Sécu / mutuelle / reste à charge (+ règle 100 % Santé)
│       └── optimisation.ts   # devis optimisé : variante minimisant le reste à charge
```

Le **moteur de calcul** (`domain/calcul.ts`) est isolé de l'UI : il croise un acte
(prix cabinet, BRSS, taux Sécu) avec un jeu de garanties par poste (% de la BRSS ou forfait
annuel) et applique les plafonds annuels, pour produire la part Sécu, la part mutuelle et le
reste à charge.

L'**extraction** (garanties et devis) se fait **uniquement par modèle de vision (Gemini)**, côté
serveur (`server/src/lib/geminiVision.ts`) :

- **Garanties** : Gemini isole la section dentaire, détecte les colonnes (niveaux/formules
  S1/S2/S3, AMO/AMC/TOTAL, Base+Options…) et renvoie les garanties par poste. L'utilisateur
  **choisit la colonne** du contrat (défaut : la plus élevée).
- **Devis** : Gemini renvoie les actes (libellé, **code CCAM**, honoraires, base) ; le client les
  rattache à la référence d'actes (`devisOcr.rawLinesToDevis`).
- En cas d'échec (clé absente, quota), l'app **affiche un message** et n'invente aucun montant.

C'est volontairement faillible : l'étape 2 impose la **vérification par le cabinet** (édition des
garanties / des lignes de devis) avant tout calcul.

## Prochaines étapes possibles

- Backend (comptes cabinets, authentification, persistance des devis et des leads)
- Extraction réelle des tableaux de garanties (OCR / IA) au lieu de la simulation
- Export PDF du rapport patient et intégrations de paiement (Alma, Stripe, GoCardless)
- Hébergement certifié HDS pour la conformité aux données de santé
```
