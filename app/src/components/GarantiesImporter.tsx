import { useRef, useState } from 'react'
import './GarantiesImporter.css'
import { emptyGaranties } from '../domain/garanties'
import type { GarantiesParPoste } from '../domain/types'
import type { VisionColumn } from '../api/types'
import { extractGarantiesVision, visionColumnToGaranties } from '../api/vision'
import { ApiError } from '../api/client'

interface Props {
  /** Appelé une fois la formule choisie (et à chaque changement de formule). */
  onResult: (garanties: GarantiesParPoste, sourceName: string, rawText: string) => void
  /** Appelé avec le fichier d'origine (data URL) dès sa sélection — pour stockage/téléchargement. */
  onFile?: (file: { dataUrl: string; name: string; mime: string }) => void
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

function countPostes(g: GarantiesParPoste): number {
  return (Object.values(g) as GarantiesParPoste['soins'][]).filter((x) => x.val > 0).length
}

function visionErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return 'Serveur injoignable. Vérifiez que l’API est démarrée.'
    if (e.message) return e.message
  }
  return "L'analyse du document a échoué. Réessayez."
}

/** Téléversement d'un tableau de garanties (photo/PDF) → extraction par IA + choix de la formule. */
export default function GarantiesImporter({ onResult, onFile }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [visionCols, setVisionCols] = useState<VisionColumn[] | null>(null)
  const [col, setCol] = useState(-1) // -1 = formule pas encore choisie

  async function handleFile(file: File) {
    setError(null)
    setVisionCols(null)
    setCol(-1)
    setFileName(file.name)
    setBusy(true)
    // Capte le fichier d'origine (pour téléchargement côté cabinet), sans bloquer l'analyse.
    if (onFile) {
      readAsDataUrl(file)
        .then((dataUrl) => onFile({ dataUrl, name: file.name, mime: file.type }))
        .catch(() => {})
    }
    try {
      const vis = await extractGarantiesVision(file)
      if (!vis?.columns?.length) throw new Error('Aucune garantie détectée')
      setVisionCols(vis.columns)
      if (vis.columns.length === 1) {
        // Une seule formule : on l'applique directement.
        setCol(0)
        onResult(visionColumnToGaranties(vis.columns[0]), `Document analysé — ${file.name}`, '')
      }
      // Plusieurs formules : on attend le choix de l'utilisateur (col reste -1, rien n'est appliqué).
    } catch (e) {
      console.error(e)
      setError(visionErrorMessage(e))
      onResult(emptyGaranties(), `Document — ${file.name}`, '')
    } finally {
      setBusy(false)
    }
  }

  function chooseColumn(i: number) {
    if (!visionCols || i < 0) return
    setCol(i)
    onResult(visionColumnToGaranties(visionCols[i]), `Document analysé — ${fileName}`, '')
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.heic,.heif,application/pdf,.pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
        }}
      />
      <button
        type="button"
        className="gi-dropzone"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
      >
        <div className="gi-ico">📄</div>
        <div>
          <b>{busy ? 'Analyse par l’IA…' : 'Choisir une photo ou un PDF'}</b>
          <p>{fileName || 'JPG, PNG ou PDF — votre tableau de garanties'}</p>
        </div>
      </button>

      {busy && (
        <div className="gi-progress">
          <span>Lecture du document par l’IA de vision…</span>
        </div>
      )}

      {visionCols && !busy && (
        <>
          {visionCols.length > 1 ? (
            <div className={'gi-choice' + (col < 0 ? ' pending' : '')}>
              <label>
                {col < 0 ? '⚠️ ' : '✓ '}
                {visionCols.length} formules détectées — <b>quelle est la formule du contrat du
                patient&nbsp;?</b>
              </label>
              <select value={col} onChange={(e) => chooseColumn(+e.target.value)}>
                <option value={-1} disabled>
                  — Sélectionnez la formule —
                </option>
                {visionCols.map((c, i) => (
                  <option key={i} value={i}>
                    {c.label}
                  </option>
                ))}
              </select>
              {col >= 0 && (
                <p className="gi-msg" style={{ marginTop: 8 }}>
                  ✓ Formule « {visionCols[col].label} » —{' '}
                  <b>{countPostes(visionColumnToGaranties(visionCols[col]))}</b> postes détectés.{' '}
                  <span style={{ opacity: 0.7 }}>(IA de vision)</span>
                </p>
              )}
            </div>
          ) : (
            <p className="gi-msg">
              ✓ Document analysé —{' '}
              <b>{countPostes(visionColumnToGaranties(visionCols[0]))}</b> postes de garantie
              détectés. <span style={{ opacity: 0.7 }}>(IA de vision)</span>
            </p>
          )}
        </>
      )}

      {error && (
        <div className="gi-err">
          <span>⚠️</span>
          <div>{error}</div>
        </div>
      )}
    </div>
  )
}
