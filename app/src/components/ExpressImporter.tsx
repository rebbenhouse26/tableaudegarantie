import { useRef, useState } from 'react'
import './GarantiesImporter.css'
import type { GarantiesParPoste, LigneDevis } from '../domain/types'
import type { VisionColumn } from '../api/types'
import { extractCombined, visionColumnToGaranties } from '../api/vision'
import { ApiError } from '../api/client'
import { rawLinesToDevis } from '../domain/devisOcr'

interface Props {
  /** Appelé une fois la formule choisie (et à chaque changement de formule). */
  onResult: (garanties: GarantiesParPoste, sourceName: string, lines: LigneDevis[]) => void
}

function visionErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return 'Serveur injoignable. Vérifiez que l’API est démarrée.'
    if (e.message) return e.message
  }
  return "L'analyse a échoué. Réessayez."
}

export default function ExpressImporter({ onResult }: Props) {
  const garRef = useRef<HTMLInputElement>(null)
  const devRef = useRef<HTMLInputElement>(null)
  const [garFile, setGarFile] = useState<File | null>(null)
  const [devFile, setDevFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [visionCols, setVisionCols] = useState<VisionColumn[] | null>(null)
  const [col, setCol] = useState(-1)
  const [lines, setLines] = useState<LigneDevis[] | null>(null)

  async function analyze() {
    if (!garFile || !devFile) return
    setError(null)
    setVisionCols(null)
    setCol(-1)
    setLines(null)
    setBusy(true)
    try {
      const out = await extractCombined(garFile, devFile)
      const cols = out.garanties?.columns ?? []
      if (!cols.length) throw new Error('Aucune garantie détectée')
      const mappedLines = rawLinesToDevis(out.devis)
      setVisionCols(cols)
      setLines(mappedLines)
      if (cols.length === 1) {
        setCol(0)
        onResult(visionColumnToGaranties(cols[0]), 'Documents importés (express)', mappedLines)
      }
      // Plusieurs formules → on attend le choix (rien n'est appliqué tant que col = -1).
    } catch (e) {
      console.error(e)
      setError(visionErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  function chooseColumn(i: number) {
    if (!visionCols || !lines || i < 0) return
    setCol(i)
    onResult(visionColumnToGaranties(visionCols[i]), 'Documents importés (express)', lines)
  }

  const Drop = ({
    file,
    onPick,
    icon,
    label,
    inputRef,
  }: {
    file: File | null
    onPick: (f: File) => void
    icon: string
    label: string
    inputRef: React.RefObject<HTMLInputElement>
  }) => (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif,application/pdf,.pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onPick(f)
        }}
      />
      <button type="button" className="gi-dropzone" onClick={() => inputRef.current?.click()} disabled={busy}>
        <div className="gi-ico">{file ? '✓' : icon}</div>
        <div>
          <b>{label}</b>
          <p>{file ? file.name : 'JPG, PNG ou PDF'}</p>
        </div>
      </button>
    </>
  )

  return (
    <div>
      <div className="express-grid">
        <div className="express-doc">
          <div className="express-doc-title">
            <span className={'express-num' + (garFile ? ' ok' : '')}>{garFile ? '✓' : '1'}</span>
            Tableau de garanties
          </div>
          <Drop file={garFile} onPick={setGarFile} icon="📄" label="Choisir le tableau" inputRef={garRef} />
        </div>
        <div className="express-doc">
          <div className="express-doc-title">
            <span className={'express-num' + (devFile ? ' ok' : '')}>{devFile ? '✓' : '2'}</span>
            Devis du cabinet
          </div>
          <Drop file={devFile} onPick={setDevFile} icon="🧾" label="Choisir le devis" inputRef={devRef} />
        </div>
      </div>

      <div className="btn-row">
        <button className="btn" disabled={!garFile || !devFile || busy} onClick={analyze}>
          {busy ? 'Analyse des 2 documents par l’IA…' : 'Analyser les 2 documents →'}
        </button>
      </div>

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
                  ✓ Formule « {visionCols[col].label} » · <b>{lines?.length ?? 0}</b> acte
                  {(lines?.length ?? 0) > 1 ? 's' : ''} au devis.{' '}
                  <span style={{ opacity: 0.7 }}>(IA de vision)</span>
                </p>
              )}
            </div>
          ) : (
            <p className="gi-msg">
              ✓ Documents analysés — <b>{lines?.length ?? 0}</b> acte
              {(lines?.length ?? 0) > 1 ? 's' : ''} au devis.{' '}
              <span style={{ opacity: 0.7 }}>(IA de vision)</span>
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
