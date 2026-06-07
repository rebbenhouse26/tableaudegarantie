import type { Acte, Panier } from './types'

// Référence des actes dentaires — bases CCAM indicatives, mises à jour 2026 (revalorisation HLF +3 %).
// brss = base de remboursement Sécu, tauxSecu = % pris en charge par la Sécu (0 si non remboursable).
// Le taux dentaire de droit commun est 70 % de la base. Les codes CCAM sont indicatifs.
// ⚠️ Sur un devis réel, la BR et la part Sécu sont lues directement sur le document (prioritaires) ;
// cette table sert surtout au mode démo, à l'ajout manuel et aux paniers 100 % Santé (optimisation).

// Inlay-core : valeurs de référence en vigueur — base de remboursement (BR) 70 €, plafond HLF 150 €.
// NB : la convention 2023-2028 prévoit une dégression projetée (BR 65 € en 2027, 60 € en 2028 ;
// plafond 140 €/130 €). Non appliquée tant qu'elle n'est pas confirmée par avenant ; on reste à 70/150.
const IC = { br: 70, hlf: 150 }

export const ACTES: Acte[] = [
  // ---------------- Soins conservateurs & chirurgicaux ----------------
  {
    id: 'consultation',
    label: 'Consultation / examen',
    cat: 'soins',
    variants: [{ nom: 'Consultation dentaire', prix: 30, brss: 30, tauxSecu: 70, panier: 'maitrise', code: 'BDC' }],
  },
  {
    id: 'detartrage',
    label: 'Détartrage',
    cat: 'soins',
    variants: [{ nom: 'Détartrage (2 arcades)', prix: 60, brss: 28.92, tauxSecu: 70, panier: 'maitrise', code: 'HBJD001' }],
  },
  {
    id: 'composite',
    label: 'Restauration (composite)',
    cat: 'soins',
    variants: [
      { nom: 'Composite 1 face', prix: 50, brss: 19.28, tauxSecu: 70, panier: 'maitrise', code: 'HBMD058' },
      { nom: 'Composite 2 faces', prix: 80, brss: 33.74, tauxSecu: 70, panier: 'maitrise', code: 'HBMD053' },
    ],
  },
  {
    id: 'endodontie',
    label: 'Dévitalisation (endodontie)',
    cat: 'soins',
    variants: [
      { nom: 'Traitement endodontique molaire', prix: 110, brss: 81.94, tauxSecu: 70, panier: 'maitrise', code: 'HBFD003' },
      { nom: 'Traitement endodontique incisive/canine', prix: 60, brss: 33.74, tauxSecu: 70, panier: 'maitrise', code: 'HBFD008' },
    ],
  },
  {
    id: 'avulsion',
    label: 'Extraction (avulsion)',
    cat: 'soins',
    variants: [{ nom: 'Avulsion dent permanente', prix: 50, brss: 33.44, tauxSecu: 70, panier: 'maitrise', code: 'HBGD036' }],
  },

  // ---------------- Prothèses ----------------
  {
    id: 'couronne',
    label: 'Couronne',
    cat: 'prothese',
    variants: [
      // 100 % Santé 2026 : céramo-métal/métal + zircone MONOLITHIQUE (full zircone), toutes dents.
      { nom: 'Couronne 100 % Santé (céramo-métal / métal / zircone monolithique)', prix: 453, brss: 120, tauxSecu: 70, panier: 'rac0', code: 'HBLD038' },
      { nom: 'Couronne céramo-métallique (tarif maîtrisé, HLF 530 €)', prix: 530, brss: 120, tauxSecu: 70, panier: 'maitrise', code: 'HBLD036' },
      // Tarif libre : zircone STRATIFIÉE, céramique stratifiée, disilicate de lithium (esthétique).
      { nom: 'Couronne zircone stratifiée / céramique (tarif libre)', prix: 650, brss: 120, tauxSecu: 70, panier: 'libre', code: 'HBLD036' },
    ],
  },
  {
    // Couronne provisoire (transitoire) HBLD037 : NON prise en charge par la Sécu (NPC, CCAM v34).
    // Acte distinct (évite de la compter comme une couronne définitive) ; souvent incluse dans
    // l'honoraire de la couronne définitive. Reste à charge réel si facturée séparément.
    id: 'couronneprov',
    label: 'Couronne provisoire',
    cat: 'prothese',
    variants: [
      { nom: 'Couronne provisoire (non remboursée)', prix: 50, brss: 0, tauxSecu: 0, panier: 'libre', code: 'HBLD037' },
    ],
  },
  {
    id: 'inlaycore',
    label: 'Inlay-core',
    cat: 'prothese',
    // BR et plafond HLF dégressifs sur la convention 2023-2028 (70/150 € en 2026 → 60/130 € en 2028).
    variants: [
      { nom: 'Inlay-core (panier 100 % Santé)', prix: IC.hlf, brss: IC.br, tauxSecu: 70, panier: 'rac0', code: 'HBLD007' },
      { nom: `Inlay-core (tarif maîtrisé, HLF ${IC.hlf} €)`, prix: IC.hlf, brss: IC.br, tauxSecu: 70, panier: 'maitrise', code: 'HBLD007' },
      // Tarif libre (sans plafond HLF) : associé à une couronne en tarif libre. La mutuelle rembourse
      // selon le % prothèses sur la BR (ex. 500 % × 70 € = 350 €), l'optimiseur facture jusqu'à ce plafond.
      { nom: 'Inlay-core (tarif libre)', prix: 300, brss: IC.br, tauxSecu: 70, panier: 'libre', code: 'HBLD007' },
    ],
  },
  {
    id: 'bridge',
    label: 'Bridge 3 éléments',
    cat: 'bridge',
    variants: [
      { nom: 'Bridge full zircone monolithique (100 % Santé, HLF 1 359,60 €)', prix: 1359, brss: 279.5, tauxSecu: 70, panier: 'rac0', code: 'HBLD040' },
      { nom: 'Bridge céramo-métallique (tarif maîtrisé)', prix: 1465, brss: 279.5, tauxSecu: 70, panier: 'maitrise', code: 'HBLD040' },
      { nom: 'Bridge céramique stratifiée (tarif libre)', prix: 1700, brss: 279.5, tauxSecu: 70, panier: 'libre', code: 'HBLD040' },
    ],
  },
  {
    id: 'inlayonlay',
    label: 'Inlay / Onlay',
    cat: 'prothese',
    variants: [
      { nom: 'Inlay-onlay (tarif maîtrisé)', prix: 300, brss: 100, tauxSecu: 70, panier: 'maitrise', code: 'HBMD' },
      { nom: 'Inlay-onlay (tarif libre)', prix: 450, brss: 100, tauxSecu: 70, panier: 'libre', code: 'HBMD' },
    ],
  },
  {
    // Prothèse amovible RÉSINE complète — panier 100 % Santé (RAC 0). Acte distinct du stellite :
    // une résine ne doit JAMAIS être « optimisée » en stellite (matériau et acte différents).
    id: 'amovible',
    label: 'Prothèse amovible résine',
    cat: 'amovible',
    variants: [
      { nom: 'Prothèse amovible complète résine (100 % Santé)', prix: 1133, brss: 182.75, tauxSecu: 70, panier: 'rac0', code: 'HBLD477' },
    ],
  },
  {
    // Stellite = châssis métallique (prothèse partielle). Pas de 100 % Santé → panier maîtrisé/libre.
    id: 'stellite',
    label: 'Stellite (partielle métallique)',
    cat: 'amovible',
    variants: [
      { nom: 'Stellite — partielle métallique (tarif maîtrisé)', prix: 1442, brss: 279.5, tauxSecu: 70, panier: 'maitrise', code: 'HBLD367' },
      { nom: 'Stellite — partielle métallique (tarif libre)', prix: 1800, brss: 279.5, tauxSecu: 70, panier: 'libre', code: 'HBLD367' },
    ],
  },
  {
    id: 'couronneImpl',
    label: 'Couronne sur implant',
    // Couronne implantoportée HBLD418 : se fixe sur un PILIER (pas d'inlay-core), hors 100 % Santé
    // → tarif libre. La COURONNE est prise en charge par la Sécu (BR 120 €) ; seul l'implant ne l'est pas.
    cat: 'prothese',
    variants: [{ nom: 'Couronne sur implant (sur pilier — tarif libre)', prix: 700, brss: 120, tauxSecu: 70, panier: 'libre', code: 'HBLD418' }],
  },

  // ---------------- Prothèses NON remboursées par la Sécu (mutuelle directe) ----------------
  // Hors nomenclature CCAM remboursable (BR 0) : seule la garantie « prothèse non remboursée » paie.
  {
    id: 'bridgeProv',
    label: 'Bridge provisoire (non remboursé)',
    cat: 'protheseNR',
    variants: [{ nom: 'Bridge provisoire (non remboursé Sécu)', prix: 300, brss: 0, tauxSecu: 0, panier: 'libre' }],
  },
  {
    id: 'protheseExt',
    label: 'Couronne/bridge en extension ou à ailettes (non remboursé)',
    cat: 'protheseNR',
    // Couronne « cantilever » / pontique en extension / bridge collé à ailettes (Maryland) : hors prise en charge Sécu.
    variants: [{ nom: 'Prothèse en extension / à ailettes (non remboursée Sécu)', prix: 500, brss: 0, tauxSecu: 0, panier: 'libre' }],
  },

  // ---------------- Implantologie ----------------
  {
    id: 'implant',
    label: 'Implant',
    cat: 'implant',
    variants: [{ nom: 'Implant + pilier (non remboursé Sécu)', prix: 1100, brss: 0, tauxSecu: 0, panier: 'libre' }],
  },

  // ---------------- Parodontologie ----------------
  {
    id: 'surfacage',
    label: 'Surfaçage paro (par sextant)',
    cat: 'paro',
    variants: [{ nom: 'Surfaçage radiculaire (hors nomenclature)', prix: 120, brss: 0, tauxSecu: 0, panier: 'libre' }],
  },
  {
    id: 'lambeau',
    label: 'Chirurgie parodontale (lambeau)',
    cat: 'paro',
    variants: [{ nom: 'Assainissement par lambeau (hors nomenclature)', prix: 350, brss: 0, tauxSecu: 0, panier: 'libre' }],
  },

  // ---------------- Orthodontie ----------------
  {
    id: 'ortho',
    label: 'Orthodontie (semestre)',
    cat: 'ortho',
    variants: [
      { nom: 'Semestre, enfant <16 ans', prix: 850, brss: 193.5, tauxSecu: 100, panier: 'maitrise', code: 'TO90' },
      { nom: 'Semestre, adulte (hors nomenclature)', prix: 850, brss: 0, tauxSecu: 0, panier: 'libre' },
    ],
  },
  {
    id: 'contention',
    label: 'Contention orthodontique',
    cat: 'ortho',
    variants: [{ nom: 'Contention (1ʳᵉ année)', prix: 250, brss: 161.25, tauxSecu: 100, panier: 'maitrise', code: 'TO75' }],
  },

  // ---------------- Esthétique ----------------
  {
    id: 'blanchiment',
    label: 'Esthétique',
    cat: 'esthetique',
    variants: [
      { nom: 'Blanchiment', prix: 400, brss: 0, tauxSecu: 0, panier: 'libre' },
      { nom: 'Facette céramique', prix: 900, brss: 0, tauxSecu: 0, panier: 'libre' },
    ],
  },
]

