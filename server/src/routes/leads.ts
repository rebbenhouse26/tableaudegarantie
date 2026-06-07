import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db.js'
import { requireAuth, type AuthRequest } from '../auth.js'

export const leadsRouter = Router()

const leadSchema = z.object({
  nom: z.string().min(1, 'Nom requis.'),
  cabinet: z.string().optional().default(''),
  email: z.string().email('E-mail invalide.'),
  tel: z.string().optional().default(''),
  profil: z.string().optional().default(''),
  taille: z.string().optional().default(''),
  message: z.string().optional().default(''),
})

/** Public : enregistre une demande de démo depuis le site marketing. */
leadsRouter.post('/', (req, res) => {
  const parsed = leadSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message })
  }
  const l = parsed.data
  db.prepare(
    'INSERT INTO leads (nom, cabinet, email, tel, profil, taille, message) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(l.nom, l.cabinet, l.email, l.tel, l.profil, l.taille, l.message)
  res.status(201).json({ ok: true })
})

/** Protégé : liste des leads (pour un futur back-office). */
leadsRouter.get('/', requireAuth, (_req: AuthRequest, res) => {
  const rows = db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all()
  res.json(rows)
})
