import type { GarantiesParPoste, PosteGarantie } from './types'

/** Tous les postes de garantie, dans l'ordre d'affichage. */
export const POSTES: PosteGarantie[] = [
  'soins',
  'prothese',
  'inlaycore',
  'bridge',
  'amovible',
  'protheseNR',
  'implant',
  'paro',
  'ortho',
  'esthetique',
]

const ZERO: { type: 'pct'; val: number; plafond: number } = { type: 'pct', val: 0, plafond: 0 }

/** Jeu de garanties vide (point de départ d'une extraction). */
export function emptyGaranties(): GarantiesParPoste {
  return {
    // Par défaut, la mutuelle complète le ticket modérateur des soins (100 % BR).
    soins: { type: 'pct', val: 100, plafond: 0 },
    prothese: { type: 'pct', val: 0, plafond: 0 },
    // Inlay-core : 0 = pas de ligne dédiée → repli automatique sur le taux « prothese ».
    inlaycore: { type: 'pct', val: 0, plafond: 0 },
    // Bridge / prothèse amovible : 0 = non distingués → repli sur le taux « prothese » (couronne).
    bridge: { type: 'pct', val: 0, plafond: 0 },
    amovible: { type: 'pct', val: 0, plafond: 0 },
    // Prothèse NON remboursée par la Sécu (bridge provisoire, cantilever, Maryland…) : forfait € mutuelle directe.
    protheseNR: { type: 'forfait', val: 0, plafond: 0 },
    implant: { type: 'forfait', val: 0, plafond: 0 },
    paro: { type: 'forfait', val: 0, plafond: 0 },
    ortho: { type: 'forfait', val: 0, plafond: 0 },
    esthetique: { type: 'forfait', val: 0, plafond: 0 },
  }
}

/** Copie profonde d'un jeu de garanties (défensive : tolère un poste absent d'anciennes données). */
export function cloneGaranties(g: GarantiesParPoste): GarantiesParPoste {
  return {
    soins: { ...(g.soins ?? ZERO) },
    prothese: { ...(g.prothese ?? ZERO) },
    inlaycore: { ...(g.inlaycore ?? ZERO) },
    bridge: { ...(g.bridge ?? ZERO) },
    amovible: { ...(g.amovible ?? ZERO) },
    protheseNR: { ...(g.protheseNR ?? ZERO) },
    implant: { ...(g.implant ?? ZERO) },
    paro: { ...(g.paro ?? ZERO) },
    ortho: { ...(g.ortho ?? ZERO) },
    esthetique: { ...(g.esthetique ?? ZERO) },
  }
}
