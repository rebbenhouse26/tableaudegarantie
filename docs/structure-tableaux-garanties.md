# Comment lire un tableau de garanties mutuelle (notes de recherche)

Synthèse issue de l'analyse de tableaux réels (ex. Harmonie Mutuelle) et du référentiel de
lisibilité UNOCAM/CTIP/FNMF (engagement du 14 février 2019, en vigueur depuis le 1ᵉʳ janvier 2020).
Sert de base à l'extraction automatique (`app/src/domain/ocr.ts`).

## 1. Structure standardisée en 5 sections

Depuis l'engagement lisibilité, les tableaux présentent les garanties sous **5 grandes sections**
aux libellés harmonisés, dans cet ordre fréquent :

1. **Hospitalisation**
2. **Soins courants** (consultations, analyses, imagerie, pharmacie…)
3. **Dentaire**
4. **Optique**
5. **Aides auditives**

➡️ Pour notre besoin, il faut **isoler le bloc « Dentaire »** : entre le titre `DENTAIRE`
(souvent en majuscules, parfois suivi de « suite » sur la page suivante) et le titre de la
section suivante (`OPTIQUE`, `AIDES AUDITIVES`…).

## 2. Disposition en colonnes

Format standardisé le plus répandu — 3 colonnes de valeurs :

| Libellé du poste | **AMO** | **AMC** | **TOTAL** | Précisions |
|---|---|---|---|---|
| (Assurance Maladie Obligatoire = Sécu) | (Assurance Maladie Complémentaire = mutuelle) | (AMO + AMC) | (notes) |

- La part **mutuelle** est la colonne **AMC**. Le **TOTAL** = AMO + AMC.
- Détection robuste : **par les en-têtes** (`(AMO)`, `(AMC)`, `TOTAL`, ou
  `Régime obligatoire` / `Complémentaire`), pas par des positions X fixes (elles varient).

Autres formats rencontrés hors standard : plusieurs **formules/niveaux** en colonnes
(`Formule 1 | Formule 2 | …`, `Niveau 1…4`, `S | S1 | S2 | S3`, `Éco | Confort | Premium`). Les
montants **croissent vers la droite** (plus la garantie est élevée, plus la colonne est à droite).
Dans ce cas : on lit par défaut la **colonne la plus à droite** (garantie la plus élevée) et on
**laisse l'utilisateur choisir** la colonne correspondant au contrat du patient.

Implémentation : quand les en-têtes ne sont pas lisibles par l'OCR, les colonnes sont
**reconstruites en regroupant la position X des montants** dans les lignes dentaires (robuste). Un
en-tête de section (« DENTAIRE ») se distingue d'une ligne de contenu (« Soins dentaires 100 %… »)
par l'**absence de montant**.

## 3. Postes dentaires et libellés réels

Libellés observés dans la section dentaire (à mapper sur nos 5 postes) :

| Notre poste | Libellés rencontrés | Expression typique |
|---|---|---|
| `prothese` | « Prothèses dentaires », « Autres soins prothétiques et prothèses dentaires », « Inlays onlays », « Inlay cores », « Couronne », « Bridge » | % B.R. (ex. TOTAL 200%) ou forfait € |
| `implant` | « Implants dentaires », « Implantologie » | Forfait € / an (ex. 250 €) — souvent **non remboursé AMO** |
| `paro` | « Parodontologie », « Surfaçage » | Forfait € / an (ex. 150 €) |
| `ortho` | « Orthodontie remboursée par l'A.M.O. », « Orthodontie » (enfants < 18 ans) | % B.R. (ex. 300%) **ou** forfait €/semestre (ex. 387 €) |
| `esthetique` | « Blanchiment », « Facettes » | Forfait € (souvent absent) |

Sous-distinctions fréquentes : **100 % Santé** (→ « Frais réels », reste à charge 0),
**panier à honoraires maîtrisés**, **panier à honoraires libres**, **actes non remboursés par
l'A.M.O.** (forfaits).

## 4. Formats de valeurs

- **% de la base** : `60% B.R.`, `200% B.R.`, `% BRSS`, `% de la base de remboursement`.
  ⚠️ Le **TOTAL** inclut déjà la part Sécu (notre modèle `pct` représente ce total).
