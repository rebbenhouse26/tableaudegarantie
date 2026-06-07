import type { GarantiesParPoste, LigneDevis, Panier, TotauxDevis } from './types'
import { getActe, couronne100SanteLabel } from './actes'
import { computeDevis, resolvePoste, totaux } from './calcul'

export interface OptimLigne {
  line: LigneDevis
  acteLabel: string
  /** Devis actuel. */
  currentNom: string
  currentPrix: number
  currentRac: number
  /** Devis optimisé (honoraires max à reste à charge ≈ 0). */
  optimNom: string
  optimPrix: number
  optimRac: number
  /** Variation d'honoraires pour le cabinet (optimisé − actuel ; peut être négatif). */
  gainCabinet: number
}

export interface OptimResult {
  perLine: OptimLigne[]
  optimizedLines: LigneDevis[]
  totalsCurrent: TotauxDevis
  totalsOptim: TotauxDevis
  /** Reste à charge patient évité (devis − optimisé). */
  racEvite: number
  /** Supplément d'honoraires pour le cabinet (optimisé − devis). */
  supplementCabinet: number
}

const PANIERS: Panier[] = ['rac0', 'maitrise', 'libre']

function variantIdxByPanier(acteId: string, panier: Panier): number {
  const a = getActe(acteId)
  return a ? a.variants.findIndex((v) => v.panier === panier) : -1
}

/** Plafond de couverture réel (par unité) : part Sécu + part mutuelle, à reste à charge ≈ 0. */
function coverageCeiling(line: LigneDevis, garanties: GarantiesParPoste): number {
  const acte = getActe(line.acteId)!
  const v = acte.variants[line.varianteIdx]
  const g = garanties[resolvePoste(line.acteId, acte.cat, garanties)]
  const br = line.brssOverride ?? v.brss
  const secu = line.secuOverride ?? (br * v.tauxSecu) / 100
  let covMut = 0
  if (g) covMut = g.type === 'pct' ? Math.max(0, (br * g.val) / 100 - secu) : g.val
  return secu + covMut
}

/**
 * Honoraires facturables (par unité) dans un panier donné en gardant un reste à charge ≈ 0,
 * ou null si l'acte n'existe pas dans ce panier.
 * - rac0     : HLF du panier 100 % Santé — RAC 0 garanti (contrat responsable), même si la mutuelle couvre moins.
 * - maîtrisé : plafonné au HLF maîtrisé ET à la couverture réelle.
 * - libre    : plafonné à la seule couverture réelle de la mutuelle.
 */
function feeForPanier(line: LigneDevis, panier: Panier, garanties: GarantiesParPoste): number | null {
  const v = getActe(line.acteId)!.variants.find((x) => x.panier === panier)
  if (!v) return null
  if (panier === 'rac0') return v.prix
  const ceil = coverageCeiling(line, garanties)
  return panier === 'maitrise' ? Math.min(ceil, v.prix) : ceil
}

interface Choice {
  panier: Panier
  fee: number // honoraires par unité
}

/**
 * Meilleur panier pour une ligne SEULE : honoraires max à reste à charge ≈ 0.
 * À honoraires égaux, on garde le panier le plus bas (RAC 0 garanti, package au plus simple).
 */
function chooseTier(line: LigneDevis, garanties: GarantiesParPoste): Choice | null {
  let best: Choice | null = null
  for (const p of PANIERS) {
    const fee = feeForPanier(line, p, garanties)
    if (fee == null) continue
    if (!best || fee > best.fee + 0.5) best = { panier: p, fee }
  }
  return best
}

function isFlexible(acteId: string): boolean {
  // Actes dont on peut faire varier le panier (prothèses avec option 100 % Santé).
  return !!getActe(acteId)?.variants.some((v) => v.panier === 'rac0')
}

/** Numéros de dents (FDI) mentionnés sur une ligne — gère "31", "11-13", "11,12,13", "11 / 21". */
function teethOf(L: LigneDevis): string[] {
  return L.dent?.match(/\d{1,2}/g) ?? []
}

/**
 * Regroupe les lignes qui partagent au moins une dent (union-find), pour traiter en « package » :
 * couronne + couronne provisoire + inlay-core d'une même dent, ou bridge + inlay-cores des piliers
 * (le bridge porte plusieurs dents, ses piliers partagent ces numéros). Les lignes sans dent restent
 * isolées (chacune son groupe).
 */
