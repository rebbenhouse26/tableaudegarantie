import { Router } from 'express'
import { z } from 'zod'
import { ALMA_INSTALLMENTS, almaAvailable, createAlmaPayment } from '../lib/alma.js'
import { klarnaAvailable, createKlarnaPayment } from '../lib/klarna.js'

/**
 * Paiement en plusieurs fois pour étaler un reste à charge élevé.
 * GET  /api/payments/config       → fournisseurs disponibles (Alma, Klarna) + échéances.
 * POST /api/payments/alma         → crée le paiement Alma (échéances 2-10×) → URL.
 * POST /api/payments/klarna       → crée la page Klarna (échéances selon Klarna) → URL.
 */
export const paymentsRouter = Router()

paymentsRouter.get('/config', (_req, res) => {
  res.json({
    alma: { available: almaAvailable(), installments: ALMA_INSTALLMENTS },
    klarna: { available: klarnaAvailable() },
  })
})

// Rétro-compat : ancien endpoint dédié Alma.
paymentsRouter.get('/alma/config', (_req, res) => {
  res.json({ available: almaAvailable(), installments: ALMA_INSTALLMENTS })
})

const createSchema = z.object({
  amount: z.number().positive('Montant invalide.'),
  installments: z.number().int().refine((n) => (ALMA_INSTALLMENTS as readonly number[]).includes(n), {
    message: 'Nombre d’échéances non supporté.',
  }),
  patientName: z.string().trim().optional(),
  returnUrl: z.string().url().optional(),
})

paymentsRouter.post('/alma', async (req, res) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Requête invalide.' })
  }
  const { amount, installments, patientName, returnUrl } = parsed.data
  const out = await createAlmaPayment({ amountEuros: amount, installments, customerName: patientName, returnUrl })
  if (!out.ok) return res.status(almaAvailable() ? 502 : 503).json({ error: out.error })
  res.json({ url: out.url })
})

const klarnaSchema = z.object({
  amount: z.number().positive('Montant invalide.'),
  patientName: z.string().trim().optional(),
  returnUrl: z.string().url().optional(),
})

paymentsRouter.post('/klarna', async (req, res) => {
  const parsed = klarnaSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Requête invalide.' })
  }
  const { amount, patientName, returnUrl } = parsed.data
  const out = await createKlarnaPayment({ amountEuros: amount, customerName: patientName, returnUrl })
  if (!out.ok) return res.status(klarnaAvailable() ? 502 : 503).json({ error: out.error })
  res.json({ url: out.url })
})
