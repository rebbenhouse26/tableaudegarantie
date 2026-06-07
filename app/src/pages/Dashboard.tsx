import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../auth/AuthContext'
import { api, API_URL, getToken } from '../api/client'
import type { DevisRecord, PatientRequest } from '../api/types'
import type { GarantiesParPoste } from '../domain/types'

interface PatientAccount {
  id: number
  name: string
  email: string
  status: string
  sourceName: string
  garanties: GarantiesParPoste | null
  rawText: string
  hasDoc: boolean
  docName: string
  createdAt: string
  submittedAt: string | null
}
import { getMutuelle } from '../domain/mutuelles'
import { getActe } from '../domain/actes'
import { computeDevis, eur, totaux } from '../domain/calcul'
import { optimiserDevis, optimiserDevisMax } from '../domain/optimisation'
import './Account.css'

export default function Dashboard() {
  const { cabinet, logout } = useAuth()
  const navigate = useNavigate()
  const [devis, setDevis] = useState<DevisRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [invites, setInvites] = useState<PatientRequest[]>([])
  const [inviteName, setInviteName] = useState('')
  const [invitePhone, setInvitePhone] = useState('')
  const [smsMsg, setSmsMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [cabinetSlug, setCabinetSlug] = useState<string | null>(null)
  const [qrFor, setQrFor] = useState<string | null>(null)
  const [patients, setPatients] = useState<PatientAccount[]>([])

  useEffect(() => {
    if (!cabinet) {
      navigate('/connexion')
      return
    }
    api.get<DevisRecord[]>('/devis').then(setDevis).catch((e) => setError(e.message))
    api.get<PatientRequest[]>('/patient-requests').then(setInvites).catch(() => {})
    api
      .get<{ slug: string; cabinetName: string }>('/patient-requests/cabinet-link')
      .then((d) => setCabinetSlug(d.slug))
      .catch(() => {})
    api.get<PatientAccount[]>('/patient-requests/patients').then(setPatients).catch(() => {})
  }, [cabinet, navigate])

  const patientSignupUrl = cabinetSlug
    ? `${window.location.origin}/inscription-patient?cab=${cabinetSlug}`
    : ''

  /** Télécharge le document original déposé par un patient (requête authentifiée → blob). */
  async function downloadPatientDoc(p: PatientAccount) {
    try {
      const r = await fetch(`${API_URL}/patient-requests/patients/${p.id}/document`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!r.ok) throw new Error('Téléchargement impossible.')
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = p.docName || `tableau-garanties-${p.name || p.id}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Téléchargement impossible.')
    }
  }

  /** Télécharge le document joint d'une demande (lien permanent / invitation). */
  async function downloadInviteDoc(inv: PatientRequest) {
    try {
      const r = await fetch(`${API_URL}/patient-requests/${inv.id}/document`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!r.ok) throw new Error('Téléchargement impossible.')
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = inv.docName || `tableau-garanties-${inv.patientName || inv.id}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Téléchargement impossible.')
    }
  }

  /** Construit un devis à partir des garanties déposées par un patient. */
  function buildFromPatient(p: PatientAccount) {
    if (!p.garanties) return
    navigate('/app', {
      state: {
        garanties: p.garanties,
        sourceName: p.sourceName || 'Garanties transmises par le patient',
        patientName: p.name,
        ocrText: p.rawText,
      },
    })
  }

  function inviteUrl(token: string) {
    return `${window.location.origin}/patient/${token}`
  }

  const cabinetUrl = cabinetSlug ? `${window.location.origin}/c/${cabinetSlug}` : ''

  async function copyCabinetLink() {
    try {
      await navigator.clipboard.writeText(cabinetUrl)
      setCopied('cabinet')
    } catch {
      /* ignore */
    }
  }

  async function createInvite() {
    setSmsMsg(null)
    const inv = await api.post<PatientRequest>('/patient-requests', {
      patientName: inviteName.trim(),
      phone: invitePhone.trim(),
    })
    setInvites((l) => [inv, ...l])
    // Retour sur l'envoi SMS éventuel.
    if (invitePhone.trim()) {
      if (inv.sms?.sent) setSmsMsg(`✓ SMS envoyé au ${invitePhone.trim()}`)
      else setSmsMsg(`⚠️ SMS non envoyé : ${inv.sms?.error ?? 'service indisponible'} — copiez le lien.`)
    }
    setInviteName('')
    setInvitePhone('')
    try {
      await navigator.clipboard.writeText(inviteUrl(inv.token))
      setCopied(inv.token)
    } catch {
      /* presse-papiers indisponible : le lien reste affiché */
    }
  }

  async function copyInvite(token: string) {
    try {
      await navigator.clipboard.writeText(inviteUrl(token))
      setCopied(token)
    } catch {
      /* ignore */
    }
  }

  async function deleteInvite(id: number) {
    await api.delete(`/patient-requests/${id}`)
    setInvites((l) => l.filter((x) => x.id !== id))
  }

  function buildFromInvite(inv: PatientRequest) {
    navigate('/app', {
      state: {
        garanties: inv.garanties,
        sourceName: inv.sourceName || 'Garanties transmises par le patient',
        patientName: inv.patientName,
        ocrText: inv.rawText,
      },
    })
  }

  async function handleDelete(id: number) {
    if (!confirm('Supprimer ce devis ?')) return
    await api.delete(`/devis/${id}`)
    setDevis((d) => (d ? d.filter((x) => x.id !== id) : d))
  }

  /** Garanties d'un devis : stockées si récentes, sinon repli sur la mutuelle d'origine. */
  function garantiesOf(d: DevisRecord) {
    return d.garanties ?? getMutuelle(d.mutuelleId)?.g ?? null
  }

  function sourceLabelOf(d: DevisRecord): string {
    return d.sourceName || getMutuelle(d.mutuelleId)?.name || d.mutuelleId
  }

  async function handlePdf(d: DevisRecord) {
    const g = garantiesOf(d)
    if (!g) return
    const { exportRapportPdf } = await import('../pdf/rapport')
    const res = computeDevis(d.lines, g)
    exportRapportPdf({
      sourceLabel: sourceLabelOf(d),
      patientName: d.patientName,
      devis: d.lines,
      res,
      totaux: totaux(res),
      garanties: g,
      optimisationMax: optimiserDevisMax(d.lines, g),
      optimisation: optimiserDevis(d.lines, g),
    })
  }

  function summary(d: DevisRecord): string {
    return d.lines
      .map((L) => {
        const v = getActe(L.acteId)?.variants[L.varianteIdx]
        return v ? v.nom.replace(/\s*\(.*\)$/, '') + (L.qty > 1 ? ` ×${L.qty}` : '') : ''
      })
      .filter(Boolean)
      .join(', ')
  }

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <div className="acct">
      <div className="topbar">
        <Link to="/" className="brand">
          <div className="logo">TG</div>
          Tableau de Garanti
        </Link>
        <div className="links">
          <span style={{ opacity: 0.85 }}>{cabinet?.name}</span>
          <Link to="/app">Nouveau devis</Link>
          <button onClick={handleLogout}>Déconnexion</button>
        </div>
      </div>

      <div className="dash">
        <h1>Lien permanent du cabinet</h1>
        <p className="sub">
          Le <b>même lien pour tous vos patients</b> — à coller dans votre message de confirmation
          Doctolib (ou e‑mail/SMS), ou à afficher en QR code en salle d'attente. Le patient
          s'identifie, dépose son tableau de garanties, et vous le retrouvez ci‑dessous.
        </p>

        {cabinetSlug && (
          <div
            style={{
              display: 'flex',
              gap: 22,
              alignItems: 'center',
              flexWrap: 'wrap',
              border: '1px solid var(--line, #d8dde2)',
              borderRadius: 12,
              padding: 18,
              marginBottom: 36,
              background: '#fff',
            }}
          >
            <div style={{ background: '#fff', padding: 8, border: '1px solid #eee', borderRadius: 8 }}>
              <QRCodeSVG value={cabinetUrl} size={132} />
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>Votre lien à partager</label>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  marginTop: 6,
                  flexWrap: 'wrap',
                }}
              >
                <code
                  style={{
                    fontSize: 13,
                    padding: '8px 10px',
                    background: '#f4f6f8',
                    borderRadius: 8,
                    wordBreak: 'break-all',
                  }}
                >
                  {cabinetUrl}
                </code>
                <button className="link-copy" onClick={copyCabinetLink}>
                  {copied === 'cabinet' ? '✓ Copié' : 'Copier le lien'}
                </button>
              </div>
              <p className="sub" style={{ fontSize: 12.5, marginTop: 10 }}>
                Astuce Doctolib : Agenda → Messages de confirmation/rappel → ajoutez « Merci de
                transmettre votre tableau de garanties : {cabinetUrl} ». Le QR code peut être imprimé
                pour la salle d'attente.
              </p>
              {patientSignupUrl && (
                <p className="sub" style={{ fontSize: 12.5, marginTop: 10 }}>
                  Lien <b>compte patient</b> (le patient crée un compte et reçoit son lien par
                  e‑mail) :{' '}
                  <code style={{ background: '#f4f6f8', padding: '2px 6px', borderRadius: 6, wordBreak: 'break-all' }}>
                    {patientSignupUrl}
                  </code>{' '}
                  <button
                    className="link-copy"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(patientSignupUrl)
                        setCopied('signup')
                      } catch {
                        /* ignore */
                      }
                    }}
                  >
                    {copied === 'signup' ? '✓ Copié' : 'Copier'}
                  </button>
                </p>
              )}
            </div>
          </div>
        )}

        <h1>Tableaux déposés par vos patients</h1>
        <p className="sub">
          Les patients qui créent un compte via votre lien d'inscription déposent ici leur tableau
          de garanties. Vous pouvez le <b>télécharger</b> pour le joindre au devis, ou construire le
          devis directement.
        </p>
        {patients.length === 0 ? (
          <div className="empty" style={{ marginBottom: 36 }}>
            Aucun tableau déposé pour l'instant. Partagez votre lien d'inscription patient ci‑dessus.
          </div>
        ) : (
          <table style={{ marginBottom: 36 }}>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Statut</th>
                <th>Mutuelle</th>
                <th>Déposé le</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>{p.name || '—'}</b>
                    <br />
                    <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>{p.email}</span>
                  </td>
                  <td>
                    {p.status === 'received' ? (
                      <span className="pill-ok">✓ Reçu</span>
                    ) : (
                      <span className="pill-wait">En attente</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--muted)' }}>{p.sourceName || '—'}</td>
                  <td className="num" style={{ color: 'var(--muted)' }}>
                    {p.submittedAt
                      ? new Date(p.submittedAt.replace(' ', 'T')).toLocaleDateString('fr-FR')
                      : '—'}
                  </td>
                  <td className="num">
                    {p.hasDoc && (
                      <button
                        className="btn ghost"
                        style={{ padding: '5px 10px', fontSize: 13, marginRight: 8 }}
                        onClick={() => downloadPatientDoc(p)}
                      >
                        ⬇ Télécharger
                      </button>
                    )}
                    {p.status === 'received' && p.garanties && (
                      <button
                        className="btn"
                        style={{ padding: '5px 10px', fontSize: 13 }}
                        onClick={() => buildFromPatient(p)}
                      >
                        Construire le devis
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h1>Invitations patients</h1>
        <p className="sub">
          Générez un lien à envoyer au patient avant le rendez-vous : il y dépose son tableau de
          garanties, et vous le retrouvez ici prêt à l'emploi.
        </p>

        <div className="invite-create">
          <input
            placeholder="Nom du patient (optionnel)"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
          />
          <input
            placeholder="Téléphone (optionnel — envoi SMS)"
            value={invitePhone}
            inputMode="tel"
            onChange={(e) => setInvitePhone(e.target.value)}
          />
          <button className="btn" onClick={createInvite}>
            {invitePhone.trim() ? '+ Créer et envoyer par SMS' : '+ Créer un lien patient'}
          </button>
        </div>
        {smsMsg && (
          <p className="sub" style={{ marginTop: 8, fontSize: 13 }}>
            {smsMsg}
          </p>
        )}

        {invites.length > 0 && (
          <table style={{ marginBottom: 36 }}>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Statut</th>
                <th>Lien à envoyer</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <b>{inv.patientName || '—'}</b>
                  </td>
                  <td>
                    {inv.status === 'received' ? (
                      <span className="pill-ok">✓ Reçu</span>
                    ) : (
                      <span className="pill-wait">En attente</span>
                    )}
                  </td>
                  <td>
                    <button className="link-copy" onClick={() => copyInvite(inv.token)}>
                      {copied === inv.token ? '✓ Lien copié' : 'Copier le lien'}
                    </button>
                    <button
                      className="link-btn"
                      style={{ marginLeft: 10 }}
                      onClick={() => setQrFor(qrFor === inv.token ? null : inv.token)}
                    >
                      {qrFor === inv.token ? 'Masquer le QR' : 'QR code'}
                    </button>
                    {qrFor === inv.token && (
                      <div style={{ marginTop: 8, background: '#fff', padding: 8, border: '1px solid #eee', borderRadius: 8, display: 'inline-block' }}>
                        <QRCodeSVG value={inviteUrl(inv.token)} size={104} />
                      </div>
                    )}
                  </td>
                  <td className="num">
                    {inv.hasDoc && (
                      <button
                        className="btn ghost"
                        style={{ padding: '5px 10px', fontSize: 13, marginRight: 8 }}
                        onClick={() => downloadInviteDoc(inv)}
                      >
                        ⬇ Télécharger
                      </button>
                    )}
                    {inv.status === 'received' && (
                      <button
                        className="btn"
                        style={{ padding: '5px 10px', fontSize: 13, marginRight: 8 }}
                        onClick={() => buildFromInvite(inv)}
                      >
                        Construire le devis
                      </button>
                    )}
                    <button className="link-btn" onClick={() => deleteInvite(inv.id)}>
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h1>Vos devis enregistrés</h1>
        <p className="sub">
          Les devis que vous validez dans la démo sont conservés ici. Vous pouvez régénérer le
          rapport PDF du patient à tout moment.
        </p>

        <div className="dash-actions">
          <Link className="btn" to="/app">
            + Construire un nouveau devis
          </Link>
        </div>

        {error && <div className="auth-err">{error}</div>}

        {devis === null && !error ? (
          <p className="sub">Chargement…</p>
        ) : devis && devis.length === 0 ? (
          <div className="empty">
            Aucun devis enregistré pour l'instant.
            <br />
            <Link to="/app" style={{ color: 'var(--blue)', fontWeight: 600 }}>
              Construire votre premier devis →
            </Link>
          </div>
        ) : (
          devis && (
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Actes</th>
                  <th>Source des garanties</th>
                  <th className="num">Reste à charge</th>
                  <th className="num">Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {devis.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <b>{d.patientName}</b>
                    </td>
                    <td style={{ color: 'var(--muted)' }}>{summary(d)}</td>
                    <td>{sourceLabelOf(d)}</td>
                    <td className="num">
                      <span className="rac-amt">{eur(d.totalRac)}</span>
                    </td>
                    <td className="num" style={{ color: 'var(--muted)' }}>
                      {new Date(d.createdAt.replace(' ', 'T')).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="num">
                      <button
                        className="btn ghost"
                        style={{ padding: '5px 10px', fontSize: 13, marginRight: 8 }}
                        onClick={() => handlePdf(d)}
                      >
                        PDF
                      </button>
                      <button className="link-btn" onClick={() => handleDelete(d.id)}>
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  )
}
