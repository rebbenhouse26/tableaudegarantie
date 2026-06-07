// Appel Gemini pour lire un tableau de garanties → garanties dentaires par niveau/formule.
// Réutilisé par la route HTTP (/api/extract) et par le harnais d'évaluation (eval/).

// Plafonds de la Sécurité sociale 2026 : PMSS = 4 005 €/mois, PASS = 48 060 €/an.
// Servent à convertir les garanties exprimées en « % du PMSS » ou « % du PASS » en forfait €.
export const PMSS = 4005
export const PASS = 48060

const GAR = {
  type: 'OBJECT',
  properties: {
    // "pmss"/"pass" = pourcentage du plafond (converti en forfait € côté serveur, voir normalizeGarantie).
    type: { type: 'STRING', enum: ['pct', 'forfait', 'pmss', 'pass'] },
    val: { type: 'NUMBER' },
    plafond: { type: 'NUMBER' },
  },
  required: ['type', 'val', 'plafond'],
}

/** Convertit une garantie « % PMSS / % PASS » en forfait € ; laisse les autres inchangées. */
function normalizeGarantie(g: VisionGarantie): VisionGarantie {
  const t = g && (g.type as string)
  if (t === 'pmss') return { type: 'forfait', val: Math.round((g.val / 100) * PMSS), plafond: g.plafond || 0 }
  if (t === 'pass') return { type: 'forfait', val: Math.round((g.val / 100) * PASS), plafond: g.plafond || 0 }
  return g
}

/** Applique la conversion PMSS→€ à toutes les colonnes d'un résultat garanties. */
function normalizeColumns(cols: VisionColumn[]): VisionColumn[] {
  const POSTES = ['soins', 'prothese', 'inlaycore', 'bridge', 'amovible', 'protheseNR', 'implant', 'paro', 'ortho', 'esthetique'] as const
  for (const c of cols) for (const p of POSTES) if (c[p]) c[p] = normalizeGarantie(c[p])
  return cols
}

export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    columns: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING' },
          soins: GAR,
          prothese: GAR,
          inlaycore: GAR,
          bridge: GAR,
          amovible: GAR,
          protheseNR: GAR,
          implant: GAR,
          paro: GAR,
          ortho: GAR,
          esthetique: GAR,
        },
        required: ['label', 'soins', 'prothese', 'inlaycore', 'bridge', 'amovible', 'protheseNR', 'implant', 'paro', 'ortho', 'esthetique'],
      },
    },
    defaultColumnIndex: { type: 'INTEGER' },
  },
  required: ['columns', 'defaultColumnIndex'],
}

