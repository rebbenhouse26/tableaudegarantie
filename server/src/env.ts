// Charge server/.env (s'il existe) AVANT l'évaluation des autres modules.
// Doit être le tout premier import de index.ts.
import { existsSync } from 'node:fs'

try {
  if (existsSync('.env')) {
    // Node ≥ 20.12 / 22 : chargement natif d'un fichier .env.
    process.loadEnvFile('.env')
  }
} catch {
  // .env absent ou non supporté : on s'appuie sur les variables d'environnement existantes.
}