export function getActe(id: string): Acte | undefined {
  return ACTES.find((a) => a.id === id)
}

// Mots-clés (et codes CCAM) → acteId, pour rattacher une ligne de devis importée.
// Ordre important : les libellés les plus spécifiques d'abord.
const MATCHERS: Array<{ acteId: string; keywords: string[] }> = [
  { acteId: 'couronneImpl', keywords: ['couronne sur implant', 'couronne implant', 'couronne implanto', 'implantoport', 'hbld418'] },
  // Prothèses NON remboursées Sécu — AVANT bridge/couronne pour capter les libellés spécifiques.
  { acteId: 'bridgeProv', keywords: ['bridge provisoire', 'bridge transitoire', 'bac provisoire', 'pont provisoire'] },
  { acteId: 'protheseExt', keywords: ['couronne en extension', 'couronne cantilever', "couronne à ailettes", 'couronne ailettes', 'bridge en extension', 'bridge cantilever', "bridge à ailettes", 'bridge ailettes', 'bridge collé', 'bridge colle', 'bridge maryland', 'cantilever', 'en extension', 'ailettes', 'maryland', 'dent vivante'] },
  // Inlay-core (faux moignon) AVANT couronne pour capter "Inlay Core" sans confusion.
  { acteId: 'inlaycore', keywords: ['inlay-core', 'inlay core', 'inlaycore', 'faux moignon', 'infrastructure coronoradic', 'coronoradiculaire', 'i/c', 'ic ', 'hbld007', 'hbld261'] },
  { acteId: 'bridge', keywords: ['bridge', 'inter dentaire', 'inter-dentaire', 'hbld040', 'hbld425', 'hbld785', 'hbld198'] },
  // Stellite = châssis métallique. Codes CCAM par nombre de dents (aideaucodage.fr) :
  // 1-3=HBLD131, 4=HBLD332, 5=HBLD452, 6=HBLD474, 7=HBLD075, 8=HBLD470, 9=HBLD435, 11=HBLD203.
  { acteId: 'stellite', keywords: ['stellite', 'chassis', 'châssis', 'amovible métallique', 'prothèse métallique', 'prothese metallique', 'appareil métallique', 'plaque métallique', 'partielle métallique', 'partiel métallique', 'pap métallique', 'hbld131', 'hbld332', 'hbld452', 'hbld474', 'hbld075', 'hbld470', 'hbld435', 'hbld203', 'hbld367'] },
  // Prothèse amovible RÉSINE : complète HBLD477, partielle résine HBLD039, complète résine HBLD031.
  { acteId: 'amovible', keywords: ['amovible', 'résine', 'resine', 'dentier', 'appareil', 'pam', 'p.a.', 'hbld477', 'hbld031', 'hbld039'] },
  // Couronnes (y compris abréviations "Cou", "Cour", "Cour. Prov", "céra-mét").
  // Couronne provisoire AVANT la couronne définitive (sinon "couronne provisoire" matche "couronne").
  { acteId: 'couronneprov', keywords: ['couronne provisoire', 'couronne transitoire', 'couronne dentaire transitoire', 'provisoire', 'transitoire', 'cour. prov', 'cour prov', 'couronne prov', 'prov ', 'c. prov', 'hbld037', 'hbld724'] },
  { acteId: 'couronne', keywords: ['couronne', 'cour ', 'cour.', 'cours ', 'cou ', 'cera-met', 'céra-mét', 'ceramo', 'céramo', 'zircone', 'hbld036', 'hbld038', 'hbld403', 'hbld486', 'hbld490', 'hbld033', 'hbld163', 'hbld634'] },
  { acteId: 'inlayonlay', keywords: ['inlay', 'onlay', 'hbmd0'] },
  { acteId: 'implant', keywords: ['implant'] },
  { acteId: 'lambeau', keywords: ['lambeau', 'assainissement', 'chirurgie parodontale'] },
  { acteId: 'surfacage', keywords: ['surfacage', 'surfaçage', 'parodont', 'gingiv'] },
  { acteId: 'contention', keywords: ['contention', 'to75'] },
  { acteId: 'ortho', keywords: ['orthodont', 'ortho', 'odf', 'to90', 'multi-attache', 'dento-faciale'] },
  { acteId: 'blanchiment', keywords: ['blanchiment', 'facette', 'eclaircissement', 'esthetique'] },
  { acteId: 'detartrage', keywords: ['detartrage', 'détartrage', 'hbjd001'] },
  { acteId: 'endodontie', keywords: ['endodont', 'devitalisation', 'dévitalisation', 'pulpe', 'hbfd'] },
  { acteId: 'avulsion', keywords: ['avulsion', 'extraction', 'hbgd'] },
  { acteId: 'composite', keywords: ['composite', 'obturation', 'restauration', 'carie', 'hbmd05'] },
  { acteId: 'consultation', keywords: ['consultation', 'examen', 'bilan', 'bdc'] },
]