export const PROMPT = `Tu es un expert des tableaux de garanties des complémentaires santé françaises.
On te fournit l'image (ou le PDF) d'un tableau de garanties.

OBJECTIF : extraire UNIQUEMENT la section DENTAIRE (ignore hospitalisation, soins courants/médicaux,
optique, aides auditives, cure, maternité, prévention…).

STRUCTURE DES TABLEAUX (très variable) :
- Lignes = postes ; colonnes = niveaux/formules du contrat. Plus la garantie est élevée, plus la
  colonne est à DROITE. Exemples de colonnes : "S/S1/S2/S3", "Niveau 1..4",
  "Base / Base+Option 1 / Base+Option 2", "Hospi Plus / Évolution 1..4", "Essentielle / Renforts".
- Certaines tables n'ont qu'UNE colonne (mise en page « libellé | garantie », tags "⊕ Confort"…).
  Renvoie alors 1 entrée.
- ⚠️ IGNORE la colonne de RÉFÉRENCE du Régime Obligatoire / Sécurité sociale : intitulés « Part S.S. »,
  « Part S.S. RG », « Régime obligatoire », « RO », « Sécu », « Base SS », « Remb. Sécu », « TM ».
  Ce n'est PAS une formule du contrat (c'est juste le rappel de ce que paie la Sécu) → ne la renvoie
  JAMAIS comme une colonne. Ne renvoie que les vraies formules de la complémentaire.
- Si CHAQUE formule est détaillée en 3 sous-colonnes « Sécu/RO | Mutuelle (AMC) | TOTAL », prends la
  valeur de la colonne TOTAL (Sécu + mutuelle, c'est le remboursement total).
- RÉSEAU DE SOINS : si un poste a deux valeurs « dans le réseau (Santéclair/Kalivia/Itelis/Sévéane…) »
  et « hors réseau », retiens la valeur HORS RÉSEAU (garantie applicable partout). « PEC intégrale /
  remboursement intégral réseau » n'est pas un chiffre → garde la valeur hors réseau.
- Colonnes "add-on" ("Renforts", "+Option", valeurs en "+X% BRSS" ou "+200 €") : ce sont des
  SUPPLÉMENTS à cumuler avec la base. Renvoie alors des colonnes CUMULÉES (base, puis base+renfort)
  avec la valeur EFFECTIVE totale de chaque niveau.

POUR CHAQUE COLONNE, mappe les lignes dentaires sur 7 postes :
- soins      : ligne « Soins dentaires » courants / consultations (souvent 100 % BR / 100 % FR /
               200 % BRSS). NE PRENDS PAS une ligne spécifique « soins d'obturation / inlay-onlay /
               overlay » comme valeur des soins : c'est une ligne à part, pas le taux soins de base.
- prothese   : = la COURONNE dento-portée (céramo-métallique, hors molaire), panier libre si le
               tableau distingue maîtrisé/libre (prends le LIBRE, la valeur la plus élevée). Si
               couronne molaire ≠ hors molaire, prends "hors molaire". C'est la valeur de référence
               des prothèses (sert de repli pour bridge/amovible si non distingués).
- bridge     : UNIQUEMENT si une ligne BRIDGE / prothèse plurale / pont a un taux PROPRE distinct des
               couronnes. Sinon { "type": "forfait", "val": 0, "plafond": 0 } (l'app reprend le taux
               couronne). Ne mets pas le taux couronne ici par défaut.
- amovible   : UNIQUEMENT si une ligne PROTHÈSE AMOVIBLE / dentier / stellite / appareil a un taux
               PROPRE distinct des couronnes. Sinon { "type": "forfait", "val": 0, "plafond": 0 }
               (repli sur le taux couronne).
- inlaycore  : UNIQUEMENT s'il existe une LIGNE DÉDIÉE dont l'intitulé contient EXACTEMENT
               "inlay-core" / "inlay core" / "reconstitution corono-radiculaire" / "faux moignon".
               → mets alors son pourcentage/forfait PROPRE (souvent différent, parfois plus bas que
               les prothèses : ex. inlay-core 210 % alors que prothèses 440 %).
               ⚠️ NE PAS CONFONDRE avec "inlay/onlay" (= "inlay-onlay", restauration/obturation, un
               SOIN) : « Inlay/onlay (par acte) », « Inlays-Onlays » ne sont PAS des inlay-core →
               ne mets JAMAIS leur valeur dans inlaycore (elle va dans soins ou prothese).
               S'il n'y a PAS de vraie ligne "inlay-core/faux moignon", mets { "type": "forfait",
               "val": 0, "plafond": 0 } : l'application appliquera automatiquement le taux "prothese".
               Ne recopie JAMAIS le taux prothèses ni le taux inlay/onlay dans inlaycore.
- protheseNR : PROTHÈSE NON REMBOURSÉE par la Sécu (= remboursée DIRECTEMENT par la mutuelle, sans
               part Sécu). Cherche une ligne « prothèses NON remboursées par le RO/SS/AMO »,
               « prothèses refusées », « couronne sur dent vivante », « bridge cantilever/à ailettes/
               provisoire ». C'est presque toujours un FORFAIT € (par an ou par acte) ou un % BRR.
               Mets ce montant ici. Si une telle ligne n'existe pas → { "type": "forfait", "val": 0,
               "plafond": 0 }. (Différent des prothèses remboursées SS qui vont dans "prothese".)
- implant    : implantologie / pose d'implant (souvent forfait € PAR IMPLANT, % PMSS, parfois non
               remboursé). Si AUCUN forfait/taux implant propre mais une ligne « couronne sur implant :
               X % BR » existe, reporte ce X % (type "pct") dans implant.
- paro       : parodontologie (forfait € / an, ou %). Parfois dans un forfait mutualisé
               "non remboursé : soins/ortho/paro = X €/an". ⚠️ Si la parodontologie est INCLUSE
               dans la ligne des soins (ex. « soins dentaires, parodontologie, prévention : 125 % »),
               reporte CE taux (125 %) aussi dans le poste paro — ne le laisse PAS à 0.
- ortho      : privilégie le taux de l'orthodontie REMBOURSÉE par la Sécu (souvent % BR, ou
               €/semestre). Un forfait « orthodontie NON remboursée par la Sécu » est SECONDAIRE :
               ne le mets pas dans ortho si un taux d'ortho remboursée existe.
- esthetique : blanchiment, facettes si présent.

VALEURS — chaque poste : { "type": "pct" | "forfait" | "pmss", "val": number, "plafond": number } :
- "pct"     = pourcentage de la BASE DE REMBOURSEMENT (% BR / BRSS / BRR / FR), TOTAL part Sécu incluse.
- Formule "tiered" (ex. "100 % FR jusqu'à 350 % BR + 50 % entre 350 et 500 %") → prends le
  POURCENTAGE MAXIMAL de base couvert (ici 500).
- "forfait" = montant en euros (par dent, par implant, par an ou par semestre — garde le montant €).
- "pmss"    = pourcentage du PMSS (Plafond MENSUEL de la Sécu = repère). Ex. « 20 % du PMSS ».
  Mets type "pmss", val = le POURCENTAGE (ex. 20). NE convertis PAS en euros (l'app le fait).
- "pass"    = pourcentage du PASS (Plafond ANNUEL de la Sécu). Ex. « 5 % du PASS ». type "pass",
  val = pourcentage. (Attention : « % PMSS/jour » ou « /nuit » concerne l'HOSPITALISATION, hors
  dentaire → ignore-le pour les postes dentaires.) Ne confonds jamais « % PMSS/PASS » avec « % BR ».
- ⚠️ BONUS FIDÉLITÉ / ANCIENNETÉ : ignore les majorations conditionnelles « Bonus Fidélité »,
  « dès la 2e année », « dès la 3e année », « après 24 mois » → prends la valeur de BASE (immédiate,
  1re année), PAS la valeur bonifiée. (Le patient peut ne pas avoir l'ancienneté requise.)
- FORFAIT GLOBAL PARTAGÉ : si UN SEUL montant couvre plusieurs postes (ex. « implantologie,
  parodontologie, orthodontie non remboursée : 800 €/an »), mets-le dans UN SEUL poste selon cet
  ORDRE de priorité STRICT : implant > protheseNR > paro > ortho. Le premier poste présent dans la
  liste reçoit le montant ; TOUS les autres postes de la liste = 0. Ex. « implanto, paro, ortho :
  800 € » → implant=800, paro=0, ortho=0 (sauf si une autre ligne donne un taux ortho remboursé).
- "plafond" = plafond annuel en € si indiqué ("limité à N/an", "X €/an"), sinon 0.
- ⚠️ Une ligne « Plafond annuel du poste dentaire » / « Plafond dentaire » (ex. 2 450 €) est un
  PLAFOND, PAS une garantie d'acte : ne la mets JAMAIS comme valeur d'implant/prothèse/etc. (mets-la
  éventuellement dans "plafond", mais jamais comme "val" d'un acte).
- ⚠️ NOTES DE BAS DE PAGE — TRÈS IMPORTANT : une valeur est souvent suivie d'un ASTÉRISQUE (*) ou
  d'un PETIT NUMÉRO en exposant ((1), (2), ¹, ², ⁽³⁾, "5)6)"…). Ces renvois pointent vers des notes
  en BAS DE PAGE. Tu DOIS les lire et en extraire toute LIMITE/PLAFOND, et la reporter :
    · plafond annuel en € ("limité à 1000 €/an", "dans la limite de X € par an et par bénéficiaire")
      → mets ce montant dans "plafond" du poste concerné.
    · limite en nombre ("limité à 2 implants/an", "6 semestres maximum") → traduis en plafond si c'est
      un forfait par unité (ex. implant 300 € limité à 2/an → implant {forfait,300,600}).
    · une note qui n'indique qu'une condition (OPTAM, délai de carence, parcours de soins) sans
      montant → n'affecte pas la valeur, mais NE l'ignore pas pour déterminer le bon chiffre.
  Si le plafond figure dans une note distincte ("Plafond dentaire annuel … (6)"), rattache-le au bon
  poste (prothèses le plus souvent). En cas de plafond dentaire GLOBAL, applique-le au poste prothèse.
- "100 % Santé" / "Remboursement intégral" / "PEC intégrale" / "100 % FR" = panier reste à charge 0 :
  ce n'est PAS une valeur chiffrée → n'écrase pas le poste avec ça.
- Poste non couvert / absent / "—" / "Néant" : { "type": "forfait", "val": 0, "plafond": 0 }.

"defaultColumnIndex" = index de la colonne de garantie la PLUS ÉLEVÉE (la plus à droite / base+toutes options).

EXEMPLES (extraits réels) :
- Ociane "Évolution 4" : soins 150 % ; couronne hors molaire 485 €/dent → prothese {forfait,485,0} ;
  implant/paro adulte 300 € → implant {forfait,300,0}, paro {forfait,300,0}.
- APRIL (1 colonne) : prothèses 480 % BR ; implant 1500 €/implant max 3/an → implant {forfait,1500,4500} ;
  paro 320 €/an → paro {forfait,320,320} ; ortho 350 % BR.
- MMA "Confort N3" (1 colonne) : soins {pct,200} ; prothese {pct,300} ; ortho {pct,200} ;
  paro {forfait,200,200} (forfait non-remboursé mutualisé) ; implant {forfait,0,0}.

Ne renvoie QUE du JSON conforme au schéma.`

