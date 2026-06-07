import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db.js'
import { requireAuth, type AuthRequest } from '../auth.js'

export const devisRouter = Router()
devisRouter.use(requireAuth)

const lineSchema = z.object({
  acteId: z.string(),
  varianteIdx: z.number().int().min(0),
  qty: z.number().int().min(1),
  prixOverride: z.number().nonnegative().optional(),
  brssOverride: z.number().nonnegative().optional(),
  secuOverride: z.number().nonnegative().optional(),
  dent: z.string().optional(),
})

const garantieSchema = z.object({
  type: z.enum(['pct', 'forfait']),
  val: z.number(),
  plafond: z.number(),
})

const createSchema = z.object({
  patientName: z.string().min(1, 'Nom du patient requis.'),
  mutuelleId: z.string().min(1),
  sourceName: z.string().optional().default(''),
  garanties: z.record(z.string(), garantieSchema).optional(),
  lines: z.array(lineSchema).min(1, 'Le devis doit contenir au moins un acte.'),
  totals: z.object({
    prix: z.number(),
    secu: z.number(),
    mut: z.number(),
    rac: z.number(),
  }),
})

interface DevisRow {
  id: number
  patient_name: string
  mutuelle_id: string
  payload: string
  total_rac: number
  created_at: string
}

function rowToDevis(r: DevisRow) {
  return {
    id: r.id,
    patientName: r.patient_name,
    mutuelleId: r.mutuelle_id,
    createdAt: r.created_at,
    totalRac: r.total_rac,
    ...JSON.parse(r.payload),
  }
}

/** Liste des devis du cabinet courant (résumé). */
devisRouter.get('/', (req: AuthRequest, res) => {
  const rows = db
    .prepare(
      'SELECT id, patient_name, mutuelle_id, payload, total_rac, created_at FROM devis WHERE cabinet_id = ? ORDER BY created_at DESC',
    )
    .all(req.cabinet!.id) as DevisRow[]
  res.json(rows.map(rowToDevis))
})

/** Détail d'un devis. */
devisRouter.get('/:id', (req: AuthRequest, res) => {
  const row = db
    .prepare(
      'SELECT id, patient_name, mutuelle_id, payload, total_rac, created_at FROM devis WHERE id = ? AND cabinet_id = ?',
    )
    .get(req.params.id, req.cabinet!.id) as DevisRow | undefined
  if (!row) return res.status(404).json({ error: 'Devis introuvable.' })
  res.json(rowToDevis(row))
})

/** Enregistre un nouveau devis pour le cabinet courant. */
devisRouter.post('/', (req: AuthRequest, res) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message })
  }
  const { patientName, mutuelleId, sourceName, garanties, lines, totals } = parsed.data
  const payload = JSON.stringify({ lines, totals, sourceName, garanties })

  const info = db
    .prepare(
      'INSERT INTO devis (cabinet_id, patient_name, mutuelle_id, payload, total_rac) VALUES (?, ?, ?, ?, ?)',
    )
    .run(req.cabinet!.id, patientName, mutuelleId, payload, totals.rac)

  const row = db
    .prepare(
      'SELECT id, patient_name, mutuelle_id, payload, total_rac, created_at FROM devis WHERE id = ?',
    )
    .get(info.lastInsertRowid) as DevisRow
  res.status(201).json(rowToDevis(row))
})

/** Supprime un devis. */
devisRouter.delete('/:id', (req: AuthRequest, res) => {
  const info = db
    .prepare('DELETE FROM devis WHERE id = ? AND cabinet_id = ?')
    .run(req.params.id, req.cabinet!.id)
  if (info.changes === 0) return res.status(404).json({ error: 'Devis introuvable.' })
  res.status(204).end()
})
