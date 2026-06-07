import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db.js'

/** Routes publiques (patient) : consultation et dépôt via le token d'invitation. */
export const publicInviteRouter = Router()

const garantieSchema = z.object({
  type: z.enum(['pct', 'forfait']),
  val: z.number(),
  plafond: z.number(),
})

const submitSchema = z.object({
  garanties: z.record(z.string(), garantieSchema),
  sourceName: z.string().optional().default(''),
  rawText: z.string().optional().default(''),
  patientName: z.string().optional(),
})

interface Row {
  id: number
  patient_name: string
  status: string
  cabinet_name: string
}

/** Le patient ouvre son lien : on renvoie le minimum (nom du cabinet, statut). */
publicInviteRouter.get('/:token', (req, res) => {
  const row = db
    .prepare(
      `SELECT pr.id, pr.patient_name, pr.status, c.name AS cabinet_name
       FROM patient_requests pr JOIN cabinets c ON c.id = pr.cabinet_id
       WHERE pr.token = ?`,
    )
    .get(req.params.token) as Row | undefined
  if (!row) return res.status(404).json({ error: 'Lien invalide ou expiré.' })
  res.json({
    cabinetName: row.cabinet_name,
    patientName: row.patient_name,
    status: row.status,
  })
})

/** Le patient transmet ses garanties (extraites côté navigateur). */
publicInviteRouter.post('/:token', (req, res) => {
  const exists = db
    .prepare('SELECT id, status FROM patient_requests WHERE token = ?')
    .get(req.params.token) as { id: number; status: string } | undefined
  if (!exists) return res.status(404).json({ error: 'Lien invalide ou expiré.' })

  const parsed = submitSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
  const { garanties, sourceName, rawText, patientName } = parsed.data

  db.prepare(
    `UPDATE patient_requests
     SET status = 'received', garanties = ?, source_name = ?, raw_text = ?,
         patient_name = COALESCE(NULLIF(?, ''), patient_name),
         received_at = datetime('now')
     WHERE token = ?`,
  ).run(JSON.stringify(garanties), sourceName, rawText, patientName ?? '', req.params.token)

  res.json({ ok: true })
})