export interface VisionGarantie {
  type: 'pct' | 'forfait'
  val: number
  plafond: number
}
export interface VisionColumn {
  label: string
  soins: VisionGarantie
  prothese: VisionGarantie
  inlaycore: VisionGarantie
  bridge: VisionGarantie
  amovible: VisionGarantie
  protheseNR: VisionGarantie
  implant: VisionGarantie
  paro: VisionGarantie
  ortho: VisionGarantie
  esthetique: VisionGarantie
}
export interface VisionResult {
  columns: VisionColumn[]
  defaultColumnIndex: number
}

/* ----------------------------- Devis (dentaire) ---------------------------- */

export const DEVIS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    lines: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING' },
          code: { type: 'STRING' },
          cat: { type: 'STRING', enum: ['soins', 'prothese', 'implant', 'paro', 'ortho', 'esthetique'] },
          // Panier de l'acte (100 % Santé / maîtrisé / libre) — lu sur le devis. STRING libre :
          // valeurs attendues "rac0" / "maitrise" / "libre" ou "" (pas d'enum : Gemini refuse "").
          panier: { type: 'STRING' },
          dent: { type: 'STRING' },
          prix: { type: 'NUMBER' },
          brss: { type: 'NUMBER' },
          secu: { type: 'NUMBER' },
          qty: { type: 'INTEGER' },
        },
        required: ['label', 'cat', 'prix', 'qty'],
      },
    },
  },
  required: ['lines'],
}

