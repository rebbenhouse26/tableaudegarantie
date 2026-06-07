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
