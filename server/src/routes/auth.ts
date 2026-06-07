import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db.js'
import { hashPassword, signToken, verifyPassword } from '../auth.js'

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