export const DEVIS_PROMPT = `Tu es un expert des devis dentaires français (devis conventionnel).
On te fournit l'image (ou le PDF) d'un DEVIS dentaire.

OBJECTIF : extraire la liste des ACTES proposés, un par ligne.

MÉTHODE PRIORITAIRE — LA COTATION D'ABORD : sur un devis, chaque acte porte un CODE CCAM (colonne
« Cotation »/« Code »/« CCAM »). C'est le moyen le plus fiable et le plus rapide d'identifier l'acte
(comme sur aideaucodage.fr). Pour CHAQUE ligne : 1) lis le code CCAM, 2) déduis l'acte et le poste
DU CODE en priorité (voir la table ci-dessous), 3) n'utilise le libellé que pour confirmer. Si le
code et le libellé divergent, LE CODE PRIME.

TABLE DE RÉFÉRENCE CCAM DENTAIRE (cotation → acte) :
- Couronnes (poste prothese) : HBLD036 (céramométallique), HBLD038 (métallique), HBLD634, HBLD033,
  HBLD163, HBLD403, HBLD486, HBLD490, HBLD418 (couronne SUR IMPLANT).
- Inlay-core / faux moignon (poste prothese, ligne « inlay-core ») : HBLD007 (sans clavette),
  HBLD261 (avec clavette). NE PAS confondre avec inlay/onlay (HBMD… = soin).
- Bridge / prothèse plurale (poste prothese) : HBLD040, HBLD043, HBLD023, HBLD425, HBLD785, HBLD198.
- IMPLANTOLOGIE — distingue le CHIRURGICAL (poste implant) du PROTHÉTIQUE sur implant (poste prothese) :
    · poste "implant" : LBLD010 (pose de 2 implants), LBLD034 (barre de conjonction entre implants),
      LBLD193 (attachement bouton-pression/locator type Novaloc/Optiloc — souvent « acte HN »).
    · poste "prothese" : HBLD418 (couronne SUR implant) ; HBLD012/017/021/013/005 (infrastructure/pilier
      sur 1/2/3/4/5 implants) ; HBLD031/477 (prothèse amovible posée sur les attachements).
    · poste "soins" : LBQP001 (enregistrement des rapports maxillo-mandibulaires).
  ⚠️ La colonne cotation peut indiquer « acte HN » (hors nomenclature) : recopie quand même le code EXACT affiché.
- STELLITE = châssis métallique (prothèse partielle métallique, PAS résine) : HBLD131 (1-3 dents),
  HBLD332 (4), HBLD452 (5), HBLD474 (6), HBLD075 (7), HBLD470 (8), HBLD435 (9), HBLD203 (11 dents).
- Prothèse amovible RÉSINE : HBLD477 (complète), HBLD031, HBLD039 (résine 3-10 dents).
- Provisoire / NON remboursé : HBLD037 (couronne transitoire), HBLD034 (bridge provisoire).
- Soins : HBJD001 (détartrage), HBFD… (endodontie), HBGD… (extraction), HBMD05… (composite),
  HBMD043/046/055 (inlay/onlay).
⚠️ Donc un code en HBLD131/332/452/474/075/470/435/203 = STELLITE (métallique), JAMAIS « résine »,
même si le libellé dit seulement « prothèse amovible ».

Pour chaque acte :
- "label"  : libellé de l'acte (ex. "Couronne céramo-métallique", "Implant", "Inlay-core",
             "Détartrage", "Bridge", "Extraction", "Surfaçage").
- "code"   : ⚠️ TRÈS IMPORTANT — lis et renvoie TOUJOURS la COTATION / code CCAM de la ligne s'il est
             visible (colonne « Cotation », « Code », « CCAM » ; ex. HBLD634, HBLD036, HBLD007,
             HBLD367, HBLD040…). La cotation est la source la plus fiable pour identifier l'acte —
             ne te fie pas qu'au libellé. Recopie le code EXACT, sinon "".
- "cat"    : poste, parmi : "soins" (soins/inlay-onlay), "prothese" (couronne, bridge, inlay-core,
             prothèse amovible/stellite, "Cou", "Cour", "céra-mét", "PAM"), "implant", "paro",
             "ortho", "esthetique". ⚠️ Une prothèse MÉTALLIQUE / châssis / STELLITE (partielle
             métallique) n'est PAS une prothèse en RÉSINE : distingue-les (le matériau et la cotation
             diffèrent). En cas de doute, fie-toi à la cotation CCAM.
             ⚠️ IMPLANTS — ne mets "implant" QUE pour la POSE du fixture (racine titane) et les
             SYSTÈMES DE CONNEXION amovibles (barre de conjonction, locator, novaloc, bouton-pression,
             attachement). Les ÉLÉMENTS PROTHÉTIQUES portés par un implant — couronne sur implant,
             bridge sur implant, infrastructure / pilier / faux-moignon coronaire sur implant — sont
             du poste "prothese" (ils sont remboursés comme une prothèse), PAS "implant".
- "panier" : panier de prise en charge de l'acte prothétique, à LIRE sur le devis (colonne
             « Panier », « Classe », « Type de prise en charge » ou mention sur la ligne) :
               · "rac0"     = panier « 100 % Santé » / « RAC 0 » / « sans reste à charge » /
                              « panier 1 » / « classe à remboursement renforcé » / dépassement = 0.
               · "maitrise" = « tarif/honoraires maîtrisés » / « panier modéré » / « panier 2 ».
               · "libre"    = « tarif libre » / « honoraires libres » / « panier 3 ».
             Si le devis n'indique aucun panier, mets "". ⚠️ NE DEVINE PAS d'après le prix : lis la
             mention écrite. Une couronne sur incisive/canine (dents 11,12,13,21,22,23,31,32,33,41,
             42,43) marquée « 100 % Santé » → "rac0" (reste à charge nul), pas "maîtrisé".
- "dent"   : numéro(s) de dent si indiqué (ex. "26", "14-15"), sinon "".
- "prix"   : HONORAIRES facturés au patient pour l'acte. PRENDS la colonne "Honoraires",
             "Honoraires dont prix de vente", "Montant", "Prix", ou "Total" de la ligne.
             NE PRENDS JAMAIS : "Honoraires limite de facturation", "Base de remboursement",
             "Montant remboursé", "Montant NON remboursé", "Remboursement Sécu/AMO", "Remboursement
             mutuelle". En cas de doute entre plusieurs colonnes de montants, prends les
             HONORAIRES / prix de vente (le tarif demandé par le cabinet) — JAMAIS un montant de
             remboursement. Reproduis le montant TEL QUEL, ne le divise JAMAIS.
- "brss"   : base de remboursement Sécu (colonne "Base de remboursement" / "Base Sécu") si présente, sinon 0.
- "secu"   : montant REMBOURSÉ par la Sécu/AMO (colonne "Montant remboursé Assurance Maladie" /
             "Rembours. Sécu") si présent sur le devis, sinon 0. (NE PAS confondre avec "Rembours.
             Mutuelle" ni avec "Montant non remboursé".)
- "qty"    : 1 par défaut. Ne mets > 1 QUE si une même ligne indique explicitement un prix unitaire
             ET une quantité (ex. "x2"). Un bridge ou une prothèse couvrant plusieurs dents
             (ex. "11-12-13", "prothèse 11 dents") = UN SEUL acte → qty = 1, prix = montant total affiché.

Règles :
- N'inclus QUE des actes dentaires. Ignore les lignes de total général, sous-totaux, en-têtes,
  mentions légales, et les colonnes "remboursement Sécu / mutuelle".
- Si le même acte apparaît sur plusieurs lignes (dents différentes), renvoie une ligne par occurrence.
- N'invente jamais de montant : si un prix n'est pas lisible, n'inclus pas la ligne.
- PROTHÈSE AMOVIBLE — transcris fidèlement le MATÉRIAU et le NOMBRE DE DENTS écrits sur le devis,
  et garde-les dans "label" :
    · « prothèse métallique N dents », « châssis métallique », « stellite », « PAP métallique »
      = prothèse partielle MÉTALLIQUE (stellite). Recopie le nombre exact (ex. « 11 dents », pas « 9 »).
    · « résine », « complète », « PAC résine » = prothèse RÉSINE.
  N'invente JAMAIS un second appareil : s'il est écrit « métallique », ne crée PAS de ligne « résine »
  (et inversement). Un seul appareil sur le devis = UNE seule ligne (qty = 1), même s'il couvre
  plusieurs dents.

Ne renvoie QUE du JSON conforme au schéma.`

