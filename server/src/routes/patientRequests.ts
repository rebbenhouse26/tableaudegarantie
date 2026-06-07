import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { db } from '../db.js'
import { requireAuth, type AuthRequest } from '../auth.js'
import { sendSms, smsAvailable } from '../lib/sms.js'

const APP_BASE_URL = (process.env.APP_BASE_URL ?? process.env.CORS_ORIGIN ?? '').replace(/\/$/, '')

/** Routes privées (cabinet) : gestion des invitations patient. */
export const patientRequestsRouter = Router()
patientRequestsRouter.use(requireAuth)

interface PreqRow {
  id: number
  token: string
  patient_name: string
  status: string
  source_name: string
  garanties: string | null
  raw_text: string | null
  phone: string | null
  created_at: string
  received_at: string | null
}

function rowToPreq(r: PreqRow) {
  return {
    id: r.id,
    token: r.token,
    patientName: r.patient_name,
    status: r.status,
    sourceName: r.source_name,
    phone: r.phone ?? '',
    garanties: r.garanties ? JSON.parse(r.garanties) : null,
    rawText: r.raw_text ?? '',
    createdAt: r.created_at,
    receivedAt: r.received_at,
  }
}

const createSchema = z.object({
  patientName: z.string().optional().default(''),
  phone: z.string().optional().default(''),
})

/** Lien PERMANENT du cabinet (le même pour tous les patients) : à coller dans Doctolib / QR code. */
patientRequestsRouter.get('/cabinet-link', (req: AuthRequest, res) => {
  let row = db
    .prepare('SELECT name, public_slug FROM cabinets WHERE id = ?')
    .get(req.cabinet!.id) as { name: string; public_slug: string | null } | undefined
  if (!row) return res.status(404).json({ error: 'Cabinet introuvable.' })
  if (!row.public_slug) {
    const slug = randomBytes(9).toString('base64url')
    db.prepare('UPDATE cabinets SET public_slug = ? WHERE id = ?').run(slug, req.cabinet!.id)
    row = { name: row.name, public_slug: slug }
  }
  res.json({ slug: row.public_slug, cabinetName: row.name })
})

/** Crée une invitation et renvoie le token (+ envoi SMS du lien si un téléphone est fourni). */
patientRequestsRouter.post('/', async (req: AuthRequest, res) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
  const { patientName, phone } = parsed.data
  const token = randomBytes(18).toString('base64url')
  const info = db
    .prepare('INSERT INTO patient_requests (cabinet_id, token, patient_name, phone) VALUES (?, ?, ?, ?)')
    .run(req.cabinet!.id, token, patientName, phone)
  const row = db
    .prepare('SELECT * FROM patient_requests WHERE id = ?')
    .get(info.lastInsertRowid) as PreqRow

  // Envoi SMS best-effort si un numéro est fourni et le service est configuré.
  let sms: { sent: boolean; error?: string } = { sent: false }
  if (phone && phone.trim()) {
    if (!smsAvailable()) {
      sms = { sent: false, error: 'SMS non activé (clé Brevo manquante).' }
    } else {
      const cab = db.prepare('SELECT name FROM cabinets WHERE id = ?').get(req.cabinet!.id) as
        | { name: string }
        | undefined
      const link = `${APP_BASE_URL}/patient/${token}`
      const content = `${cab?.name ?? 'Votre cabinet dentaire'} : merci de transmettre votre tableau de garanties avant votre RDV : ${link}`
      const r = await sendSms(phone, content)
      sms = { sent: r.ok, error: r.error }
    }
  }
  res.status(201).json({ ...rowToPreq(row), sms })
})

/** Liste les invitations du cabinet courant. */
patientRequestsRouter.get('/', (req: AuthRequest, res) => {
  const rows = db
    .prepare('SELECT * FROM patient_requests WHERE cabinet_id = ? ORDER BY created_at DESC')
    .all(req.cabinet!.id) as PreqRow[]
  res.json(rows.map(rowToPreq))
})

patientRequestsRouter.delete('/:id', (req: AuthRequest, res) => {
  const info = db
    .prepare('DELETE FROM patient_requests WHERE id = ? AND cabinet_id = ?')
    .run(req.params.id, req.cabinet!.id)
  if (info.changes === 0) return res.status(404).json({ error: 'Invitation introuvable.' })
  res.status(204).end()
})

/* ---------- Patients rattachés (espace patient self-service) ---------- */

interface PatientRow {
  id: number
  name: string
  email: string
  status: string
  source_name: string
  garanties: string | null
  raw_text: string | null
  doc_mime: string | null
  doc_name: string | null
  created_at: string
  submitted_at: string | null
}

/** Liste les patients (comptes self-service) rattachés au cabinet courant. */
patientRequestsRouter.get('/patients', (req: AuthRequest, res) => {
  const rows = db
    .prepare(
      `SELECT id, name, email, status, source_name, garanties, raw_text, doc_mime, doc_name,
              created_at, submitted_at
       FROM patients WHERE cabinet_id = ? ORDER BY submitted_at DESC, created_at DESC`,
    )
    .all(req.cabinet!.id) as PatientRow[]
  res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      status: r.status,
      sourceName: r.source_name,
      garanties: r.garanties ? JSON.parse(r.garanties) : null,
      rawText: r.raw_text ?? '',
      hasDoc: !!r.doc_name || !!r.doc_mime,
      docName: r.doc_name ?? '',
      createdAt: r.created_at,
      submittedAt: r.submitted_at,
    })),
  )
})

/** Télécharge le document original déposé par un patient rattaché. */
patientRequestsRouter.get('/patients/:id/document', (req: AuthRequest, res) => {
  const row = db
    .prepare('SELECT doc_data, doc_mime, doc_name FROM patients WHERE id = ? AND cabinet_id = ?')
    .get(req.params.id, req.cabinet!.id) as
    | { doc_data: string | null; doc_mime: string | null; doc_name: string | null }
    | undefined
  if (!row || !row.doc_data) return res.status(404).json({ error: 'Document introuvable.' })
  // doc_data est une data URL (data:<mime>;base64,<...>) — on extrait les octets.
  const b64 = row.doc_data.includes(',') ? row.doc_data.slice(row.doc_data.indexOf(',') + 1) : row.doc_data
  const buf = Buffer.from(b64, 'base64')
  const mime = row.doc_mime || 'application/octet-stream'
  const name = row.doc_name || `tableau-garanties-${req.params.id}`
  res.setHeader('Content-Type', mime)
  res.setHeader('Content-Disposition', `attachment; filename="${name.replace(/"/g, '')}"`)
  res.send(buf)
})
