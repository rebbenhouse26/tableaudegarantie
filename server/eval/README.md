# Harnais d'évaluation de l'extraction

Mesure objectivement la qualité de l'extraction par vision (Gemini) sur de vrais tableaux,
poste par poste — pour **itérer méthodiquement** sur le prompt (`src/lib/geminiVision.ts`).

## Utilisation

1. Déposer les images dans `eval/images/` (noms = champ `file` de `groundtruth.json`).
2. Renseigner la vérité-terrain dans `groundtruth.json` (la **colonne la plus élevée** de chaque
   tableau). Quatre cas réels sont déjà fournis comme exemples.
3. Lancer :
   ```bash
   export GEMINI_API_KEY=...        # clé Google AI Studio
   # export GEMINI_MODEL=gemini-2.0-flash   # optionnel
   npm run eval
   ```

Sortie : pour chaque tableau, le nombre de postes corrects et les écarts ; puis un score global.

## Méthode d'amélioration (la « boucle »)

1. Ajouter vos ~100 tableaux (images **anonymisées**) + leur correction dans `groundtruth.json`.
2. `npm run eval` → score de référence.
3. Ajuster le **prompt** (`src/lib/geminiVision.ts`) sur les écarts récurrents (ajouter des règles
   ou des exemples few-shot).
4. Relancer `npm run eval` → vérifier que le score monte sans régression.

> ⚠️ Données de santé : utiliser des tableaux **anonymisés** pour le dataset. `eval/images/` est
> ignoré par git.