export interface DevisLineRaw {
  label: string
  code?: string
  cat?: string
  dent?: string
  prix: number
  brss?: number
  secu?: number
  qty: number
}
export interface DevisExtractionResult {
  lines: DevisLineRaw[]
}

async function callGemini(
  opts: { apiKey: string; model: string; mimeType: string; dataBase64: string },
  prompt: string,
  schema: unknown,
): Promise<unknown> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent?key=${opts.apiKey}`
  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: opts.mimeType, data: opts.dataBase64 } },
        ],
      },
    ],
    generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: schema },
  }
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!r.ok) {
    const detail = await r.text().catch(() => '')
    throw new Error(`Gemini ${r.status}: ${detail.slice(0, 300)}`)
  }
  const data = (await r.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Réponse Gemini vide')
  return JSON.parse(text)
}

/** Appelle Gemini et renvoie les garanties dentaires structurées. */
export async function geminiExtractGaranties(opts: {
  apiKey: string
  model: string
  mimeType: string
  dataBase64: string
}): Promise<VisionResult> {
  const r = (await callGemini(opts, PROMPT, RESPONSE_SCHEMA)) as VisionResult
  if (r?.columns) r.columns = normalizeColumns(r.columns)
  return r
}

/** Appelle Gemini et renvoie les lignes d'un devis dentaire. */
export async function geminiExtractDevis(opts: {
  apiKey: string
  model: string
  mimeType: string
  dataBase64: string
}): Promise<DevisExtractionResult> {
  return (await callGemini(opts, DEVIS_PROMPT, DEVIS_SCHEMA)) as DevisExtractionResult
}

/* ---------------- Combiné : tableau de garanties + devis en 1 appel ---------- */

const COMBINED_SCHEMA = {
  type: 'OBJECT',
  properties: {
    garanties: RESPONSE_SCHEMA,
    devis: DEVIS_SCHEMA,
  },
  required: ['garanties', 'devis'],
}

const COMBINED_PROMPT = `On te fournit DEUX documents dentaires :
- DOCUMENT 1 = un TABLEAU DE GARANTIES de complémentaire santé.
- DOCUMENT 2 = un DEVIS dentaire.

