import type {
  GarantiesParPoste,
  LigneCalculee,
  LigneDevis,
  PosteGarantie,
  TotauxDevis,
} from './types'
import { getActe } from './actes'

/** Formate un montant en euros (sans décimales). */
export function eur(n: number): string {
  // Pas de séparateur de milliers (évite l'espace fine « 5 404 » illisible en colonne étroite).
  return (
    n.toLocaleString('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: false,
    }) + ' €'
  )
}

/**
 * Coeur du calcul pour une ligne : croise un acte avec les garanties de la mutuelle.
 * - Sécu = BRSS × tauxSecu, × quantité.
 * - Mutuelle :
 *   - garantie en % : couvre val% de la BRSS, la part mutuelle complète au-delà de la Sécu.
 *   - garantie forfaitaire : montant fixe par acte.
 * La part mutuelle ne dépasse jamais le reste après remboursement Sécu.
 */
/** Arrondi au centime (évite les artefacts de virgule flottante). */
const cents = (n: number) => Math.round(n * 100) / 100

/**
 * Poste de garantie effectif d'un acte.
 * Inlay-core : si la mutuelle a une ligne dédiée « inlay-core » (val > 0), on l'utilise ;
 * sinon, repli automatique sur le taux « prothese » (cas où le tableau ne distingue pas).
 */
export function resolvePoste(
  acteId: string,
  cat: PosteGarantie,
  garanties: GarantiesParPoste,
): PosteGarantie {
  if (acteId === 'inlaycore') return (garanties.inlaycore?.val ?? 0) > 0 ? 'inlaycore' : 'prothese'
  // Bridge / amovible : sous-poste dédié si la mutuelle le distingue, sinon repli sur « prothese » (couronne).
  if (cat === 'bridge' || cat === 'amovible') {
    return (garanties[cat]?.val ?? 0) > 0 ? cat : 'prothese'
  }
  return cat
}

export function computeLine(
  acteId: string,
  varianteIdx: number,
  qty: number,
  garanties: GarantiesParPoste,
  prixOverride?: number,
  brssOverride?: number,
  secuOverride?: number,
): LigneCalculee {
  const acte = getActe(acteId)
  if (!acte) throw new Error(`Acte inconnu : ${acteId}`)
  const v = acte.variants[varianteIdx]
  const poste = resolvePoste(acteId, acte.cat, garanties)
  const g = garanties[poste]

  const prixUnitaire = prixOverride ?? v.prix
  const prix = cents(prixUnitaire * qty)
  // Base de remboursement et part Sécu : on privilégie les valeurs RÉELLES du devis.
  const brUnitaire = brssOverride ?? v.brss
  const br = brUnitaire * qty
  const secuBrut = secuOverride != null ? secuOverride * qty : (brUnitaire * v.tauxSecu) / 100 * qty
  // Garde-fous : la Sécu ne dépasse ni sa base ni le prix.
  const secu = cents(Math.max(0, Math.min(secuBrut, br, prix)))

  // Panier 100 % Santé : reste à charge zéro garanti (contrats responsables).
  if (v.panier === 'rac0') {
    return { prix, secu, mut: cents(Math.max(0, prix - secu)), rac: 0, cat: poste }
  }

  let mut = 0
  if (g) {
    if (g.type === 'pct') {
      const totalCouvert = (br * g.val) / 100
      mut = Math.max(0, totalCouvert - secu)
    } else {
      mut = g.val * qty
    }
  }

  // La mutuelle ne dépasse jamais le reste après Sécu (pas de surcompensation).
  mut = cents(Math.min(mut, Math.max(0, prix - secu)))

  return { prix, secu, mut, rac: cents(Math.max(0, prix - secu - mut)), cat: poste }
}

/**
 * Calcule l'ensemble du devis en appliquant les plafonds annuels par poste.
 * Les plafonds sont consommés ligne par ligne dans l'ordre du devis.
 */
export function computeDevis(lines: LigneDevis[], garanties: GarantiesParPoste): LigneCalculee[] {
  const g = garanties
  const used: Partial<Record<PosteGarantie, number>> = {}

  return lines.map((L) => {
    const r = computeLine(L.acteId, L.varianteIdx, L.qty, garanties, L.prixOverride, L.brssOverride, L.secuOverride)
    const cat = r.cat
    const acte = getActe(L.acteId)
    const isRac0 = acte?.variants[L.varianteIdx]?.panier === 'rac0'
    const plaf = g[cat] ? g[cat].plafond : 0
    // Le panier 100 % Santé n'est pas soumis au plafond annuel de la mutuelle.
    if (plaf > 0 && !isRac0) {
      const dejaUtilise = used[cat] ?? 0
      const dispo = Math.max(0, plaf - dejaUtilise)
      const before = r.mut
      r.mut = Math.min(r.mut, dispo)
      r.rac = r.rac + (before - r.mut)
      used[cat] = dejaUtilise + r.mut
    }
    return r
  })
}

export function totaux(lignes: LigneCalculee[]): TotauxDevis {
  return lignes.reduce<TotauxDevis>(
    (a, r) => ({
      prix: a.prix + r.prix,
      secu: a.secu + r.secu,
      mut: a.mut + r.mut,
      rac: a.rac + r.rac,
    }),
    { prix: 0, secu: 0, mut: 0, rac: 0 },
  )
}
