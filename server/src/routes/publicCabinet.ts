import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { db } from '../db.js'

/**
 * Routes publiques (patient) via le LIEN PERMANENT du cabinet (slug stable, le même pour tous).
 * À coller dans le message de confirmation Doctolib ou à afficher en QR code en salle d'attente.
 * Le patient s'identifie lui-même (nom) puis dépose son tableau de garanties.
 */
export const publicCabinetRouter = Router()

const garantieSchema = z.object({
  type: z.enum(['pct', 'forfait']),
  val: z.number(),
  plafond: z.number(),
})

const docSchema = z
  .object({ dataUrl: z.string(), name: z.string().optional().default(''), mime: z.string().optional().default('') })
  .optional()

const submitSchema = z.object({
  patientName: z.string().trim().min(1, 'Nom du patient requis.'),
  // Garanties optionnelles : côté patient on transmet surtout le FICHIER (pas d'analyse).
  garanties: z.record(z.string(), garantieSchema).optional(),
  sourceName: z.string().optional().default(''),
  rawText: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  doc: docSchema,
})

function cabinetBySlug(slug: string) {
  return db.prepare('SELECT id, name FROM cabinets WHERE public_slug = ?').get(slug) as
    | { id: number; name: string }
    | undefined
}

/** Le patient ouvre le lien permanent : on renvoie le nom du cabinet. */
publicCabinetRouter.get('/:slug', (req, res) => {
  const cab = cabinetBySlug(req.params.slug)
  if (!cab) return res.status(404).json({ error: 'Lien invalide.' })
  res.json({ cabinetName: cab.name })
})

/** Le patient transmet ses garanties : crée une demande déjà « reçue » côté cabinet. */
publicCabinetRouter.post('/:slug', (req, res) => {
  const cab = cabinetBySlug(req.params.slug)
  if (!cab) return res.status(404).json({ error: 'Lien invalide.' })

  const parsed = submitSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
  const { patientName, garanties, sourceName, rawText, phone, doc } = parsed.data
  if ((!garanties || !Object.keys(garanties).length) && !doc?.dataUrl) {
    return res.status(400).json({ error: 'Veuillez joindre votre tableau de garanties.' })
  }
  const garantiesJson = garanties && Object.keys(garanties).length ? JSON.stringify(garanties) : null

  const token = randomBytes(18).toString('base64url')
  db.prepare(
    `INSERT INTO patient_requests
       (cabinet_id, token, patient_name, status, source_name, garanties, raw_text, phone,
        doc_data, doc_mime, doc_name, received_at)
     VALUES (?, ?, ?, 'received', ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
  ).run(
    cab.id, token, patientName, sourceName, garantiesJson, rawText, phone,
    doc?.dataUrl ?? null, doc?.mime ?? null, doc?.name ?? null,
  )

  res.json({ ok: true })
})