/**
 * Panier 100 % Santé des couronnes selon la DENT (matrice 2026) :
 *  - incisives/canines/prémolaires : céramo-métallique OU zircone monolithique → RAC 0 ;
 *  - molaires : métallique OU zircone monolithique → RAC 0 (la céramo-métallique y est "maîtrisé").
 * Numérotation FDI : dernier chiffre 6/7/8 = molaire ; 4/5 = prémolaire ; 1/2/3 = incisive/canine.
 */
export function isMolaire(dent?: string): boolean {
  if (!dent) return false
  const nums = dent.match(/\d+/g) ?? []
  return nums.some((n) => ['6', '7', '8'].includes(n.trim().slice(-1)))
}

/** Libellé du matériau couronne 100 % Santé adapté à la dent. */
export function couronne100SanteLabel(dent?: string): string {
  return isMolaire(dent)
    ? 'Couronne 100 % Santé (métallique ou zircone monolithique)'
    : 'Couronne 100 % Santé (céramo-métallique ou zircone monolithique)'
}

/** Acte représentatif par poste, pour rattacher une ligne quand seul le poste est connu. */
export const DEFAULT_ACTE_BY_CAT: Record<string, string> = {
  soins: 'consultation',
  prothese: 'couronne',
  bridge: 'bridge',
  amovible: 'amovible',
  protheseNR: 'protheseExt',
  implant: 'implant',
  paro: 'surfacage',
  ortho: 'ortho',
  esthetique: 'blanchiment',
}

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/**
 * Table CODE CCAM → acte, construite depuis les MATCHERS (codes complets « hbld634 » etc.).
 * La COTATION prime sur le libellé : un code exact identifie l'acte de façon fiable.
 */
