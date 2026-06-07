import type { Mutuelle, PosteGarantie } from './types'

export const POSTE_LABEL: Record<PosteGarantie, string> = {
  soins: 'Soins dentaires',
  prothese: 'Couronne',
  inlaycore: 'Inlay-core',
  bridge: 'Bridge',
  amovible: 'Prothèse amovible',
  protheseNR: 'Prothèse non remboursée Sécu',
  implant: 'Implantologie',
  paro: 'Parodontologie',
  ortho: 'Orthodontie',
  esthetique: 'Esthétique',
}

// Données fictives à des fins de démonstration.
// type "pct" = % de la BRSS (inclut la part Sécu) ; type "forfait" = € / an.
export const MUTUELLES: Mutuelle[] = [
  {
    id: 'essentielle',
    name: 'Mutuelle Essentielle',
    lvl: 'Entrée de gamme',
    g: {
      soins: { type: 'pct', val: 100, plafond: 0 },
      prothese: { type: 'pct', val: 125, plafond: 600 },
      inlaycore: { type: 'pct', val: 0, plafond: 0 },
      protheseNR: { type: 'forfait', val: 0, plafond: 0 },
      bridge: { type: 'pct', val: 0, plafond: 0 },
      amovible: { type: 'pct', val: 0, plafond: 0 },
      implant: { type: 'forfait', val: 0, plafond: 0 },
      paro: { type: 'forfait', val: 0, plafond: 0 },
      ortho: { type: 'forfait', val: 150, plafond: 300 },
      esthetique: { type: 'forfait', val: 0, plafond: 0 },
    },
    desc: ['Prothèse 125 % BRSS', 'Implant non couvert', 'Paro non couverte'],
  },
  {
    id: 'confort',
    name: 'Mutuelle Confort',
    lvl: 'Intermédiaire',
    g: {
      soins: { type: 'pct', val: 125, plafond: 0 },
      prothese: { type: 'pct', val: 200, plafond: 1000 },
      inlaycore: { type: 'pct', val: 0, plafond: 0 },
      protheseNR: { type: 'forfait', val: 0, plafond: 0 },
      bridge: { type: 'pct', val: 0, plafond: 0 },
      amovible: { type: 'pct', val: 0, plafond: 0 },
      implant: { type: 'forfait', val: 400, plafond: 800 },
      paro: { type: 'forfait', val: 150, plafond: 150 },
      ortho: { type: 'forfait', val: 250, plafond: 500 },
      esthetique: { type: 'forfait', val: 0, plafond: 0 },
    },
    desc: ['Prothèse 200 % BRSS', 'Implant 400 €/dent', 'Paro 150 €/an'],
  },
  {
    id: 'premium',
    name: 'Mutuelle Premium',
    lvl: 'Haut de gamme',
    g: {
      soins: { type: 'pct', val: 150, plafond: 0 },
      prothese: { type: 'pct', val: 400, plafond: 2000 },
      inlaycore: { type: 'pct', val: 0, plafond: 0 },
      protheseNR: { type: 'forfait', val: 0, plafond: 0 },
      bridge: { type: 'pct', val: 0, plafond: 0 },
      amovible: { type: 'pct', val: 0, plafond: 0 },
      implant: { type: 'forfait', val: 700, plafond: 2100 },
      paro: { type: 'forfait', val: 300, plafond: 300 },
      ortho: { type: 'forfait', val: 400, plafond: 800 },
      esthetique: { type: 'forfait', val: 200, plafond: 400 },
    },
    desc: ['Prothèse 400 % BRSS', 'Implant 700 €/dent', 'Paro & esthétique incluses'],
  },
]

export function getMutuelle(id: string): Mutuelle | undefined {
  return MUTUELLES.find((m) => m.id === id)
}
