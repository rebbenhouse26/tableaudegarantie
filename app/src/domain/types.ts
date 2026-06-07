// Types métier de Garant-AI.
// Une garantie mutuelle s'exprime soit en % de la base de remboursement Sécu (BRSS),
// soit en forfait annuel en euros.

export type PosteGarantie =
  | 'soins'
  | 'prothese' // = couronne (référence) ; bridge/amovible replient dessus si non distingués
  | 'inlaycore'
  | 'bridge'
  | 'amovible'
  | 'protheseNR'
  | 'implant'
  | 'paro'
  | 'ortho'
  | 'esthetique'

export type TypeGarantie = 'pct' | 'forfait'

/** Garantie d'un poste : niveau (% BRSS ou € forfait) + plafond annuel (€, 0 = aucun). */
export interface Garantie {
  type: TypeGarantie
  /** Si type === 'pct' : pourcentage de la BRSS. Si 'forfait' : montant en € par acte. */
  val: number
  /** Plafond annuel en € pour ce poste (0 = pas de plafond). */
  plafond: number
}

/** Jeu complet de garanties, une par poste. */
export type GarantiesParPoste = Record<PosteGarantie, Garantie>

export interface Mutuelle {
  id: string
  name: string
  lvl: string
  /** Garanties par poste. */
  g: GarantiesParPoste
  /** Points clés affichés sur la carte de sélection. */
  desc: string[]
}

/** Panier 100 % Santé : reste à charge zéro / tarif maîtrisé / tarif libre. */
export type Panier = 'rac0' | 'maitrise' | 'libre'

export interface VarianteActe {
  nom: string
  /** Prix indicatif pratiqué par le cabinet, en € (peut être surchargé par le devis importé). */
  prix: number
  /** Base de remboursement Sécu (BRSS / base CCAM), en €. */
  brss: number
  /** Taux de prise en charge Sécu, en % (0 si non remboursable). */
  tauxSecu: number
  panier: Panier
  /** Code CCAM de référence (indicatif). */
  code?: string
}

export interface Acte {
  id: string
  label: string
  cat: PosteGarantie
  variants: VarianteActe[]
}

/** Une ligne du plan de traitement / devis. */
export interface LigneDevis {
  acteId: string
  varianteIdx: number
  qty: number
  /** Prix réel issu du devis importé (€). Si absent, on utilise le prix indicatif de la variante. */
  prixOverride?: number
  /** Base de remboursement Sécu réelle lue sur le devis (€, par unité). Prioritaire sur le catalogue. */
  brssOverride?: number
  /** Montant remboursé par la Sécu réellement lu sur le devis (€, par unité). Prioritaire sur le calcul. */
  secuOverride?: number
  /** N° de dent (localisation), pour la cohérence des paniers entre actes liés (ex. couronne + inlay-core). */
  dent?: string
  /** Libellé exact déduit du code CCAM du devis (ex. HBLD634 → « Couronne céramo-métallique (100 % Santé) »). */
  labelOverride?: string
}

/** Résultat chiffré d'une ligne après application des règles métier. */
export interface LigneCalculee {
  prix: number
  secu: number
  mut: number
  rac: number
  cat: PosteGarantie
}

export interface TotauxDevis {
  prix: number
  secu: number
  mut: number
  rac: number
}
