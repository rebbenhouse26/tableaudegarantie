import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import './Account.css'
import GarantiesImporter from '../components/GarantiesImporter'
import { API_URL } from '../api/client'

/** Page publique générique : lien PERMANENT du cabinet (le même pour tous les patients). */
export default function CabinetUpload() {
  const { slug } = useParams<{ slug: string }>()
  const [cabinetName, setCabinetName] = useState<string | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [doc, setDoc] = useState<{ dataUrl: string; name: string; mime: string } | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendErr, setSendErr] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_URL}/public/cabinet/${slug}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Lien invalide.')
        return r.json()
      })
      .then((c: { cabinetName: string }) => setCabinetName(c.cabinetName))
      .catch((e) => setLoadErr(e.message))
  }, [slug])

  async function handleSend() {
    if (!doc || !name.trim()) return
    setSendErr(null)
    setSending(true)
    try {
      const r = await fetch(`${API_URL}/public/cabinet/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientName: name.trim(), doc }),
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
            </>
          ) : !cabinetName ? (
            <p className="sub">Chargement…</p>
          ) : sent ? (
            <>
              <h1>Merci !</h1>
              <p className="sub">
                Vos garanties ont bien été transmises à <b>{cabinetName}</b>. Elles seront vérifiées
                par le cabinet avant votre rendez-vous. Vous pouvez fermer cette page.
              </p>
            </>
          ) : (
            <>
              <h1>Transmettez votre tableau de garanties</h1>
              <p className="sub">
                <b>{cabinetName}</b> vous invite à transmettre votre tableau de garanties mutuelle
                avant votre rendez-vous. Importez simplement une <b>photo</b> ou un <b>PDF</b> : il
                sera transmis à votre cabinet, qui s'occupe du reste.
              </p>

              <label htmlFor="pname">Votre nom et prénom</label>
              <input
                id="pname"
                value={name}
                placeholder="Ex. : Marie Durand"
                onChange={(e) => setName(e.target.value)}
              />

              <div style={{ marginTop: 18 }}>
                <GarantiesImporter fileOnly onFile={setDoc} />
              </div>

              {sendErr && <div className="auth-err">{sendErr}</div>}

              <button
                className="btn"
                style={{ width: '100%', marginTop: 22 }}
                disabled={!doc || !name.trim() || sending}
                onClick={handleSend}
              >
                {sending ? 'Envoi…' : 'Transmettre à mon cabinet'}
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
