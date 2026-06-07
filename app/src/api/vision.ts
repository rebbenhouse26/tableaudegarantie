import { API_URL, ApiError } from './client'
import type { Garantie, GarantiesParPoste } from '../domain/types'
import type { VisionColumn, VisionResult } from './types'

/** Déduit le type MIME (certains fichiers arrivent sans file.type fiable). */
function guessMimeType(file: File): string {
  if (file.type) return file.type
  const ext = file.name.toLowerCase().split('.').pop() ?? ''
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',
    pdf: 'application/pdf',
  }
  return map[ext] ?? 'image/jpeg'
}

/** Lit un fichier en base64 (sans le préfixe data:). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const s = String(reader.result)
      resolve(s.slice(s.indexOf(',') + 1))
    }
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'))
    reader.readAsDataURL(file)
  })
}

/** L'extraction par modèle de vision est-elle disponible côté serveur ? */
export async function visionAvailable(): Promise<boolean> {
  try {
    const r = await fetch(`${API_URL}/extract/status`)
    if (!r.ok) return false
    const d = (await r.json()) as { vision?: boolean }
    return Boolean(d.vision)
  } catch {
    return false
  }
}

/** Extraction des garanties dentaires par modèle de vision (Gemini, côté serveur). */
export async function extractGarantiesVision(file: File): Promise<VisionResult> {
  const dataBase64 = await fileToBase64(file)
  const r = await fetch(`${API_URL}/extract/garanties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mimeType: guessMimeType(file), dataBase64 }),
  })
  if (!r.ok) {
    const msg = (await r.json().catch(() => ({}))).error ?? 'Extraction vision indisponible.'
    throw new ApiError(msg, r.status)
  }
  return (await r.json()) as VisionResult
}

export interface DevisLineRaw {
  label: string
  code?: string
  cat?: string
  panier?: string
  dent?: string
  prix: number
  brss?: number
  secu?: number
  qty: number
}

/** Extraction des lignes d'un devis par modèle de vision (Gemini, côté serveur). */
export async function extractDevisVision(file: File): Promise<DevisLineRaw[]> {
  const dataBase64 = await fileToBase64(file)
  const r = await fetch(`${API_URL}/extract/devis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mimeType: guessMimeType(file), dataBase64 }),
  })
  if (!r.ok) {
    const msg = (await r.json().catch(() => ({}))).error ?? 'Extraction du devis indisponible.'
    throw new ApiError(msg, r.status)
  }
  const d = (await r.json()) as { lines?: DevisLineRaw[] }
  return d.lines ?? []
}

/** Extraction combinée (tableau de garanties + devis) en un seul appel Gemini. */
export async function extractCombined(
  garantiesFile: File,
  devisFile: File,
): Promise<{ garanties: VisionResult; devis: DevisLineRaw[] }> {
  const [gB64, dB64] = await Promise.all([fileToBase64(garantiesFile), fileToBase64(devisFile)])
  const r = await fetch(`${API_URL}/extract/combined`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      garanties: { mimeType: guessMimeType(garantiesFile), dataBase64: gB64 },
      devis: { mimeType: guessMimeType(devisFile), dataBase64: dB64 },
    }),
  })
  if (!r.ok) {
    const msg = (await r.json().catch(() => ({}))).error ?? 'Extraction combinée indisponible.'
    throw new ApiError(msg, r.status)
  }
  const d = (await r.json()) as { garanties: VisionResult; devis?: { lines?: DevisLineRaw[] } }
  return { garanties: d.garanties, devis: d.devis?.lines ?? [] }
}

/** Convertit une colonne vision en jeu de garanties. */
export function visionColumnToGaranties(c: VisionColumn): GarantiesParPoste {
  const fix = (g: Garantie): Garantie => ({
    type: g.type === 'pct' ? 'pct' : 'forfait',
    val: Math.max(0, Number(g.val) || 0),
    plafond: Math.max(0, Number(g.plafond) || 0),
  })
  const ZERO: Garantie = { type: 'pct', val: 0, plafond: 0 }
  return {
    soins: fix(c.soins),
    prothese: fix(c.prothese),
    // Inlay-core : présent seulement si le tableau a une ligne dédiée ; sinon 0 → repli sur prothèses.
    inlaycore: c.inlaycore ? fix(c.inlaycore) : ZERO,
    // Bridge / amovible : présents seulement si le tableau les distingue ; sinon 0 → repli sur prothèse.
    bridge: c.bridge ? fix(c.bridge) : ZERO,
    amovible: c.amovible ? fix(c.amovible) : ZERO,
    // Prothèse non remboursée Sécu (forfait € mutuelle directe) ; 0 si absente.
    protheseNR: c.protheseNR ? fix(c.protheseNR) : ZERO,
    implant: fix(c.implant),
    paro: fix(c.paro),
    ortho: fix(c.ortho),
    esthetique: fix(c.esthetique),
  }
}
