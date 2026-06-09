import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db.js'
import { requireAuth, type AuthRequest } from '../auth.js'
import { sendEmail, emailAvailable, leadNotificationHtml } from '../lib/email.js'

export const leadsRouter = Router()

/** Adresse qui reçoit les notifications de nouvelles demandes de démo. */
const LEADS_NOTIFY_EMAIL = process.env.LEADS_NOTIFY_EMAIL ?? process.env.EMAIL_SENDER ?? ''

const leadSchema = z.object({
  nom: z.string().min(1, 'Nom requis.'),
  cabinet: z.string().optional().default(''),
  email: z.string().email('E-mail invalide.'),
  tel: z.string().optional().default(''),
  profil: z.string().optional().default(''),
  taille: z.string().optional().default(''),
  message: z.string().optional().default(''),
})

/** Public : enregistre une demande de démo depuis le site marketing + notifie par e-mail. */
leadsRouter.post('/', async (req, res) => {
  const parsed = leadSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message })
  }
  const l = parsed.data
  db.prepare(
    'INSERT INTO leads (nom, cabinet, email, tel, profil, taille, message) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(l.nom, l.cabinet, l.email, l.tel, l.profil, l.taille, l.message)

  // Notification e-mail (best-effort : n'échoue jamais la requête si l'envoi échoue).
  if (emailAvailable() && LEADS_NOTIFY_EMAIL) {
    const sent = await sendEmail({
      to: LEADS_NOTIFY_EMAIL,
      subject: `Nouvelle demande de démo — ${l.nom}${l.cabinet ? ` (${l.cabinet})` : ''}`,
      html: leadNotificationHtml(l),
      replyTo: l.email,
      replyToName: l.nom,
    })
    if (!sent.ok) console.error('Notification lead non envoyée :', sent.error)
  } else {
    console.warn('Lead enregistré mais notification e-mail désactivée (config manquante).')
  }

  res.status(201).json({ ok: true })
})

/** Protégé : liste des leads (pour un futur back-office). */
leadsRouter.get('/', requireAuth, (_req: AuthRequest, res) => {
  const rows = db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all()
  res.json(rows)
})
