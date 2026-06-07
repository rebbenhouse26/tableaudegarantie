import './env.js' // charge .env en premier (avant lecture des variables par les routes)
import express from 'express'
import cors from 'cors'
import './db.js' // initialise la base au démarrage
import { authRouter } from './routes/auth.js'
import { devisRouter } from './routes/devis.js'
import { leadsRouter } from './routes/leads.js'
import { patientRequestsRouter } from './routes/patientRequests.js'
import { publicInviteRouter } from './routes/publicInvite.js'
import { publicCabinetRouter } from './routes/publicCabinet.js'
import { extractRouter } from './routes/extract.js'
import { paymentsRouter } from './routes/payments.js'
import { patientAccountRouter } from './routes/patientAccount.js'

const PORT = Number(process.env.PORT ?? 4000)
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173'

const app = express()
app.use(cors({ origin: CORS_ORIGIN }))
// Limite élevée : les images de tableaux sont transmises en base64 pour l'extraction par vision.
app.use(express.json({ limit: '45mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/auth', authRouter)
app.use('/api/devis', devisRouter)
app.use('/api/leads', leadsRouter)
app.use('/api/patient-requests', patientRequestsRouter)
app.use('/api/public/invite', publicInviteRouter)
app.use('/api/public/cabinet', publicCabinetRouter)
app.use('/api/extract', extractRouter)
app.use('/api/payments', paymentsRouter)
app.use('/api/patient', patientAccountRouter)

// Gestionnaire d'erreurs JSON générique.
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err)
    res.status(500).json({ error: 'Erreur serveur.' })
  },
)

app.listen(PORT, () => {
  console.log(`API Tableau de Garanti à l'écoute sur http://localhost:${PORT}`)
})
