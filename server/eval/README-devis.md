# Éval extraction des DEVIS dentaires

Même démarche que l'éval des tableaux de garanties (`README.md` / `run.ts`), appliquée aux **devis**.
But : mesurer et fiabiliser l'extraction par vision (`geminiExtractDevis` + `DEVIS_PROMPT`),
en particulier le bug n°1 — **lire le bon montant d'honoraires** (et non une colonne de remboursement),
le **code CCAM**, et le **poste** (soins / prothèse / implant…).

## Lancer

```bash
cd server
export GEMINI_API_KEY=...        # ou via server/.env
npm run eval:devis
```

Le script (`devis.run.ts`) :
1. lit `groundtruth.devis.json` (vérité terrain, une entrée par devis) ;
2. envoie chaque image de `devis-images/` à Gemini ;
3. apparie les lignes extraites aux lignes attendues (priorité au **code CCAM** puis aux **honoraires**) ;
4. mesure : honoraires lus, codes CCAM, postes corrects, + lignes en trop (faux positifs).
   Retry x3 (les `fetch failed` réseau sont transitoires).

## Jeu de données (`devis-images/`)

Devis publics réels / officiels collectés sur le web, couvrant des actes variés :

| Fichier | Source | Actes couverts |
|---|---|---|
| `ribe-couronne-implant.png` | cabinet-ribe.fr | infrastructure implantaire (HBLD012) + couronne sur implant (HBLD418) |
| `ribe-pta-novalocs.png` | cabinet-ribe.fr | PA sur 4 attachements Novaloc (LBLD193) + résine (HBLD031) + LBQP001 |
| `ribe-pta-optilocs.png` | cabinet-ribe.fr | PA sur 4 attachements Optiloc (LBLD193) + résine + LBQP001 |
| `ribe-pta-barre.png` | cabinet-ribe.fr | PA sur barre d'Ackermann (LBLD034) + résine + LBQP001 |
| `ribe-bridge-full-zircone.png` | cabinet-ribe.fr | full-arch : infrastructure (HBLD005) + barre (LBLD034) + 12 couronnes zircone |
| `devis-officiel-alternatives.png` | information-dentaire.fr (devis conventionnel officiel) | couronnes panier sans RAC / RAC modéré + transitoires (HBLD038/490/073/724) |

PDF sources d'origine conservés dans `devis-src/` (provenance / reproductibilité).
Rendu PDF→PNG via `pdf-to-png-converter` (cf. `/tmp/pdfx/render.mjs`).

## Résultat actuel

```
Devis testés : 6 · lignes attendues : 29
  Honoraires lus correctement : 29/29 (100 %)  ← critère principal
  Codes CCAM corrects         : 29/29 (100 %)
  Postes (cat) corrects       : 29/29 (100 %)
  Lignes en trop (faux positifs) : 0
```

Note méthodo : la vérité terrain se lit sur la **cotation CCAM imprimée** (colonne « Cotation CCAM,
NGAP ou acte HN »), jamais d'après le libellé. Ex. l'attachement Novaloc/Optiloc est coté **LBLD193**
(« acte HN ») et non LBLD010 — c'est le code affiché qui fait foi. Les codes implanto confirmés sur
aideaucodage.fr ont été ajoutés à la table de référence du `DEVIS_PROMPT` (LBLD010/034/193, HBLD418,
HBLD012/013/005, LBQP001).

## Ajouter un cas

1. Déposer l'image du devis dans `devis-images/` (PNG/JPG/PDF).
2. Ajouter une entrée dans `groundtruth.devis.json` :
   ```json
   {
     "file": "mon-devis.png",
     "source": "Cabinet X — couronne + bridge",
     "expected": [
       { "code": "HBLD634", "cat": "prothese", "dent": "11", "prix": 500, "panier": "rac0" }
     ]
   }
   ```
3. `npm run eval:devis`.
