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

const submitSchema = z.object({
  patientName: z.string().trim().min(1, 'Nom du patient requis.'),
  garanties: z.record(z.string(), garantieSchema),
  sourceName: z.string().optional().default(''),
  rawText: z.string().optional().default(''),
  phone: z.string().optional().default(''),
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
  const { patientName, garanties, sourceName, rawText, phone } = parsed.data

  const token = randomBytes(18).toString('base64url')
  db.prepare(
    `INSERT INTO patient_requests
       (cabinet_id, token, patient_name, status, source_name, garanties, raw_text, phone, received_at)
     VALUES (?, ?, ?, 'received', ?, ?, ?, ?, datetime('now'))`,
  ).run(cab.id, token, patientName, sourceName, JSON.stringify(garanties), rawText, phone)

  res.json({ ok: true })
})
