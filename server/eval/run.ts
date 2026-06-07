/**
 * Harnais d'évaluation de l'extraction par vision.
 *   1. Déposer les images dans server/eval/images/ (noms = "file" du groundtruth.json).
 *   2. export GEMINI_API_KEY=...  (et éventuellement GEMINI_MODEL)
 *   3. npm run eval   (depuis server/)
 *
 * Le script appelle Gemini sur chaque image et compare la colonne la plus élevée à la
 * vérité-terrain, poste par poste. Sert à mesurer et améliorer le prompt méthodiquement.
 */
import '../src/env.js' // charge server/.env (GEMINI_API_KEY) automatiquement
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, extname } from 'node:path'
import { geminiExtractGaranties, type VisionGarantie } from '../src/lib/geminiVision.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const POSTES = ['soins', 'prothese', 'inlaycore', 'implant', 'paro', 'ortho', 'esthetique'] as const

const ZERO = { type: 'pct', val: 0, plafond: 0 } as const

interface Case {
  file: string
  source: string
  expected: Record<(typeof POSTES)[number], VisionGarantie>
}

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
}

function matches(a: VisionGarantie, b: VisionGarantie): boolean {
  if (a.type !== b.type) return false
  const tol = Math.max(2, Math.abs(b.val) * 0.1) // 10 % ou 2 d'écart toléré
  return Math.abs(a.val - b.val) <= tol
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY manquant. export GEMINI_API_KEY=... puis relancez.')
    process.exit(1)
  }
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
  const gt = JSON.parse(readFileSync(join(__dirname, 'groundtruth.json'), 'utf-8')) as {
    cases: Case[]
  }

  let totalPostes = 0
  let okPostes = 0
  let tested = 0

  for (const c of gt.cases) {
    const imgPath = join(__dirname, 'images', c.file)
    if (!existsSync(imgPath)) {
      console.log(`⚠️  ${c.file} — image absente (eval/images/), ignorée.`)
      continue
    }
    tested++
    const mimeType = MIME[extname(c.file).toLowerCase()] ?? 'image/jpeg'
    const dataBase64 = readFileSync(imgPath).toString('base64')
    try {
      const r = await geminiExtractGaranties({ apiKey, model, mimeType, dataBase64 })
      const got = r.columns[r.defaultColumnIndex] ?? r.columns[r.columns.length - 1]
      let caseOk = 0
      const diffs: string[] = []
      for (const p of POSTES) {
        totalPostes++
        let exp = (c.expected[p] ?? ZERO) as VisionGarantie
        let val = (got?.[p] ?? ZERO) as VisionGarantie
        // Inlay-core : on compare le taux EFFECTIF (repli sur prothèse si pas de ligne dédiée),
        // des deux côtés → un inlay-core à 0 ou recopié du taux prothèse est jugé correct.
        if (p === 'inlaycore') {
          if (exp.val === 0) exp = (c.expected.prothese ?? ZERO) as VisionGarantie
          if (val.val === 0) val = (got?.prothese ?? ZERO) as VisionGarantie
        }
        if (matches(val, exp)) {
          okPostes++
          caseOk++
        } else {
          diffs.push(
            `${p}: attendu ${exp.type} ${exp.val} → obtenu ${val.val ? `${val.type} ${val.val}` : 'absent'}`,
          )
        }
      }
      console.log(`\n📄 ${c.source}`)
      console.log(`   ${caseOk}/${POSTES.length} postes corrects` + (diffs.length ? ' — écarts :' : ''))
      diffs.forEach((d) => console.log(`     • ${d}`))
    } catch (e) {
      console.log(`\n📄 ${c.source}\n   ❌ erreur d'extraction : ${(e as Error).message}`)
    }
  }

  console.log('\n──────────────────────────────────────')
  if (tested === 0) {
    console.log('Aucune image trouvée dans eval/images/. Déposez-y vos tableaux puis relancez.')
  } else {
    const pct = totalPostes ? Math.round((okPostes / totalPostes) * 100) : 0
    console.log(`Score global : ${okPostes}/${totalPostes} postes corrects (${pct} %) sur ${tested} tableau(x).`)
  }
}

main()
