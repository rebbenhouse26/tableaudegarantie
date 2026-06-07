/**
 * Harnais d'évaluation de l'extraction des DEVIS dentaires par vision.
 *   1. Déposer les pages de devis (PNG/JPG/PDF) dans server/eval/devis-images/
 *      (noms = "file" du groundtruth.devis.json).
 *   2. export GEMINI_API_KEY=...  (et éventuellement GEMINI_MODEL)
 *   3. npm run eval:devis   (depuis server/)
 *
 * Le script appelle Gemini sur chaque devis, apparie les lignes extraites aux lignes attendues
 * (priorité au code CCAM puis aux honoraires), et mesure :
 *   - honoraires (prix) correctement lus  ← critère principal (le bug n°1 = lire un mauvais montant)
 *   - code CCAM correctement recopié
 *   - poste (cat) correct
 * Sert à mesurer et améliorer le DEVIS_PROMPT méthodiquement.
 */
import '../src/env.js'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, extname } from 'node:path'
import { geminiExtractDevis, type DevisLineRaw } from '../src/lib/geminiVision.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

interface ExpLine {
  code: string
  cat: string
  dent: string
  prix: number
  panier: string
}
interface Case {
  file: string
  source: string
  expected: ExpLine[]
}

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
}

/** Code CCAM normalisé (4 lettres + 3 chiffres) ou '' si absent. */
function normCode(c?: string): string {
  const m = (c ?? '').toUpperCase().match(/[A-Z]{4}\d{3}/)
  return m ? m[0] : ''
}
function prixTol(p: number): number {
  return Math.max(1, Math.abs(p) * 0.02) // honoraires : lecture quasi exacte (2 % / 1 €)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Appel Gemini avec quelques tentatives (les `fetch failed` réseau sont transitoires). */
async function extractWithRetry(
  opts: { apiKey: string; model: string; mimeType: string; dataBase64: string },
  tries = 3,
): Promise<{ lines?: DevisLineRaw[] }> {
  let lastErr: unknown
  for (let i = 0; i < tries; i++) {
    try {
      return await geminiExtractDevis(opts)
    } catch (e) {
      lastErr = e
      if (i < tries - 1) await sleep(1500 * (i + 1))
    }
  }
  throw lastErr
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY manquant. export GEMINI_API_KEY=... puis relancez.')
    process.exit(1)
  }
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
  const gt = JSON.parse(readFileSync(join(__dirname, 'groundtruth.devis.json'), 'utf-8')) as {
    cases: Case[]
  }

  let totLines = 0
  let okPrix = 0
  let okCode = 0
  let okCat = 0
  let totExtra = 0
  let tested = 0

  for (const c of gt.cases) {
    const imgPath = join(__dirname, 'devis-images', c.file)
    if (!existsSync(imgPath)) {
      console.log(`⚠️  ${c.file} — image absente (eval/devis-images/), ignorée.`)
      continue
    }
    tested++
    const mimeType = MIME[extname(c.file).toLowerCase()] ?? 'image/png'
    const dataBase64 = readFileSync(imgPath).toString('base64')
    try {
      const r = await extractWithRetry({ apiKey, model, mimeType, dataBase64 })
      const got: DevisLineRaw[] = r.lines ?? []
      const used = new Array(got.length).fill(false)
      let cPrix = 0
      let cCode = 0
      let cCat = 0
      const diffs: string[] = []

      for (const exp of c.expected) {
        totLines++
        const expCode = normCode(exp.code)
        // 1) priorité : ligne non utilisée avec MÊME code ET prix compatible.
        let j = got.findIndex(
          (g, i) =>
            !used[i] && expCode && normCode(g.code) === expCode && Math.abs(g.prix - exp.prix) <= prixTol(exp.prix),
        )
        // 2) sinon : ligne non utilisée avec prix compatible.
        if (j < 0) j = got.findIndex((g, i) => !used[i] && Math.abs(g.prix - exp.prix) <= prixTol(exp.prix))
        if (j < 0) {
          diffs.push(`✗ ligne ${expCode || exp.cat} ${exp.prix}€ — non retrouvée`)
          continue
        }
        used[j] = true
        cPrix++
        okPrix++
        const g = got[j]
        if (expCode && normCode(g.code) === expCode) {
          cCode++
          okCode++
        } else if (expCode) {
          diffs.push(`~ ${exp.prix}€ : code attendu ${expCode}, obtenu "${g.code ?? ''}"`)
        } else {
          cCode++
          okCode++ // pas de code attendu → non pénalisant
        }
        if ((g.cat ?? '') === exp.cat) {
          cCat++
          okCat++
        } else {
          diffs.push(`~ ${expCode || exp.prix + '€'} : poste attendu ${exp.cat}, obtenu "${g.cat ?? ''}"`)
        }
      }
      const extra = used.filter((u) => !u).length
      totExtra += extra
      console.log(`\n📄 ${c.source}`)
      console.log(
        `   prix ${cPrix}/${c.expected.length} · code ${cCode}/${c.expected.length} · poste ${cCat}/${c.expected.length}` +
          (extra ? ` · +${extra} ligne(s) en trop` : ''),
      )
      diffs.slice(0, 12).forEach((d) => console.log(`     • ${d}`))
    } catch (e) {
      totLines += c.expected.length
      console.log(`\n📄 ${c.source}\n   ❌ erreur d'extraction : ${(e as Error).message}`)
    }
  }

  console.log('\n──────────────────────────────────────')
  if (tested === 0) {
    console.log('Aucune image trouvée dans eval/devis-images/.')
  } else {
    const pct = (n: number) => (totLines ? Math.round((n / totLines) * 100) : 0)
    console.log(`Devis testés : ${tested} · lignes attendues : ${totLines}`)
    console.log(`  Honoraires lus correctement : ${okPrix}/${totLines} (${pct(okPrix)} %)  ← critère principal`)
    console.log(`  Codes CCAM corrects         : ${okCode}/${totLines} (${pct(okCode)} %)`)
    console.log(`  Postes (cat) corrects       : ${okCat}/${totLines} (${pct(okCat)} %)`)
    console.log(`  Lignes en trop (faux positifs) : ${totExtra}`)
  }
}

main()
