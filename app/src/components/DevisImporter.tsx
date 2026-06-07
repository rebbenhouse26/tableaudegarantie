import { useRef, useState } from 'react'
import './GarantiesImporter.css'
import type { LigneDevis } from '../domain/types'
import { extractDevisVision } from '../api/vision'
import { ApiError } from '../api/client'

interface Props {
  /** Appelé après extraction des lignes du devis. */
  onResult: (lines: LigneDevis[], rawText: string) => void
}

function visionErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return 'Serveur injoignable. Vérifiez que l’API est démarrée.'
    if (e.message) return e.message // message précis renvoyé par le serveur (quota, format, etc.)
  }
  return "L'analyse du devis a échoué. Réessayez."
}

/** Téléversement d'un devis (photo/PDF) → extraction des actes par IA de vision (Gemini). */
export default function DevisImporter({ onResult }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [count, setCount] = useState<number | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')

  function handlePaste() {
    setError(null)
    setCount(null)
    void (async () => {
      try {
        const { parseDevisText, rawLinesToDevis } = await import('../domain/devisOcr')
        const raw = parseDevisText(pasteText)
        const lines = rawLinesToDevis(raw)
        onResult(lines, pasteText)
        setCount(lines.length)
        setFileName('Devis collé (texte)')
        if (lines.length === 0) {
          setError("Aucun acte n'a pu être reconnu dans le texte collé. Ajoutez les actes manuellement ci-dessous.")
        }
      } catch (e) {
        console.error(e)
        setError('Lecture du texte impossible. Ajoutez les actes manuellement ci-dessous.')
        onResult([], '')
      }
    })()
  }

  async function handleFile(file: File) {
    setError(null)
    setCount(null)
    setFileName(file.name)
    setBusy(true)
    try {
      const raw = await extractDevisVision(file)
      const { rawLinesToDevis } = await import('../domain/devisOcr')
      const lines = rawLinesToDevis(raw)
      onResult(lines, '')
      setCount(lines.length)
      if (lines.length === 0) {
        setError("Aucun acte n'a pu être reconnu. Ajoutez les actes manuellement ci-dessous.")
      }
    } catch (e) {
      console.error(e)
      setError(visionErrorMessage(e))
      onResult([], '')
    } finally {
      setBusy(false)
    }
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
        <div className="gi-ico">🧾</div>
        <div>
          <b>{busy ? 'Analyse du devis par l’IA…' : 'Importer le devis (photo ou PDF)'}</b>
          <p>{fileName || 'JPG, PNG ou PDF — le devis du cabinet'}</p>
        </div>
      </button>

      <div style={{ marginTop: 8, fontSize: 13 }}>
        <button
          type="button"
          onClick={() => setPasteOpen((v) => !v)}
          style={{ background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer', fontWeight: 600, padding: 0 }}
        >
          {pasteOpen ? '▾' : '▸'} Ou coller le devis en texte (depuis Logosw, Word…)
        </button>
      </div>

      {pasteOpen && (
        <div style={{ marginTop: 10 }}>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={6}
            placeholder={'Collez ici les lignes du devis, une par ligne.\nEx :  HBLD634  Couronne céramo-métallique  26  500,00'}
            style={{
              width: '100%',
              borderRadius: 10,
              border: '1px solid var(--line)',
              padding: 10,
              font: 'inherit',
              fontSize: 13,
              resize: 'vertical',
            }}
          />
          <button
            type="button"
            className="btn"
            style={{ marginTop: 8 }}
            disabled={pasteText.trim().length < 5}
            onClick={handlePaste}
          >
            Lire le texte collé
          </button>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
            Lecture automatique du code CCAM et du montant (le plus élevé de la ligne = honoraires). Vérifiez et corrigez ci-dessous.
          </p>
        </div>
      )}

      {busy && (
        <div className="gi-progress">
          <span>Lecture du devis par l’IA de vision…</span>
        </div>
      )}

      {count !== null && !busy && count > 0 && (
        <p className="gi-msg">
          ✓ Devis analysé — <b>{count}</b> acte{count > 1 ? 's' : ''} reconnu{count > 1 ? 's' : ''}.
          Vérifiez et corrigez ci-dessous. <span style={{ opacity: 0.7 }}>(IA de vision)</span>
        </p>
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
