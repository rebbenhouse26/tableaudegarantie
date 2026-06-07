import { matchActe, nearestVariant, getActe, DEFAULT_ACTE_BY_CAT, panierForCode, labelForCode } from './actes'
import { ccamFind, ccamPoste } from './ccam'
import type { LigneDevis, Panier } from './types'

/**
 * Normalise le panier lu sur le devis vers 'rac0' | 'maitrise' | 'libre' (ou null).
 * Tolère toutes les formes : « 100 % Santé », « RAC 0 », « panier 1 », « sans reste à charge »,
 * « tarif maîtrisé », « honoraires libres », « rac0 »…
 */
function normPanier(p?: string): Panier | null {
  if (!p) return null
  const s = p
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
  if (/rac\s*-?\s*0|100\s*%?\s*sante|sans\s*reste|renforc|panier\s*1/.test(s)) return 'rac0'
  if (/maitris|modere|panier\s*2|hlf/.test(s)) return 'maitrise'
  if (/libre|panier\s*3/.test(s)) return 'libre'
  if (s === 'rac0') return 'rac0'
  return null
}

/**
 * Rattache des lignes brutes extraites d'un devis (par l'IA de vision) à la référence d'actes :
 *  1) par libellé + code CCAM ; 2) à défaut, par le poste (cat) fourni par la vision.
 * Le prix réel du devis est conservé (prixOverride).
 */
export function rawLinesToDevis(
  raw: Array<{
    label: string
    code?: string
    cat?: string
    panier?: string
    dent?: string
    prix: number
    brss?: number
    secu?: number
    qty?: number
  }>,
): LigneDevis[] {
  const out: LigneDevis[] = []
  for (const l of raw) {
    if (!(l.prix > 0)) continue
    const cc = ccamFind(l.code)
    let acteId = matchActe(`${l.label} ${l.code ?? ''}`)
    // Rattachement par poste : celui du devis, sinon celui déduit du code CCAM
    // (liste officielle puis filet par préfixe → aucun code n'est laissé sans poste).
    const cat = l.cat || ccamPoste(l.code)
    if (!acteId && cat && DEFAULT_ACTE_BY_CAT[cat] && getActe(DEFAULT_ACTE_BY_CAT[cat])) {
      acteId = DEFAULT_ACTE_BY_CAT[cat]
    }
    if (!acteId) continue
    // Inlay-core : base de remboursement FIXÉE à 70 € (convention 2026), quelle que soit la valeur lue.
    const isInlayCore = acteId === 'inlaycore'
    // BR : on privilégie la valeur du devis ; à défaut, la base officielle CCAM v34 du code.
    const brss = isInlayCore
      ? 70
      : l.brss && l.brss > 0
        ? l.brss
        : cc && cc.br != null
          ? cc.br
          : undefined
    // Panier : si le devis l'indique (100 % Santé / maîtrisé / libre), on le RESPECTE ;
    // sinon, on déduit la variante du prix (nearestVariant). Reconnaissance ROBUSTE du libellé.
    const acte = getActe(acteId)!
    // Priorité du panier : 1) imposé par le CODE CCAM (ex. HBLD634 → 100 % Santé),
    //   2) mention lue sur le devis, 3) déduction par le prix.
    const wanted = panierForCode(l.code) ?? normPanier(l.panier)
    const panierIdx = wanted ? acte.variants.findIndex((v) => v.panier === wanted) : -1
    const varianteIdx = panierIdx >= 0 ? panierIdx : nearestVariant(acteId, l.prix)
    out.push({
      acteId,
      varianteIdx,
      qty: Math.max(1, l.qty || 1),
      prixOverride: l.prix,
      brssOverride: brss,
      // Part Sécu réelle du devis si fournie ; sinon computeLine la calcule depuis BR × taux.
      secuOverride:
        !isInlayCore && l.secu != null && l.secu >= 0 && (l.brss ?? 0) > 0 ? l.secu : undefined,
      dent: l.dent?.trim() || undefined,
      labelOverride: labelForCode(l.code) ?? undefined,
    })
  }
  return out
}