Analyse les DEUX et renvoie un seul JSON { "garanties": …, "devis": … }.

========== DOCUMENT 1 — TABLEAU DE GARANTIES → champ "garanties" ==========
${PROMPT}

========== DOCUMENT 2 — DEVIS → champ "devis" ==========
${DEVIS_PROMPT}

Rappel : renvoie UNIQUEMENT le JSON { "garanties": { "columns": […], "defaultColumnIndex": … },
"devis": { "lines": […] } }.`

export interface CombinedResult {
  garanties: VisionResult
  devis: DevisExtractionResult
}

/** Un seul appel Gemini avec les deux documents (garanties + devis). */
export async function geminiExtractCombined(opts: {
  apiKey: string
  model: string
  garanties: { mimeType: string; dataBase64: string }
  devis: { mimeType: string; dataBase64: string }
}): Promise<CombinedResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent?key=${opts.apiKey}`
  const payload = {
    contents: [
      {
        parts: [
          { text: COMBINED_PROMPT },
          { text: '=== DOCUMENT 1 : TABLEAU DE GARANTIES ===' },
          { inlineData: { mimeType: opts.garanties.mimeType, data: opts.garanties.dataBase64 } },
          { text: '=== DOCUMENT 2 : DEVIS ===' },
          { inlineData: { mimeType: opts.devis.mimeType, data: opts.devis.dataBase64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: COMBINED_SCHEMA,
    },
  }
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!r.ok) {
    const detail = await r.text().catch(() => '')
    throw new Error(`Gemini ${r.status}: ${detail.slice(0, 300)}`)
  }
  const data = (await r.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Réponse Gemini vide')
  const out = JSON.parse(text) as CombinedResult
  if (out?.garanties?.columns) out.garanties.columns = normalizeColumns(out.garanties.columns)
  return out
}