const CODE_TO_ACTE: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  for (const m of MATCHERS) {
    for (const kw of m.keywords) {
      if (/^[a-z]{4}\d{3}$/.test(kw) && !map[kw]) map[kw] = m.acteId // 1er gagne (ordre = spécificité)
    }
  }
  return map
})()

/**
 * RÉFÉRENCE CCAM dentaire (source : aideaucodage.fr). Le code fige l'acte, le panier et le matériau.
 * C'est la source de vérité prioritaire pour lire un devis (la cotation ne ment pas).
 * panier : 'rac0' = 100 % Santé · 'maitrise' = honoraires maîtrisés · 'libre' = tarif libre.
 */
interface CcamRef {
  acte: string
  panier?: Panier
  label?: string
}
const CCAM_REF: Record<string, CcamRef> = {
  // ---- Couronnes dentoportées (matériau × dent × panier, réforme 2020) ----
  hbld038: { acte: 'couronne', panier: 'rac0', label: 'Couronne métallique alliage non précieux (100 % Santé)' },
  hbld318: { acte: 'couronne', panier: 'libre', label: 'Couronne métallique alliage précieux (tarif libre)' },
  hbld634: { acte: 'couronne', panier: 'rac0', label: 'Couronne céramo-métallique (100 % Santé)' }, // incisive/canine/1re PM
  hbld491: { acte: 'couronne', panier: 'maitrise', label: 'Couronne céramo-métallique 2e prémolaire (tarif maîtrisé)' },
  hbld734: { acte: 'couronne', panier: 'maitrise', label: 'Couronne céramo-métallique molaire (tarif maîtrisé)' },
  hbld073: { acte: 'couronne', panier: 'rac0', label: 'Couronne zircone monolithique molaire (100 % Santé)' },
  hbld350: { acte: 'couronne', panier: 'rac0', label: 'Couronne zircone monolithique (100 % Santé)' }, // hors molaire
  hbld680: { acte: 'couronne', panier: 'rac0', label: 'Couronne céramique monolithique (100 % Santé)' }, // incisive/canine/1re PM
  hbld158: { acte: 'couronne', panier: 'maitrise', label: 'Couronne céramique monolithique (tarif maîtrisé)' }, // 2e PM/molaire
  hbld403: { acte: 'couronne', panier: 'libre', label: 'Couronne céramocéramique (tarif libre)' },
  hbld036: { acte: 'couronne' }, // ancien code CCM générique
  // ---- Couronne sur implant ----
  hbld418: { acte: 'couronneImpl', label: 'Couronne sur implant' },
  // ---- Couronnes transitoires / provisoires (non remboursées) ----
  hbld486: { acte: 'couronneprov' }, hbld490: { acte: 'couronneprov' },
  hbld610: { acte: 'couronneprov' }, hbld724: { acte: 'couronneprov' }, hbld037: { acte: 'couronneprov' },
  // ---- Inlay-core (infrastructure coronoradiculaire) ----
  hbld090: { acte: 'inlaycore', panier: 'rac0' }, // sans reste à charge
  hbld245: { acte: 'inlaycore', panier: 'libre' }, // tarif libre
  hbld745: { acte: 'inlaycore' }, // entente directe limitée
  hbld007: { acte: 'inlaycore' }, hbld261: { acte: 'inlaycore' }, // (codes v34 historiques)
  // ---- Bridges / prothèses plurales (y compris cantilever/collés, qui ont une cotation) ----
  hbld033: { acte: 'bridge' }, hbld040: { acte: 'bridge' }, hbld043: { acte: 'bridge' },
  hbld088: { acte: 'bridge' }, hbld093: { acte: 'bridge' }, hbld179: { acte: 'bridge' },
  hbld227: { acte: 'bridge' }, hbld321: { acte: 'bridge' }, hbld411: { acte: 'bridge' },
  hbld414: { acte: 'bridge' }, hbld425: { acte: 'bridge' }, hbld453: { acte: 'bridge' },
  hbld465: { acte: 'bridge' }, hbld466: { acte: 'bridge' }, hbld750: { acte: 'bridge' }, hbld785: { acte: 'bridge' },
  // ---- Prothèse amovible RÉSINE ----
  hbld031: { acte: 'amovible' }, hbld032: { acte: 'amovible' }, hbld035: { acte: 'amovible' },
  hbld083: { acte: 'amovible' }, hbld101: { acte: 'amovible' }, hbld118: { acte: 'amovible' },
  hbld123: { acte: 'amovible' }, hbld132: { acte: 'amovible' }, hbld138: { acte: 'amovible' },
  hbld148: { acte: 'amovible' }, hbld199: { acte: 'amovible' }, hbld215: { acte: 'amovible' },
  hbld224: { acte: 'amovible' }, hbld231: { acte: 'amovible' }, hbld232: { acte: 'amovible' },
  hbld259: { acte: 'amovible' }, hbld262: { acte: 'amovible' }, hbld270: { acte: 'amovible' },
  hbld349: { acte: 'amovible' }, hbld364: { acte: 'amovible' }, hbld370: { acte: 'amovible' },
  hbld371: { acte: 'amovible' }, hbld476: { acte: 'amovible' }, hbld492: { acte: 'amovible' }, hbld477: { acte: 'amovible' },
  // ---- STELLITE = prothèse amovible à châssis MÉTALLIQUE (par nombre de dents) ----
  hbld026: { acte: 'stellite' }, hbld027: { acte: 'stellite' }, hbld029: { acte: 'stellite' },
  hbld046: { acte: 'stellite' }, hbld047: { acte: 'stellite' }, hbld048: { acte: 'stellite' },
  hbld075: { acte: 'stellite' }, hbld079: { acte: 'stellite' }, hbld112: { acte: 'stellite' },
  hbld131: { acte: 'stellite' }, hbld171: { acte: 'stellite' }, hbld203: { acte: 'stellite' },
  hbld217: { acte: 'stellite' }, hbld236: { acte: 'stellite' }, hbld240: { acte: 'stellite' },
  hbld308: { acte: 'stellite' }, hbld332: { acte: 'stellite' }, hbld435: { acte: 'stellite' },
  hbld452: { acte: 'stellite' }, hbld470: { acte: 'stellite' }, hbld474: { acte: 'stellite' },
}