- **Forfait** : `250 €`, `387 €`, parfois `par an` / `par semestre` / `par dent`.
- **Combiné** : `200% + 200 €`.
- **Valeurs spéciales** : `Néant` (0), `Frais réels`, `—`.
- **« 100 % Santé »** : ne pas confondre avec une garantie « 100 % » (c'est un panier reste à
  charge zéro).

## 5. Conséquences pour l'extraction (implémentation)

1. **PDF numérique** → utiliser la couche texte de pdf.js (`getTextContent`) : tokens avec
   coordonnées, exact et rapide, **sans OCR**.
2. **Image / PDF scanné** → OCR Tesseract avec **bounding boxes par mot** (`data.words`).
3. Reconstituer **lignes** (regroupement par Y) et **colonnes** (en-têtes AMO/AMC/TOTAL ou
   formules).
4. **Isoler la section dentaire** (titre `DENTAIRE` → section suivante).
5. Lire la **bonne colonne** : `TOTAL` par défaut pour le format standard ; sinon proposer le
   **choix de la formule** à l'utilisateur.
6. Mapper chaque ligne dentaire sur l'un des 5 postes et **toujours laisser le cabinet vérifier**
   (étape 2).

## Variété réelle observée (5 tableaux analysés)

Cas rencontrés sur de vrais tableaux — encodés dans le prompt d'extraction par vision
(`server/src/routes/extract.ts`) :

| Tableau | Colonnes | Particularités dentaires |
|---|---|---|
| Formule Essentielle / **Renforts** | 2, dont un **add-on** (`+50 % BRSS`, `+200 €/an`) | Renfort à **cumuler** avec la base |
| Base / +Option 1 / +Option 2 | 3 (% total y compris RO) | Dentaire en page 2 (ici absente) |
| Ociane Matmut | **6** (Hospi Plus, Évolution 1→4) | **Forfaits par dent** ; couronne **molaire ≠ hors molaire** ; bridge en % |
| APRIL | **1** (mise en page « libellé \| garantie ») | Implant **1500 €/implant (max 3/an)** ; paro **320 €/an** ; prothèses 480 % BR |
| (photo) Nature/Prestations | 1 | Prothèses **440 % BR** ; inlay-core 210 % ; **tiered** « 100 % FR < 350 % BR + 50 % 350–500 % » |

Règles d'extraction qui en découlent :
- **Add-on** (Renforts/Option) → renvoyer des colonnes **cumulées** avec la valeur effective.
- **Forfaits** : « par dent / par implant / par an / par semestre » → garder le montant € ; capter
  les limites (« limité à N/an ») comme plafond.
- **Couronne molaire ≠ hors molaire** → prendre une valeur représentative (hors molaire).
- **% FR / % BR / % BRSS / % BRR** → tous traités en `pct` (% de la base, total incluant le RO).
- **Tiered** (« 100 % FR < 350 % BR + 50 % entre 350–500 % ») → prendre le **% maximal** couvert.
- **100 % Santé / Remboursement intégral / PEC intégrale** → panier reste à charge 0, pas une valeur.
- Mise en page **mono-colonne** (libellé | garantie) → 1 seule colonne renvoyée.

## Sources
- [UNOCAM — Lisibilité des garanties](https://unocam.fr/nos-actions/lisibilite-des-garanties/)
- [CTIP — Engagement pour la lisibilité de la complémentaire santé](https://ctip.asso.fr/la-prevoyance-collective/sante/engagement-pour-la-lisibilite-de-la-complementaire-sante/)
- [Mutualité Française — lisibilité des garanties](https://www.mutualite.fr/actualites/comment-les-complementaires-sante-ameliorent-la-lisibilite-des-garanties-des-contrats/)
- [Malakoff Humanis — comprendre le tableau de garanties](https://www.malakoffhumanis.com/s-informer/sante/complementaire-sante-comprendre-tableau-de-garanties/)
- Exemple réel analysé : tableau de garanties Harmonie Mutuelle (format AMO / AMC / TOTAL).
