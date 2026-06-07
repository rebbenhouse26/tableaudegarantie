import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { db } from '../db.js'
import { hashPassword, verifyPassword } from '../auth.js'
import { emailAvailable, sendEmail, welcomeEmailHtml } from '../lib/email.js'

/**
 * Espace PATIENT (self-service) : le patient crée un compte (nom + e-mail + mot de passe),
 * reçoit par e-mail un lien personnel, et y dépose son tableau de garanties.
 * Distinct de l'auth cabinet : un patient n'a pas accès au tableau de bord.
 */
export const patientAccountRouter = Router()

const APP_BASE_URL = (process.env.APP_BASE_URL ?? process.env.CORS_ORIGIN ?? 'http://localhost:5173').replace(/\/$/, '')

function depotLink(token: string): string {
  return `${APP_BASE_URL}/espace-patient/${token}`
}

const registerSchema = z.object({
  name: z.string().trim().optional().default(''),
  email: z.string().email('E-mail invalide.'),
  password: z.string().min(8, 'Mot de passe : 8 caractères minimum.'),
  cabinetSlug: z.string().trim().optional(),
})

const loginSchema = z.object({
  email: z.string().email('E-mail invalide.'),
  password: z.string().min(1, 'Mot de passe requis.'),
})

const garantieSchema = z.object({
  type: z.enum(['pct', 'forfait']),
  val: z.number(),
  plafond: z.number(),
})
const submitSchema = z.object({
  garanties: z.record(z.string(), garantieSchema).optional(),
  sourceName: z.string().optional().default(''),
  rawText: z.string().optional().default(''),
  doc: z
    .object({ dataUrl: z.string(), name: z.string().optional().default(''), mime: z.string().optional().default('') })
    .optional(),
})

interface PatientRow {
  id: number
  name: string
  email: string
  password: string
  token: string
  status: string
}

/** Inscription : crée le compte, envoie l'e-mail avec le lien de dépôt. */
patientAccountRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
  const { name, email, password, cabinetSlug } = parsed.data
  const mail = email.toLowerCase()

  const existing = db.prepare('SELECT id FROM patients WHERE email = ?').get(mail)
  if (existing) return res.status(409).json({ error: 'Un compte existe déjà avec cet e-mail.' })

  // Rattachement au cabinet si un slug valide est fourni (lien d'inscription du cabinet).
  let cabinetId: number | null = null
  if (cabinetSlug) {
    const cab = db.prepare('SELECT id FROM cabinets WHERE public_slug = ?').get(cabinetSlug) as
      | { id: number }
      | undefined
    cabinetId = cab?.id ?? null
  }

  const token = randomBytes(18).toString('base64url')
  const hash = await hashPassword(password)
  db.prepare(
    'INSERT INTO patients (cabinet_id, name, email, password, token) VALUES (?, ?, ?, ?, ?)',
  ).run(cabinetId, name, mail, hash, token)

  const link = depotLink(token)
  let emailed = false
  let emailError: string | undefined
  if (emailAvailable()) {
    const r = await sendEmail({
      to: mail,
      toName: name,
      subject: 'Votre espace Tableau de Garanti — déposez votre tableau de garanties',
      html: welcomeEmailHtml(name, link),
    })
    emailed = r.ok
    emailError = r.error
  } else {
    emailError = 'E-mail non activé (clé Brevo manquante).'
  }

  // En l'absence d'envoi (dev / clé manquante), on renvoie le lien pour rester testable.
  res.status(201).json({ ok: true, emailed, emailError, token, link: emailed ? undefined : link })
})

/** Connexion patient : renvoie son token/lien de dépôt et son statut. */
patientAccountRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
  const { email, password } = parsed.data
  const row = db
    .prepare('SELECT id, name, email, password, token, status FROM patients WHERE email = ?')
    .get(email.toLowerCase()) as PatientRow | undefined
  if (!row || !(await verifyPassword(password, row.password))) {
    return res.status(401).json({ error: 'E-mail ou mot de passe incorrect.' })
  }
  res.json({ name: row.name, token: row.token, status: row.status, link: depotLink(row.token) })
})

/** Renvoie l'e-mail de bienvenue (si le patient ne l'a pas reçu). */
patientAccountRouter.post('/resend', async (req, res) => {
  const email = String(req.body?.email ?? '').toLowerCase()
  const row = db.prepare('SELECT name, email, token FROM patients WHERE email = ?').get(email) as
    | { name: string; email: string; token: string }
    | undefined
  // Réponse volontairement neutre (pas d'énumération de comptes).
  if (row && emailAvailable()) {
    await sendEmail({
      to: row.email,
      toName: row.name,
      subject: 'Votre lien Tableau de Garanti',
      html: welcomeEmailHtml(row.name, depotLink(row.token)),
    })
  }
  res.json({ ok: true })
})

/** Page de dépôt : infos minimales pour l'en-tête. */
patientAccountRouter.get('/me/:token', (req, res) => {
  const row = db
    .prepare('SELECT name, status FROM patients WHERE token = ?')
    .get(req.params.token) as { name: string; status: string } | undefined
  if (!row) return res.status(404).json({ error: 'Lien invalide ou expiré.' })
  res.json({ name: row.name, status: row.status })
})

/** Le patient transmet ses garanties (extraites côté navigateur). */
patientAccountRouter.post('/me/:token/submit', (req, res) => {
  const exists = db.prepare('SELECT id FROM patients WHERE token = ?').get(req.params.token)
  if (!exists) return res.status(404).json({ error: 'Lien invalide ou expiré.' })
  const parsed = submitSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
  const { garanties, sourceName, rawText, doc } = parsed.data
  if ((!garanties || !Object.keys(garanties).length) && !doc?.dataUrl) {
    return res.status(400).json({ error: 'Veuillez joindre votre tableau de garanties.' })
  }
  const garantiesJson = garanties && Object.keys(garanties).length ? JSON.stringify(garanties) : null
  db.prepare(
    `UPDATE patients SET status = 'received', garanties = ?, source_name = ?, raw_text = ?,
       doc_data = ?, doc_mime = ?, doc_name = ?, submitted_at = datetime('now') WHERE token = ?`,
  ).run(
    garantiesJson,
    sourceName,
    rawText,
    doc?.dataUrl ?? null,
    doc?.mime ?? null,
    doc?.name ?? null,
    req.params.token,
  )
  res.json({ ok: true })
})
