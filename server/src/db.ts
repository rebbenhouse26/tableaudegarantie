import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomBytes } from 'node:crypto'

const DB_PATH = process.env.DB_PATH ?? 'data/tableau-de-garanti.db'

mkdirSync(dirname(DB_PATH), { recursive: true })

export const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS cabinets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    password    TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS devis (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    cabinet_id    INTEGER NOT NULL REFERENCES cabinets(id) ON DELETE CASCADE,
    patient_name  TEXT NOT NULL,
    mutuelle_id   TEXT NOT NULL,
    payload       TEXT NOT NULL,           -- JSON : lignes, totaux, etc.
    total_rac     REAL NOT NULL DEFAULT 0, -- reste à charge total, pour l'affichage liste
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_devis_cabinet ON devis(cabinet_id);

  CREATE TABLE IF NOT EXISTS patient_requests (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    cabinet_id    INTEGER NOT NULL REFERENCES cabinets(id) ON DELETE CASCADE,
    token         TEXT NOT NULL UNIQUE,
    patient_name  TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'received'
    source_name   TEXT NOT NULL DEFAULT '',
    garanties     TEXT,                              -- JSON des garanties transmises
    raw_text      TEXT,                              -- texte brut OCR (transparence)
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    received_at   TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_preq_cabinet ON patient_requests(cabinet_id);
  CREATE INDEX IF NOT EXISTS idx_preq_token ON patient_requests(token);

  CREATE TABLE IF NOT EXISTS patients (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    cabinet_id    INTEGER REFERENCES cabinets(id) ON DELETE SET NULL,  -- cabinet rattaché (via slug)
    name          TEXT NOT NULL DEFAULT '',
    email         TEXT NOT NULL UNIQUE,
    password      TEXT NOT NULL,
    token         TEXT NOT NULL UNIQUE,             -- lien personnel permanent de dépôt
    status        TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'received'
    source_name   TEXT NOT NULL DEFAULT '',
    garanties     TEXT,                             -- JSON des garanties transmises
    raw_text      TEXT,                             -- texte brut OCR (transparence)
    doc_data      TEXT,                             -- document original (data URL base64)
    doc_mime      TEXT,                             -- type MIME du document
    doc_name      TEXT,                             -- nom de fichier d'origine
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    submitted_at  TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_patients_token ON patients(token);

  CREATE TABLE IF NOT EXISTS leads (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nom         TEXT NOT NULL,
    cabinet     TEXT,
    email       TEXT NOT NULL,
    tel         TEXT,
    profil      TEXT,
    taille      TEXT,
    message     TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

// --- Migrations légères (ajout de colonnes sans casser l'existant) ---
function addColumn(table: string, def: string) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${def}`)
  } catch {
    /* la colonne existe déjà */
  }
}
// Lien permanent public du cabinet (à coller dans Doctolib / afficher en QR code).
addColumn('cabinets', 'public_slug TEXT')
// Téléphone patient (base pour un futur envoi SMS/WhatsApp du lien).
addColumn('patient_requests', 'phone TEXT')
// Document original déposé par le patient (pour téléchargement par le cabinet).
addColumn('patient_requests', 'doc_data TEXT')
addColumn('patient_requests', 'doc_mime TEXT')
addColumn('patient_requests', 'doc_name TEXT')
// Réinitialisation de mot de passe cabinet (lien à durée limitée).
addColumn('cabinets', 'reset_token TEXT')
addColumn('cabinets', 'reset_expires TEXT')
// Espace patient : rattachement cabinet + document original déposé (pour téléchargement cabinet).
addColumn('patients', 'cabinet_id INTEGER')
addColumn('patients', 'doc_data TEXT')
addColumn('patients', 'doc_mime TEXT')
addColumn('patients', 'doc_name TEXT')

// Backfill : chaque cabinet doit avoir un slug public unique.
const genSlug = () => randomBytes(9).toString('base64url')
const missing = db
  .prepare('SELECT id FROM cabinets WHERE public_slug IS NULL OR public_slug = ?')
  .all('') as { id: number }[]
const setSlug = db.prepare('UPDATE cabinets SET public_slug = ? WHERE id = ?')
for (const c of missing) setSlug.run(genSlug(), c.id)
