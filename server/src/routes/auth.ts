import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { db } from '../db.js'
import { hashPassword, signToken, verifyPassword } from '../auth.js'
import { emailAvailable, sendEmail } from '../lib/email.js'

export const authRouter = Router()

const registerSchema = z.object({
  name: z.string().min(1, 'Nom du cabinet requis.'),
  email: z.string().email('E-mail invalide.'),
  password: z.string().min(8, 'Mot de passe : 8 caractères minimum.'),
})

const loginSchema = z.object({
  email: z.string().email('E-mail invalide.'),
  password: z.string().min(1, 'Mot de passe requis.'),
})

interface CabinetRow {
  id: number
  name: string
  email: string
  password: string
}

authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message })
  }
  const { name, email, password } = parsed.data

  const existing = db.prepare('SELECT id FROM cabinets WHERE email = ?').get(email.toLowerCase())
  if (existing) {
    return res.status(409).json({ error: 'Un compte existe déjà avec cet e-mail.' })
  }

  const hash = await hashPassword(password)
  const info = db
    .prepare('INSERT INTO cabinets (name, email, password) VALUES (?, ?, ?)')
    .run(name, email.toLowerCase(), hash)

  const payload = { id: Number(info.lastInsertRowid), email: email.toLowerCase(), name }
  res.status(201).json({ token: signToken(payload), cabinet: payload })
})

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message })
  }
  const { email, password } = parsed.data

  const row = db
    .prepare('SELECT id, name, email, password FROM cabinets WHERE email = ?')
    .get(email.toLowerCase()) as CabinetRow | undefined

  if (!row || !(await verifyPassword(password, row.password))) {
    return res.status(401).json({ error: 'E-mail ou mot de passe incorrect.' })
  }

  const payload = { id: row.id, email: row.email, name: row.name }
  res.json({ token: signToken(payload), cabinet: payload })
})

const APP_BASE_URL = (process.env.APP_BASE_URL ?? process.env.CORS_ORIGIN ?? 'http://localhost:5173').replace(/\/$/, '')
const RESET_TTL_MIN = 60 // lien valable 1 heure

const forgotSchema = z.object({ email: z.string().email('E-mail invalide.') })

/** Envoie un LIEN de réinitialisation de mot de passe (valable 1 h). */
authRouter.post('/forgot-password', async (req, res) => {
  const parsed = forgotSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
  const email = parsed.data.email.toLowerCase()

  const row = db
    .prepare('SELECT id, name FROM cabinets WHERE email = ?')
    .get(email) as { id: number; name: string } | undefined

  // Réponse volontairement neutre (pas d'énumération des comptes).
  if (!row) return res.json({ ok: true, emailed: false })

  const token = randomBytes(24).toString('base64url')
  const expires = new Date(Date.now() + RESET_TTL_MIN * 60_000).toISOString()
  db.prepare('UPDATE cabinets SET reset_token = ?, reset_expires = ? WHERE id = ?').run(token, expires, row.id)
  const link = `${APP_BASE_URL}/reinitialiser-mot-de-passe/${token}`

  let emailed = false
  if (emailAvailable()) {
    const r = await sendEmail({
      to: email,
      toName: row.name,
      subject: 'Garant-AI — réinitialisation de votre mot de passe',
      html: `<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:auto;color:#21252b">
        <h2 style="color:#1f6fb2">Réinitialisation du mot de passe</h2>
        <p>Bonjour ${row.name || ''},</p>
        <p>Vous avez demandé à réinitialiser le mot de passe de votre espace cabinet. Cliquez sur le
        bouton ci-dessous (lien valable 1 heure) :</p>
        <p style="text-align:center;margin:26px 0">
          <a href="${link}" style="background:#1f6fb2;color:#fff;text-decoration:none;padding:13px 26px;
             border-radius:8px;font-weight:600;display:inline-block">Choisir un nouveau mot de passe</a>
        </p>
        <p style="font-size:13px;color:#5a646e">Ou copiez ce lien : <br><a href="${link}">${link}</a></p>
        <p style="font-size:12px;color:#8a949e">Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>
      </div>`,
    })
    emailed = r.ok
  }

  // Sans e-mail configuré (dev), on renvoie le lien pour rester testable.
  res.json({ ok: true, emailed, ...(emailed ? {} : { link }) })
})

/** Vérifie qu'un token de réinitialisation est valide (et non expiré). */
authRouter.get('/reset-password/:token', (req, res) => {
  const row = db
    .prepare('SELECT reset_expires FROM cabinets WHERE reset_token = ?')
    .get(req.params.token) as { reset_expires: string | null } | undefined
  if (!row || !row.reset_expires || new Date(row.reset_expires).getTime() < Date.now()) {
    return res.status(400).json({ error: 'Lien invalide ou expiré.' })
  }
  res.json({ ok: true })
})

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Mot de passe : 8 caractères minimum.'),
})

/** Définit un nouveau mot de passe à partir d'un token valide. */
authRouter.post('/reset-password', async (req, res) => {
  const parsed = resetSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
  const { token, password } = parsed.data
  const row = db
    .prepare('SELECT id, reset_expires FROM cabinets WHERE reset_token = ?')
    .get(token) as { id: number; reset_expires: string | null } | undefined
  if (!row || !row.reset_expires || new Date(row.reset_expires).getTime() < Date.now()) {
    return res.status(400).json({ error: 'Lien invalide ou expiré. Refaites une demande.' })
  }
  const hash = await hashPassword(password)
  db.prepare('UPDATE cabinets SET password = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?').run(hash, row.id)
  res.json({ ok: true })
})