function ccamRef(code?: string | null): CcamRef | null {
  if (!code) return null
  const m = code.toUpperCase().match(/[A-Z]{4}\d{3}/)
  return m ? (CCAM_REF[m[0].toLowerCase()] ?? null) : null
}

/** Panier imposé par un code CCAM (ou null si le code ne fige pas le panier). */
export function panierForCode(code?: string | null): Panier | null {
  return ccamRef(code)?.panier ?? null
}

/** Libellé exact imposé par le code CCAM (ou null). */
export function labelForCode(code?: string | null): string | null {
  return ccamRef(code)?.label ?? null
}

/** Rattache un libellé/code de ligne de devis à un acte de la référence (ou null). */
export function matchActe(text: string): string | null {
  const n = norm(text)
  // 1) COTATION prioritaire : si un code CCAM connu est présent, il décide (table CCAM puis matchers).
  const codes = n.match(/[a-z]{4}\d{3}/g) ?? []
  for (const c of codes) {
    if (CCAM_REF[c]) return CCAM_REF[c].acte
    if (CODE_TO_ACTE[c]) return CODE_TO_ACTE[c]
  }
  // 2) Sinon, matching par libellé (position dans le texte, puis spécificité).
  let bestActe: string | null = null
  let bestIdx = Infinity
  let bestOrder = Infinity
  for (let order = 0; order < MATCHERS.length; order++) {
    const m = MATCHERS[order]
    for (const kw of m.keywords) {
      const idx = n.indexOf(norm(kw))
      if (idx === -1) continue
      // priorité : position dans le texte, puis ordre (spécificité) de la liste.
      if (idx < bestIdx || (idx === bestIdx && order < bestOrder)) {
        bestActe = m.acteId
        bestIdx = idx
        bestOrder = order
      }
    }
  }
  return bestActe
}

/** Choisit l'index de variante dont le prix est le plus proche du prix détecté. */
export function nearestVariant(acteId: string, prix: number): number {
  const acte = getActe(acteId)
  if (!acte) return 0
  let bestIdx = 0
  let bestDiff = Infinity
  acte.variants.forEach((v, i) => {
    const d = Math.abs(v.prix - prix)
    if (d < bestDiff) {
      bestDiff = d
      bestIdx = i
    }
  })
  return bestIdx
}
