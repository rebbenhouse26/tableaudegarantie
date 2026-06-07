import { Router } from 'express'
import { z } from 'zod'
import { geminiExtractGaranties, geminiExtractDevis, geminiExtractCombined } from '../lib/geminiVision.js'

/**
 * Extraction par modèle de vision (Gemini) : le tableau de garanties (image/PDF) est
 * lu directement par le modèle, qui renvoie les garanties dentaires par niveau/formule.
 * Activé seulement si GEMINI_API_KEY est défini ; sinon 501 → le frontend bascule sur l'OCR.
 *
 * ⚠️ Donnée de santé : en production, exige un cadre HDS/RGPD (DPA avec le fournisseur).
 */
export const extractRouter = Router()

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? ''
// Garanties (tables denses) : modèle complet, précision critique.
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
// Devis (liste d'actes, plus simple) : modèle « lite » = aussi précis (100 % à l'éval) mais plus RAPIDE.
const DEVIS_MODEL = process.env.GEMINI_DEVIS_MODEL ?? 'gemini-2.5-flash-lite'

const bodySchema = z.object({
  mimeType: z.string(),
  dataBase64: z.string().min(1),
})

/** Mappe une erreur Gemini en statut HTTP + message clair pour le frontend. */
function mapVisionError(e: unknown): { status: number; error: string } {
  const msg = e instanceof Error ? e.message : String(e)
  if (/\b429\b|quota|rate.?limit/i.test(msg)) {
    return { status: 429, error: "Quota de l'IA de vision atteint. Réessayez ou activez la facturation Google." }
  }
  if (/\b400\b|unsupported|invalid|mime/i.test(msg)) {
    return { status: 415, error: 'Format de fichier non supporté par le modèle. Essayez un JPG/PNG ou un PDF.' }
  }
  return { status: 502, error: 'Service de vision indisponible. Réessayez dans un instant.' }
}

extractRouter.post('/garanties', async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(501).json({ error: 'Extraction par vision non configurée (GEMINI_API_KEY absent).' })
  }
  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })

  try {
    const result = await geminiExtractGaranties({
      apiKey: GEMINI_API_KEY,
      model: GEMINI_MODEL,
      mimeType: parsed.data.mimeType,
      dataBase64: parsed.data.dataBase64,
    })
    res.json(result)
  } catch (e) {
    console.error('extract/garanties', e)
    const m = mapVisionError(e)
    res.status(m.status).json({ error: m.error })
  }
})

extractRouter.post('/devis', async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(501).json({ error: 'Extraction par vision non configurée (GEMINI_API_KEY absent).' })
  }
  const parsed = bodySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
  try {
    const result = await geminiExtractDevis({
      apiKey: GEMINI_API_KEY,
      model: DEVIS_MODEL,
      mimeType: parsed.data.mimeType,
      dataBase64: parsed.data.dataBase64,
    })
    res.json(result)
  } catch (e) {
    console.error('extract/devis', e)
    const m = mapVisionError(e)
    res.status(m.status).json({ error: m.error })
  }
})

const combinedSchema = z.object({
  garanties: bodySchema,
  devis: bodySchema,
})

/** Un seul appel : tableau de garanties + devis joints → extraction des deux. */
extractRouter.post('/combined', async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(501).json({ error: 'Extraction par vision non configurée (GEMINI_API_KEY absent).' })
  }
  const parsed = combinedSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
  try {
    const result = await geminiExtractCombined({
      apiKey: GEMINI_API_KEY,
      model: GEMINI_MODEL,
      garanties: parsed.data.garanties,
      devis: parsed.data.devis,
    })
    res.json(result)
  } catch (e) {
    console.error('extract/combined', e)
    const m = mapVisionError(e)
    res.status(m.status).json({ error: m.error })
  }
})

/** Indique au frontend si l'extraction par vision est disponible. */
extractRouter.get('/status', (_req, res) => {
  res.json({ vision: Boolean(GEMINI_API_KEY), model: GEMINI_API_KEY ? GEMINI_MODEL : null })
})