function buildGroups(lines: LigneDevis[]): number[][] {
  const parent = lines.map((_, i) => i)
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]
      x = parent[x]
    }
    return x
  }
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b)
  }
  const firstByTooth = new Map<string, number>()
  lines.forEach((L, i) => {
    for (const t of teethOf(L)) {
      const seen = firstByTooth.get(t)
      if (seen != null) union(i, seen)
      else firstByTooth.set(t, i)
    }
  })
  const groups = new Map<number, number[]>()
  lines.forEach((_, i) => {
    const r = find(i)
    ;(groups.get(r) ?? groups.set(r, []).get(r)!).push(i)
  })
  return [...groups.values()]
}

/**
 * Optimise le devis pour MAXIMISER les honoraires du cabinet tout en gardant un reste à charge
 * patient ≈ 0, en exploitant au mieux les garanties. Monte en panier maîtrisé/libre si la mutuelle
 * couvre davantage ; ajuste à la baisse si le devis dépasse la couverture. Cohérence des paniers
 * par dent (couronne + inlay-core même panier). Informatif — à valider par le cabinet.
 */
export function optimiserDevis(lines: LigneDevis[], garanties: GarantiesParPoste): OptimResult {
  const currentRes = computeDevis(lines, garanties)

  // 1. Choix par ligne (panier + honoraires cible).
  const choices: (Choice | null)[] = lines.map((L) =>
    isFlexible(L.acteId) ? chooseTier(L, garanties) : null,
  )

  // 2. Cohérence « package » : couronne + provisoire + inlay-core d'une dent (ou bridge + inlay-cores
  //    des piliers) doivent partager le MÊME panier. Pour chaque package, on retient le panier commun à
  //    tous les actes qui maximise les honoraires totaux du cabinet, tous à reste à charge ≈ 0.
  for (const idxs of buildGroups(lines)) {
    const flex = idxs.filter((i) => choices[i])
    if (flex.length < 2) continue
    const common = PANIERS.filter((p) =>
      flex.every((i) => variantIdxByPanier(lines[i].acteId, p) !== -1),
    )
    if (!common.length) continue
    let bestPanier: Panier | null = null
    let bestTotal = -1
    for (const p of common) {
      const total = flex.reduce((s, i) => s + (feeForPanier(lines[i], p, garanties) ?? 0), 0)
      if (total > bestTotal + 0.5) {
        bestTotal = total
        bestPanier = p
      }
    }
    for (const i of flex) {
      choices[i] = { panier: bestPanier!, fee: feeForPanier(lines[i], bestPanier!, garanties)! }
    }
  }

  // 3. Lignes optimisées.
  const optimizedLines: LigneDevis[] = lines.map((L, i) => {
    const ch = choices[i]
    if (!ch) return L // acte non flexible : on garde le devis tel quel
    return {
      acteId: L.acteId,
      varianteIdx: variantIdxByPanier(L.acteId, ch.panier),
      qty: L.qty,
      prixOverride: ch.fee,
      brssOverride: L.brssOverride,
      secuOverride: L.secuOverride,
      dent: L.dent,
    }
  })
  const optimRes = computeDevis(optimizedLines, garanties)

  // 4. Détail par ligne.
  const perLine: OptimLigne[] = lines.map((L, i) => {
    const acte = getActe(L.acteId)!
    const ch = choices[i]
    const optV = acte.variants[optimizedLines[i].varianteIdx]
    const origPanier = acte.variants[L.varianteIdx].panier
    // Si le panier ne change pas et que le code impose le libellé (ex. HBLD634 → céramo-métallique),
    // on garde ce libellé exact. Sinon on étiquette selon la variante optimisée.
    const optimNom =
      L.labelOverride && ch?.panier === origPanier
        ? L.labelOverride
        : ch && acte.id === 'couronne' && ch.panier === 'rac0'
          ? couronne100SanteLabel(L.dent)
          : optV.nom
    return {
      line: L,
      acteLabel: acte.label,
      currentNom: L.labelOverride ?? acte.variants[L.varianteIdx].nom,
      currentPrix: currentRes[i].prix,
      currentRac: currentRes[i].rac,
      optimNom,
      optimPrix: optimRes[i].prix,
      optimRac: optimRes[i].rac,
      gainCabinet: Math.round((optimRes[i].prix - currentRes[i].prix) * 100) / 100,
    }
  })

  const totalsCurrent = totaux(currentRes)
  const totalsOptim = totaux(optimRes)
  return {
    perLine,
    optimizedLines,
    totalsCurrent,
    totalsOptim,
    racEvite: Math.max(0, totalsCurrent.rac - totalsOptim.rac),
    supplementCabinet: Math.round((totalsOptim.prix - totalsCurrent.prix) * 100) / 100,
  }
}
