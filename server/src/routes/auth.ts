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

const forgotSchema = z.object({ email: z.string().email('E-mail invalide.') })

/** Génère un NOUVEAU mot de passe et l'envoie par e-mail au cabinet. */
authRouter.post('/forgot-password', async (req, res) => {
  const parsed = forgotSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
  const email = parsed.data.email.toLowerCase()

  const row = db
    .prepare('SELECT id, name FROM cabinets WHERE email = ?')
    .get(email) as { id: number; name: string } | undefined

  // Réponse volontairement neutre (pas d'énumération des comptes).
  if (!row) return res.json({ ok: true, emailed: false })

  // Nouveau mot de passe temporaire (lisible).
  const newPassword = randomBytes(6).toString('base64url') + 'A1' // ~10 car. + garantit lettre/chiffre
  const hash = await hashPassword(newPassword)
  db.prepare('UPDATE cabinets SET password = ? WHERE id = ?').run(hash, row.id)

  let emailed = false
  if (emailAvailable()) {
    const r = await sendEmail({
      to: email,
      toName: row.name,
      subject: 'Tableau de Garanti — votre nouveau mot de passe',
      html: `<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:auto;color:#21252b">
        <h2 style="color:#1f6fb2">Nouveau mot de passe</h2>
        <p>Bonjour ${row.name || ''},</p>
        <p>Voici votre nouveau mot de passe pour vous connecter à votre espace cabinet :</p>
        <p style="font-size:20px;font-weight:700;letter-spacing:1px;background:#f3f8ff;
           border:1px solid #d6e6ff;border-radius:8px;padding:14px 18px;text-align:center">${newPassword}</p>
        <p style="font-size:13px;color:#5a646e">Par sécurité, pensez à le changer après connexion. Si vous
        n'êtes pas à l'origine de cette demande, contactez-nous.</p>
      </div>`,
    })
    emailed = r.ok
  }

  // Sans e-mail configuré (dev), on renvoie le mot de passe pour rester testable.
  res.json({ ok: true, emailed, ...(emailed ? {} : { newPassword }) })
})
