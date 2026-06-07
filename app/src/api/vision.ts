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

/** Côté le plus long max après compression (px). Suffisant pour lire un tableau/devis. */
const MAX_DIM = 1600
const JPEG_QUALITY = 0.82

/**
 * Prépare le fichier pour l'envoi : COMPRESSE les images (redimensionnement + JPEG) pour accélérer
 * fortement l'upload et l'analyse Gemini. Les PDF et HEIC (non décodables en canvas) passent tels quels.
 * Renvoie {mimeType, dataBase64} prêt pour l'API.
 */
async function fileToPayload(file: File): Promise<{ mimeType: string; dataBase64: string }> {
  const mime = guessMimeType(file)
  const compressible = mime.startsWith('image/') && mime !== 'image/heic' && mime !== 'image/heif'
  if (!compressible) return { mimeType: mime, dataBase64: await fileToBase64(file) }
  try {
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader()
      r.onload = () => res(String(r.result))
      r.onerror = () => rej(new Error('read'))
      r.readAsDataURL(file)
    })
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = () => rej(new Error('decode'))
      i.src = dataUrl
    })
    const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height))
    // Pas de gain à agrandir : si l'image est déjà petite, on l'envoie telle quelle.
    if (scale >= 1 && file.size < 600_000) {
      return { mimeType: mime, dataBase64: dataUrl.slice(dataUrl.indexOf(',') + 1) }
    }
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const out = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    return { mimeType: 'image/jpeg', dataBase64: out.slice(out.indexOf(',') + 1) }
  } catch {
    // Repli : envoi de l'original si la compression échoue.
    return { mimeType: mime, dataBase64: await fileToBase64(file) }
  }
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
  const payload = await fileToPayload(file)
  const r = await fetch(`${API_URL}/extract/garanties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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
  const payload = await fileToPayload(file)
  const r = await fetch(`${API_URL}/extract/devis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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
  const [gPayload, dPayload] = await Promise.all([
    fileToPayload(garantiesFile),
    fileToPayload(devisFile),
  ])
  const r = await fetch(`${API_URL}/extract/combined`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ garanties: gPayload, devis: dPayload }),
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
