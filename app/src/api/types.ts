import type { Garantie, GarantiesParPoste, LigneDevis, TotauxDevis } from '../domain/types'

/** Une colonne (niveau/formule) renvoyée par l'extraction vision. */
export interface VisionColumn {
  label: string
  soins: Garantie
  prothese: Garantie
  inlaycore: Garantie
  bridge: Garantie
  amovible: Garantie
  protheseNR: Garantie
  implant: Garantie
  paro: Garantie
  ortho: Garantie
  esthetique: Garantie
}

export interface VisionResult {
  columns: VisionColumn[]
  defaultColumnIndex: number
}

export interface Cabinet {
  id: number
  name: string
  email: string
}

export interface AuthResponse {
  token: string
  cabinet: Cabinet
}

/** Devis tel que renvoyé par l'API. */
export interface DevisRecord {
  id: number
  patientName: string
  mutuelleId: string
  createdAt: string
  totalRac: number
  lines: LigneDevis[]
  totals: TotauxDevis
  /** Présents pour les devis récents (absents des tout premiers enregistrements). */
  sourceName?: string
  garanties?: GarantiesParPoste
}

/** Invitation patient (pré-rendez-vous). */
export interface PatientRequest {
  id: number
  token: string
  patientName: string
  status: 'pending' | 'received'
  sourceName: string
  phone?: string
  garanties: GarantiesParPoste | null
  rawText: string
  /** Le patient a joint le fichier original de son tableau (téléchargeable par le cabinet). */
  hasDoc?: boolean
  docName?: string
  createdAt: string
  receivedAt: string | null
  /** Présent uniquement dans la réponse de création (statut de l'envoi SMS). */
  sms?: { sent: boolean; error?: string }
}

export interface CreateDevisInput {
  patientName: string
  mutuelleId: string
  sourceName: string
  garanties: GarantiesParPoste
  lines: LigneDevis[]
  totals: TotauxDevis
}
