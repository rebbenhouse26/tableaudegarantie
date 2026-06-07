import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import './Account.css'
import GarantiesImporter from '../components/GarantiesImporter'
import { API_URL } from '../api/client'
import { POSTES } from '../domain/garanties'
import { POSTE_LABEL } from '../domain/mutuelles'
import { eur } from '../domain/calcul'
import type { GarantiesParPoste } from '../domain/types'

interface Me {
  name: string
  status: string
}

export default function PatientEspace() {
  const { token } = useParams<{ token: string }>()
  const [me, setMe] = useState<Me | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [garanties, setGaranties] = useState<GarantiesParPoste | null>(null)
  const [sourceName, setSourceName] = useState('')
  const [rawText, setRawText] = useState('')
  const [doc, setDoc] = useState<{ dataUrl: string; name: string; mime: string } | null>(null)
  const [consent, setConsent] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendErr, setSendErr] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_URL}/patient/me/${token}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Lien invalide.')
        return r.json()
      })
      .then((m: Me) => {
        setMe(m)
        if (m.status === 'received') setSent(true)
      })
      .catch((e) => setLoadErr(e.message))
  }, [token])

  async function handleSend() {
    if (!garanties) return
    setSendErr(null)
    setSending(true)
    try {
      const r = await fetch(`${API_URL}/patient/me/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ garanties, sourceName, rawText, doc: doc ?? undefined }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Envoi impossible.')
      setSent(true)
    } catch (e) {
      setSendErr(e instanceof Error ? e.message : 'Envoi impossible.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="acct">
      <div className="topbar">
        <span className="brand">
          <span className="logo">TG</span>
          Tableau de Garanti
        </span>
      </div>

      <div className="auth-wrap" style={{ maxWidth: 560 }}>
        <div className="auth-card">
          {loadErr ? (
            <>
              <h1>Lien indisponible</h1>
              <p className="sub">{loadErr}</p>
              <p className="sub" style={{ marginTop: 8 }}>
                <Link to="/inscription-patient" style={{ color: 'var(--blue)' }}>
                  Créer ou retrouver mon espace patient
                </Link>
              </p>
            </>
          ) : !me ? (
            <p className="sub">Chargement…</p>
          ) : sent ? (
            <>
              <h1>Merci ! ✅</h1>
              <p className="sub">
                Vos garanties ont bien été enregistrées. Elles seront vérifiées par votre cabinet
                dentaire avant votre rendez-vous. Vous pouvez fermer cette page ou en déposer de
                nouvelles ci-dessous.
              </p>
              <button
                className="btn ghost"
                style={{ width: '100%', marginTop: 16 }}
                onClick={() => {
                  setSent(false)
                  setGaranties(null)
                }}
              >
                Déposer un nouveau tableau
              </button>
            </>
          ) : (
            <>
              <h1>{me.name ? `Bonjour ${me.name}` : 'Votre espace patient'}</h1>
              <p className="sub">
                Importez votre tableau de garanties mutuelle (photo ou PDF) : l'analyse est
                automatique et restera vérifiée par votre cabinet dentaire.
              </p>

              <div style={{ marginTop: 18 }}>
                <GarantiesImporter
                  onResult={(g, src, raw) => {
                    setGaranties(g)
                    setSourceName(src)
                    setRawText(raw)
                  }}
                  onFile={setDoc}
                />
              </div>

              {garanties && (
                <div style={{ marginTop: 16 }}>
                  <label>Garanties détectées (le cabinet les vérifiera)</label>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13.5, color: 'var(--muted)' }}>
                    {POSTES.map((p) => {
                      const g = garanties[p]
                      const v =
                        g.val === 0
                          ? 'non détecté'
                          : g.type === 'pct'
                            ? `${g.val} % BR`
                            : eur(g.val)
                      return (
                        <li key={p}>
                          {POSTE_LABEL[p]} : <b style={{ color: 'var(--ink)' }}>{v}</b>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {sendErr && <div className="auth-err">{sendErr}</div>}

              <label
                style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 18, fontSize: 13, fontWeight: 400 }}
              >
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <span>
                  J'accepte que mes données de santé (tableau de garanties) soient transmises à mon
                  cabinet dentaire et traitées pour l'estimation de mon reste à charge, conformément à
                  la{' '}
                  <Link to="/confidentialite" target="_blank" style={{ color: 'var(--blue)' }}>
                    politique de confidentialité
                  </Link>
                  .
                </span>
              </label>

              <button
                className="btn"
                style={{ width: '100%', marginTop: 14 }}
                disabled={!garanties || sending || !consent}
                onClick={handleSend}
              >
                {sending ? 'Envoi…' : 'Enregistrer mes garanties'}
              </button>
              <p className="sub" style={{ fontSize: 12, marginTop: 12 }}>
                Aucune donnée n'est partagée avec des tiers. Estimation non contractuelle, vérifiée
                par le cabinet.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
