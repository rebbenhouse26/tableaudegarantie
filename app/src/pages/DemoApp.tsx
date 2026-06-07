import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import GarantiesImporter from '../components/GarantiesImporter'
import DevisImporter from '../components/DevisImporter'
import ExpressImporter from '../components/ExpressImporter'
import { optimiserDevis, optimiserDevisMax } from '../domain/optimisation'
import './DemoApp.css'
import { MUTUELLES, POSTE_LABEL, getMutuelle } from '../domain/mutuelles'
import { ACTES, getActe } from '../domain/actes'
import { computeDevis, eur, totaux } from '../domain/calcul'
import { POSTES, cloneGaranties } from '../domain/garanties'
import type { GarantiesParPoste, LigneDevis, Panier, PosteGarantie } from '../domain/types'
import { useAuth } from '../auth/AuthContext'
import { api, ApiError } from '../api/client'

const STEPS = [
  { n: 1, title: 'Garanties patient', sub: 'Le patient transmet sa mutuelle' },
  { n: 2, title: 'Extraction', sub: 'Lecture & vérification des garanties' },
  { n: 3, title: 'Devis', sub: 'Import & vérification des actes' },
  { n: 4, title: 'Synthèse & optimisation', sub: 'Reste à charge minimisé' },
]

function pill(panier: Panier) {
  if (panier === 'rac0') return <span className="pill">100 % Santé</span>
  if (panier === 'maitrise') return <span className="pill std">Tarif maîtrisé</span>
  return <span className="pill free">Tarif libre</span>
}

/** Lien d'en-tête vers l'espace cabinet (connexion ou tableau de bord selon l'état). */
function HeadAccountLink() {
  const { cabinet } = useAuth()
  return cabinet ? (
    <Link to="/cabinet">Espace cabinet</Link>
  ) : (
    <Link to="/connexion">Connexion cabinet</Link>
  )
}

export default function DemoApp() {
  // Pré-remplissage possible depuis l'espace cabinet (garanties reçues d'un patient).
  const location = useLocation()
  const preload = location.state as {
    garanties?: GarantiesParPoste
    sourceName?: string
    patientName?: string
    ocrText?: string
  } | null

  const [step, setStep] = useState(preload?.garanties ? 2 : 1)
  const [garanties, setGaranties] = useState<GarantiesParPoste | null>(preload?.garanties ?? null)
  const [sourceName, setSourceName] = useState(preload?.sourceName ?? '')
  const [sourceMutId, setSourceMutId] = useState<string | null>(null)
  const [ocrText, setOcrText] = useState(preload?.ocrText ?? '')
  const [devis, setDevis] = useState<LigneDevis[]>([])

  function goStep(n: number) {
    setStep(n)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="app">
      <header className="app-head">
        <div className="brand">
          <div className="logo">TG</div>
          <div>
            <h1>Tableau de Garanti</h1>
            <p>Le copilote financier du devis dentaire</p>
          </div>
        </div>
        <div className="head-right">
          <Link to="/">← Site</Link>
          <HeadAccountLink />
          <span className="demo-tag">DÉMO — données fictives</span>
        </div>
      </header>

      <div className="wrap">
        <div className="banner">
          <span>⚠️</span>
          <div>
            <b>Estimation non contractuelle.</b> Cette démonstration utilise des mutuelles et des
            montants <b>fictifs</b> à des fins d'illustration. L'extraction automatique est
            approximative et <b>doit être vérifiée</b> par le cabinet avant tout calcul.
          </div>
        </div>

        <div className="steps">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className={'step' + (s.n === step ? ' active' : s.n < step ? ' done' : '')}
            >
              <span className="n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.sub}</p>
            </div>
          ))}
        </div>

        {step === 1 && (
          <Step1
            currentMutId={sourceMutId}
            onMutuelle={(id) => {
              const m = getMutuelle(id)!
              setGaranties(cloneGaranties(m.g))
              setSourceName(m.name)
              setSourceMutId(id)
              setOcrText('')
            }}
            onImport={(g, label, raw) => {
              setGaranties(g)
              setSourceName(label)
              setSourceMutId(null)
              setOcrText(raw)
            }}
            ready={garanties !== null}
            onNext={() => goStep(2)}
            onDevis={setDevis}
            devisReady={devis.length > 0}
            onExpressNext={() => goStep(4)}
          />
        )}
        {step === 2 && garanties && (
          <Step2
            garanties={garanties}
            setGaranties={setGaranties}
            sourceName={sourceName}
            isImport={sourceMutId === null}
            ocrText={ocrText}
            onBack={() => goStep(1)}
            onNext={() => goStep(3)}
          />
        )}
        {step === 3 && garanties && (
          <Step3
            garanties={garanties}
            devis={devis}
            setDevis={setDevis}
            onBack={() => goStep(2)}
            onNext={() => goStep(4)}
          />
        )}
        {step === 4 && garanties && (
          <Step4
            garanties={garanties}
            sourceName={sourceName}
            sourceMutId={sourceMutId}
            devis={devis}
            initialPatientName={preload?.patientName ?? ''}
            onBack={() => goStep(3)}
          />
        )}

        <p className="footer-note">
          Démonstration — Tableau de Garanti · Le copilote financier du devis dentaire
        </p>
      </div>
    </div>
  )
}

/* ---------- Étape 1 : mutuelle de démo OU import d'un document ---------- */
function Step1({
  currentMutId,
  onMutuelle,
  onImport,
  ready,
  onNext,
  onDevis,
  devisReady,
  onExpressNext,
}: {
  currentMutId: string | null
  onMutuelle: (id: string) => void
  onImport: (g: GarantiesParPoste, label: string, rawText: string) => void
  ready: boolean
  onNext: () => void
  onDevis: (lines: LigneDevis[]) => void
  devisReady: boolean
  onExpressNext: () => void
}) {
  const [mode, setMode] = useState<'express' | 'demo' | 'import'>('express')

  return (
    <div className="card">
      <h2>1. Le patient transmet ses garanties</h2>
      <p className="sub">
        <b>Mode express</b> : importez en une fois le tableau de garanties <b>et</b> le devis — les
        deux sont analysés en parallèle, puis le devis optimisé est calculé directement. Ou bien
        choisissez une mutuelle fictive (démo) / importez seulement les garanties.
      </p>

      <div className="seg">
        <button
          type="button"
          className={'seg-btn' + (mode === 'express' ? ' on' : '')}
          onClick={() => setMode('express')}
        >
          ⚡ Express (2 documents)
        </button>
        <button
          type="button"
          className={'seg-btn' + (mode === 'import' ? ' on' : '')}
          onClick={() => setMode('import')}
        >
          Garanties seules
        </button>
        <button
          type="button"
          className={'seg-btn' + (mode === 'demo' ? ' on' : '')}
          onClick={() => setMode('demo')}
        >
          Mutuelle de démo
        </button>
      </div>

      {mode === 'demo' && (
        <div className="mut-grid">
          {MUTUELLES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={'mut' + (currentMutId === m.id ? ' sel' : '')}
              onClick={() => onMutuelle(m.id)}
            >
              <h4>{m.name}</h4>
              <div className="lvl">{m.lvl}</div>
              <ul>
                {m.desc.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </button>
          ))}
        </div>
      )}

      {mode === 'import' && <GarantiesImporter onResult={onImport} />}

      {mode === 'express' && (
        <ExpressImporter
          onResult={(g, label, lines) => {
            onImport(g, label, '')
            onDevis(lines)
          }}
        />
      )}

      <div className="btn-row">
        {mode === 'express' ? (
          <button className="btn" disabled={!(ready && devisReady)} onClick={onExpressNext}>
            Calculer le devis optimisé →
          </button>
        ) : (
          <button className="btn" disabled={!ready} onClick={onNext}>
            {ready ? 'Vérifier les garanties →' : 'Analyser les garanties →'}
          </button>
        )}
      </div>
      {mode === 'express' && (ready || devisReady) && (
        <p className="sub" style={{ marginTop: 10 }}>
          Astuce : vous pourrez vérifier/corriger garanties et actes à tout moment (boutons
          « Modifier »). Le calcul se met à jour automatiquement.
        </p>
      )}
    </div>
  )
}

/* ---------- Étape 2 : éditeur de garanties (vérification humaine) ---------- */
function Step2({
  garanties,
  setGaranties,
  sourceName,
  isImport,
  ocrText,
  onBack,
  onNext,
}: {
  garanties: GarantiesParPoste
  setGaranties: React.Dispatch<React.SetStateAction<GarantiesParPoste | null>>
  sourceName: string
  isImport: boolean
  ocrText: string
  onBack: () => void
  onNext: () => void
}) {
  function update(poste: PosteGarantie, patch: Partial<GarantiesParPoste[PosteGarantie]>) {
    setGaranties((g) => (g ? { ...g, [poste]: { ...g[poste], ...patch } } : g))
  }

  return (
    <div className="card">
      <h2>2. Garanties dentaires — vérification</h2>
      <p className="sub">
        {isImport
          ? "Valeurs extraites automatiquement du document (approximatives). Corrigez chaque ligne avant calcul — c'est la vérification humaine."
          : 'Garanties de la mutuelle sélectionnée. Vous pouvez ajuster chaque ligne avant calcul.'}{' '}
        Les garanties sont exprimées en % de la base de remboursement Sécu (BRSS) ou en forfait
        annuel.
      </p>

      <table>
        <thead>
          <tr>
            <th>Poste</th>
            <th>Type de garantie</th>
            <th className="num">Niveau</th>
            <th className="num">Plafond annuel (€)</th>
          </tr>
        </thead>
        <tbody>
          {POSTES.map((poste) => {
            const g = garanties[poste]
            const type = g.val === 0 && g.type === 'forfait' ? 'none' : g.type
            return (
              <tr key={poste} className="gline">
                <td>
                  <b>{POSTE_LABEL[poste]}</b>
                </td>
                <td>
                  <select
                    value={type}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === 'none') update(poste, { type: 'forfait', val: 0 })
                      else update(poste, { type: v as 'pct' | 'forfait' })
                    }}
                  >
                    <option value="pct">% de la base Sécu</option>
                    <option value="forfait">Forfait annuel (€)</option>
                    <option value="none">Non couvert</option>
                  </select>
                </td>
                <td className="num">
                  <input
                    type="number"
                    min={0}
                    value={g.val}
                    disabled={type === 'none'}
                    onChange={(e) => update(poste, { val: Math.max(0, +e.target.value || 0) })}
                    style={{ textAlign: 'right' }}
                  />
                </td>
                <td className="num">
                  <input
                    type="number"
                    min={0}
                    value={g.plafond}
                    onChange={(e) => update(poste, { plafond: Math.max(0, +e.target.value || 0) })}
                    style={{ textAlign: 'right' }}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="sub" style={{ marginTop: 10 }}>
        Source : <b>{sourceName}</b>
      </p>

      {isImport && ocrText && (
        <details className="ocr-raw">
          <summary>Voir le texte brut extrait du document</summary>
          <pre>{ocrText}</pre>
        </details>
      )}

      <div className="btn-row">
        <button className="btn ghost" onClick={onBack}>
          ← Retour
        </button>
        <button className="btn" onClick={onNext}>
          Construire le plan de traitement →
        </button>
      </div>
    </div>
  )
}

/* ---------- Étape 3 : import & vérification du devis ---------- */
function Step3({
  garanties,
  devis,
  setDevis,
  onBack,
  onNext,
}: {
  garanties: GarantiesParPoste
  devis: LigneDevis[]
  setDevis: React.Dispatch<React.SetStateAction<LigneDevis[]>>
  onBack: () => void
  onNext: () => void
}) {
  const [addActeId, setAddActeId] = useState(ACTES[0].id)

  function addAct() {
    setDevis((d) => [...d, { acteId: addActeId, varianteIdx: 0, qty: 1 }])
  }
  function removeAct(i: number) {
    setDevis((d) => d.filter((_, idx) => idx !== i))
  }
  function updateLine(i: number, patch: Partial<LigneDevis>) {
    setDevis((d) => d.map((L, idx) => (idx === i ? { ...L, ...patch } : L)))
  }

  const res = useMemo(() => computeDevis(devis, garanties), [devis, garanties])
  const t = useMemo(() => totaux(res), [res])

  return (
    <div className="card">
      <h2>3. Devis du cabinet</h2>
      <p className="sub">
        Importez le devis (photo ou PDF) : les actes et montants sont extraits automatiquement et
        rattachés à la base CCAM. Vérifiez chaque ligne — vous pouvez corriger la variante (panier),
        le prix réel et la quantité. Vous pouvez aussi ajouter un acte manuellement.
      </p>

      <DevisImporter onResult={(lines) => setDevis(lines)} />

      <div className="add-row" style={{ marginTop: 16 }}>
        <div>
          <label>Ajouter un acte</label>
          <select value={addActeId} onChange={(e) => setAddActeId(e.target.value)}>
            {ACTES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <div></div>
        <div></div>
        <div>
          <button className="btn" onClick={addAct}>
            + Ajouter
          </button>
        </div>
      </div>

      <table style={{ marginTop: 16 }}>
        <thead>
          <tr>
            <th>Acte / variante</th>
            <th className="num">Qté</th>
            <th className="num">Prix (€)</th>
            <th className="num">Sécu</th>
            <th className="num">Mutuelle</th>
            <th className="num">Reste à charge</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {devis.length === 0 ? (
            <tr>
              <td colSpan={7} className="devis-empty">
                Importez un devis ci-dessus, ou ajoutez un acte manuellement.
              </td>
            </tr>
          ) : (
            devis.map((L, i) => {
              const acte = getActe(L.acteId)!
              const v = acte.variants[L.varianteIdx]
              const r = res[i]
              const prix = L.prixOverride ?? v.prix
              return (
                <tr key={i} className="gline">
                  <td>
                    <select
                      value={L.varianteIdx}
                      onChange={(e) => updateLine(i, { varianteIdx: +e.target.value })}
                    >
                      {acte.variants.map((vr, vi) => (
                        <option key={vi} value={vi}>
                          {acte.label} — {vr.nom}
                        </option>
                      ))}
                    </select>
                    <div style={{ marginTop: 4 }}>{pill(v.panier)}</div>
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      min={1}
                      max={32}
                      value={L.qty}
                      style={{ width: 60, textAlign: 'right' }}
                      onChange={(e) => updateLine(i, { qty: Math.max(1, +e.target.value || 1) })}
                    />
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      min={0}
                      value={prix}
                      style={{ width: 90, textAlign: 'right' }}
                      onChange={(e) =>
                        updateLine(i, { prixOverride: Math.max(0, +e.target.value || 0) })
                      }
                    />
                  </td>
                  <td className="num">{eur(r.secu)}</td>
                  <td className="num" style={{ color: 'var(--green)' }}>
                    {eur(r.mut)}
                  </td>
                  <td className="num">
                    <b>{eur(r.rac)}</b>
                  </td>
                  <td className="num">
                    <button
                      className="btn ghost"
                      style={{ padding: '4px 9px', fontSize: 12 }}
                      onClick={() => removeAct(i)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>

      {devis.length > 0 && (
        <div className="totbar">
          <div className="tot">
            <div className="lab">Total devis</div>
            <div className="val">{eur(t.prix)}</div>
          </div>
          <div className="tot secu">
            <div className="lab">Sécurité sociale</div>
            <div className="val">{eur(t.secu)}</div>
          </div>
          <div className="tot mut">
            <div className="lab">Mutuelle (est.)</div>
            <div className="val">{eur(t.mut)}</div>
          </div>
          <div className="tot rac">
            <div className="lab">Reste à charge</div>
            <div className="val">{eur(t.rac)}</div>
          </div>
        </div>
      )}

      <div className="btn-row">
        <button className="btn ghost" onClick={onBack}>
          ← Retour
        </button>
        <button className="btn" disabled={devis.length === 0} onClick={onNext}>
          Synthèse & optimisation →
        </button>
      </div>
    </div>
  )
}

/* ---------- Paiement en plusieurs fois (Alma) ---------- */
function PaiementAlma({
  rac,
  total,
  patientName,
}: {
  /** Reste à charge patient (montant « trop important » à étaler). */
  rac: number
  /** Total des honoraires (option : régler au cabinet puis se faire rembourser). */
  total: number
  patientName?: string
}) {
  const [almaOk, setAlmaOk] = useState<boolean | null>(null)
  const [klarnaOk, setKlarnaOk] = useState<boolean>(false)
  const [installmentsOpts, setInstallmentsOpts] = useState<number[]>([2, 3, 4, 10])
  const racR = Math.round(rac)
  const totalR = Math.round(total)
  // Par défaut on étale le reste à charge ; s'il est négligeable, on bascule sur le total honoraires.
  const [base, setBase] = useState<'rac' | 'total'>(racR >= 1 ? 'rac' : 'total')
  const [installments, setInstallments] = useState(4)
  const [loading, setLoading] = useState<'' | 'alma' | 'klarna'>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api
      .get<{ alma: { available: boolean; installments: number[] }; klarna: { available: boolean } }>(
        '/payments/config',
      )
      .then((c) => {
        if (!alive) return
        setAlmaOk(!!c.alma?.available)
        setKlarnaOk(!!c.klarna?.available)
        if (Array.isArray(c.alma?.installments) && c.alma.installments.length)
          setInstallmentsOpts(c.alma.installments)
      })
      .catch(() => alive && setAlmaOk(false))
    return () => {
      alive = false
    }
  }, [])

  const amount = base === 'rac' ? racR : totalR
  const anyProvider = almaOk === true || klarnaOk

  async function payer(provider: 'alma' | 'klarna') {
    setError(null)
    setLoading(provider)
    try {
      const body =
        provider === 'alma'
          ? { amount, installments, patientName: patientName || undefined, returnUrl: window.location.href }
          : { amount, patientName: patientName || undefined, returnUrl: window.location.href }
      const { url } = await api.post<{ url: string }>(`/payments/${provider}`, body)
      window.open(url, '_blank', 'noopener')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Échec de la création du paiement.')
    } finally {
      setLoading('')
    }
  }

  return (
    <div style={{ marginTop: 18 }} className="report report-alma">
      <div className="rhd">
        <h3>💳 Payer en plusieurs fois</h3>
        <p>Reste à charge élevé ? Étalez le paiement (Alma jusqu’à 10×, ou Klarna) — réponse immédiate, sans dossier.</p>
      </div>
      <div className="rbd" style={{ padding: 16 }}>
        {/* Montant à financer */}
        <div className="alma-base">
          <label className={base === 'rac' ? 'on' : ''}>
            <input type="radio" checked={base === 'rac'} onChange={() => setBase('rac')} disabled={racR < 1} />
            <span>
              Reste à charge <b>{eur(racR)}</b>
            </span>
          </label>
          <label className={base === 'total' ? 'on' : ''}>
            <input type="radio" checked={base === 'total'} onChange={() => setBase('total')} />
            <span>
              Total honoraires <b>{eur(totalR)}</b>
              <small> (réglé au cabinet, remboursé ensuite)</small>
            </span>
          </label>
        </div>

        {/* Choix du nombre d'échéances */}
        <div className="alma-grid">
          {installmentsOpts.map((n) => {
            const per = amount / n
            const on = installments === n
            return (
              <button
                key={n}
                type="button"
                className={`alma-opt${on ? ' on' : ''}`}
                onClick={() => setInstallments(n)}
              >
                <div className="n">{n}×</div>
                <div className="per">{eur(per)}/mois</div>
                {n >= 10 && <div className="fee">frais Alma</div>}
              </button>
            )
          })}
        </div>

        <p className="sub" style={{ marginTop: 12 }}>
          {installments}× de <b>{eur(amount / installments)}</b> — soit {eur(amount)} au total
          {installments < 10 ? ' (2× à 4× : sans frais pour le patient).' : ' (paiement échelonné 10× : frais affichés par Alma avant validation).'}
        </p>

        {almaOk !== null && !anyProvider && (
          <div className="banner" style={{ marginTop: 10 }}>
            <span>ℹ️</span>
            <div>
              Simulation indicative. Le paiement en ligne s’active dès qu’un fournisseur est configuré
              côté serveur (<code>ALMA_API_KEY</code> ou <code>KLARNA_USERNAME/PASSWORD</code>).
            </div>
          </div>
        )}
        {error && (
          <div className="banner" style={{ marginTop: 10 }}>
            <span>⚠️</span>
            <div>{error}</div>
          </div>
        )}

        <div className="btn-row" style={{ marginTop: 12, gap: 10, flexWrap: 'wrap' }}>
          <button
            className="btn"
            onClick={() => payer('alma')}
            disabled={!!loading || amount < 1 || almaOk !== true}
          >
            {loading === 'alma' ? 'Redirection vers Alma…' : `Payer en ${installments}× via Alma →`}
          </button>
          {klarnaOk && (
            <button
              className="btn ghost"
              onClick={() => payer('klarna')}
              disabled={!!loading || amount < 1}
            >
              {loading === 'klarna' ? 'Redirection vers Klarna…' : 'Payer avec Klarna →'}
            </button>
          )}
        </div>
      </div>
      <div className="nc">
        Paiement en plusieurs fois assuré par Alma ou Klarna, sous réserve d’acceptation. Montants
        indicatifs ; l’échéancier définitif et les éventuels frais sont affichés par le prestataire
        avant toute validation.
      </div>
    </div>
  )
}

/* ---------- Étape 4 : rapport patient + scénarios ---------- */
function Step4({
  garanties,
  sourceName,
  sourceMutId,
  devis,
  initialPatientName,
  onBack,
}: {
  garanties: GarantiesParPoste
  sourceName: string
  sourceMutId: string | null
  devis: LigneDevis[]
  initialPatientName: string
  onBack: () => void
}) {
  const res = useMemo(() => computeDevis(devis, garanties), [devis, garanties])
  const t = useMemo(() => totaux(res), [res])
  const optim = useMemo(() => optimiserDevis(devis, garanties), [devis, garanties])
  // 2e optimisation : remboursement MAXIMAL (peut laisser un reste à charge, payable en plusieurs fois).
  const optimMax = useMemo(() => optimiserDevisMax(devis, garanties), [devis, garanties])
  const dateStr = new Date().toLocaleDateString('fr-FR')

  const { cabinet } = useAuth()
  const [patientName, setPatientName] = useState(initialPatientName)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  async function handlePdf() {
    const { exportRapportPdf } = await import('../pdf/rapport')
    exportRapportPdf({
      sourceLabel: sourceName,
      patientName: patientName || undefined,
      devis,
      res,
      totaux: t,
      garanties,
      optimisationMax: optimMax,
      optimisation: optim,
    })
  }

  async function handleSave() {
    setSaveError(null)
    if (!patientName.trim()) {
      setSaveError("Renseignez le nom du patient avant d'enregistrer.")
      return
    }
    setSaveState('saving')
    try {
      await api.post('/devis', {
        patientName: patientName.trim(),
        mutuelleId: sourceMutId ?? 'import',
        sourceName,
        garanties,
        lines: devis,
        totals: t,
      })
      setSaveState('saved')
    } catch (err) {
      setSaveState('idle')
      setSaveError(err instanceof ApiError ? err.message : "Échec de l'enregistrement.")
    }
  }

  return (
    <div className="card">
      <h2>4. Synthèse garanties × devis</h2>
      <p className="sub">
        Croisement du devis et des garanties (bases CCAM). On propose <b>3 devis</b> : le
        <b> devis initial</b>, le <b>devis optimisé — remboursement maximal</b> (mutuelle exploitée au
        max selon le tableau ; le reste à charge restant est <b>payable en plusieurs fois</b>), et le
        <b> devis optimisé — reste à charge 0</b> (le patient ne paie rien). À acte médicalement
        équivalent, à valider par le cabinet ; l'outil n'incite jamais à dégrader un soin justifié.
      </p>

      <div className="totbar">
        <div className="tot rac">
          <div className="lab">Reste à charge patient</div>
          <div className="val">{eur(optim.totalsOptim.rac)}</div>
        </div>
        <div className="tot secu">
          <div className="lab">Honoraires cabinet (devis)</div>
          <div className="val">{eur(optim.totalsCurrent.prix)}</div>
        </div>
        <div className="tot mut">
          <div className="lab">Honoraires optimisés</div>
          <div className="val">{eur(optim.totalsOptim.prix)}</div>
        </div>
        <div className="tot">
          <div className="lab">{optim.supplementCabinet >= 0 ? 'Gain cabinet' : 'Ajustement'}</div>
          <div className="val" style={{ color: 'var(--green)' }}>
            {optim.supplementCabinet >= 0 ? '+ ' : ''}
            {eur(optim.supplementCabinet)}
          </div>
        </div>
      </div>

      <table className="resp-cards" style={{ marginTop: 16 }}>
        <thead>
          <tr>
            <th>Acte</th>
            <th>Devis actuel</th>
            <th>Devis optimisé (reste à charge ≈ 0)</th>
            <th className="num">Honoraires cabinet</th>
          </tr>
        </thead>
        <tbody>
          {optim.perLine.map((p, i) => {
            const changed = Math.abs(p.optimPrix - p.currentPrix) > 0.5 || Math.abs(p.optimRac - p.currentRac) > 0.5
            return (
              <tr key={i}>
                <td data-label="Acte">
                  <b>{p.acteLabel}</b>
                  {p.line.dent ? <span style={{ color: 'var(--muted)' }}> · dent {p.line.dent}</span> : null}
                </td>
                <td data-label="Devis actuel" style={{ color: 'var(--muted)' }}>
                  {p.currentNom}
                  <br />
                  {eur(p.currentPrix)} · RAC {eur(p.currentRac)}
                </td>
                <td data-label="Devis optimisé">
                  {changed ? <b>{p.optimNom}</b> : <span style={{ color: 'var(--muted)' }}>inchangé</span>}
                  <br />
                  {eur(p.optimPrix)} ·{' '}
                  <span style={{ color: p.optimRac === 0 ? 'var(--green)' : 'inherit' }}>
                    RAC {eur(p.optimRac)}
                  </span>
                  {changed && p.optimRac === 0 && (
                    <span className="pill" style={{ marginLeft: 6 }}>
                      RAC 0
                    </span>
                  )}
                </td>
                <td className="num" data-label="Honoraires cabinet" style={{ color: p.gainCabinet > 0 ? 'var(--green)' : p.gainCabinet < 0 ? 'var(--red)' : 'inherit' }}>
                  {p.gainCabinet > 0 ? '+ ' : ''}
                  {eur(p.gainCabinet)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="sub" style={{ marginTop: 10 }}>
        « Devis optimisé » : honoraires maximisés pour le cabinet tout en gardant un reste à charge
        patient ≈ 0, dans la limite des garanties (montée en panier maîtrisé/libre si la mutuelle
        couvre davantage, ou ajustement à la baisse sinon). À valider par le cabinet.
        {optim.totalsOptim.rac > 0 &&
          ' Les actes non remboursables (implant, esthétique…) peuvent conserver un reste à charge.'}
      </p>

      <div style={{ marginTop: 22, maxWidth: 360 }}>
        <label>Nom du patient (pour le rapport et l'enregistrement)</label>
        <input
          value={patientName}
          onChange={(e) => {
            setPatientName(e.target.value)
            setSaveState('idle')
          }}
          placeholder="Ex. : Mme Durand"
        />
      </div>

      <div className="scn-grid" style={{ marginTop: 22, gridTemplateColumns: '1fr 1fr' }}>
        <div className="scn mid">
          <div className="hd">Devis proposé</div>
          <div className="bd">
            <p className="desc">Le plan de traitement, aux montants du cabinet.</p>
            <div className="r">
              <span>Honoraires</span>
              <span>{eur(optim.totalsCurrent.prix)}</span>
            </div>
            <div className="r">
              <span>Part Sécurité sociale</span>
              <span>{eur(optim.totalsCurrent.secu)}</span>
            </div>
            <div className="r">
              <span>Part mutuelle</span>
              <span>{eur(optim.totalsCurrent.mut)}</span>
            </div>
            <div className="r">
              <span>Remboursement total</span>
              <span style={{ color: 'var(--green)' }}>
                {eur(optim.totalsCurrent.secu + optim.totalsCurrent.mut)}
              </span>
            </div>
            <div className="r big">
              <span>Reste à charge</span>
              <span>{eur(optim.totalsCurrent.rac)}</span>
            </div>
          </div>
        </div>
        <div className="scn eco">
          <div className="hd">Devis optimisé — 0 € à charge</div>
          <div className="bd">
            <p className="desc">Honoraires ajustés au mieux de vos garanties.</p>
            <div className="r">
              <span>Honoraires</span>
              <span>{eur(optim.totalsOptim.prix)}</span>
            </div>
            <div className="r">
              <span>Part Sécurité sociale</span>
              <span>{eur(optim.totalsOptim.secu)}</span>
            </div>
            <div className="r">
              <span>Part mutuelle</span>
              <span>{eur(optim.totalsOptim.mut)}</span>
            </div>
            <div className="r">
              <span>Remboursement total</span>
              <span style={{ color: 'var(--green)' }}>
                {eur(optim.totalsOptim.secu + optim.totalsOptim.mut)}
              </span>
            </div>
            <div className="r big">
              <span>Reste à charge</span>
              <span style={{ color: 'var(--green)' }}>{eur(optim.totalsOptim.rac)}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18 }} className="report">
        <div className="rhd">
          <h3>Estimation de votre reste à charge</h3>
          <p>
            {patientName ? `${patientName} · ` : ''}
            {sourceName} · établi le {dateStr}
          </p>
        </div>
        <div className="rbd">
          <table className="resp-cards">
            <thead>
              <tr>
                <th>Acte proposé</th>
                <th className="num">Prix</th>
                <th className="num">Part Sécu</th>
                <th className="num">Part mutuelle</th>
                <th className="num">Remb. total</th>
                <th className="num">À votre charge</th>
              </tr>
            </thead>
            <tbody>
              {devis.map((L, i) => {
                const v = getActe(L.acteId)!.variants[L.varianteIdx]
                const r = res[i]
                return (
                  <tr key={i}>
                    <td data-label="Acte">
                      {L.labelOverride ?? v.nom}
                      {L.qty > 1 ? ` ×${L.qty}` : ''}
                    </td>
                    <td className="num" data-label="Prix">{eur(r.prix)}</td>
                    <td className="num" data-label="Part Sécu">{eur(r.secu)}</td>
                    <td className="num" data-label="Part mutuelle">{eur(r.mut)}</td>
                    <td className="num" data-label="Remb. total" style={{ color: 'var(--green)' }}>
                      {eur(r.secu + r.mut)}
                    </td>
                    <td className="num" data-label="À votre charge">
                      <b>{eur(r.rac)}</b>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--blue)' }}>
                <td data-label="">
                  <b>Total</b>
                </td>
                <td className="num" data-label="Prix">
                  <b>{eur(t.prix)}</b>
                </td>
                <td className="num" data-label="Part Sécu">
                  <b>{eur(t.secu)}</b>
                </td>
                <td className="num" data-label="Part mutuelle">
                  <b>{eur(t.mut)}</b>
                </td>
                <td className="num" data-label="Remb. total" style={{ color: 'var(--green)' }}>
                  <b>{eur(t.secu + t.mut)}</b>
                </td>
                <td className="num" data-label="À votre charge">
                  <b>{eur(t.rac)}</b>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="nc">
          Estimation non contractuelle établie à partir des garanties transmises. Le remboursement
          définitif relève de votre mutuelle et de l'Assurance Maladie. Document validé par le
          cabinet.
        </div>
      </div>

      {/* DEVIS 2 — Remboursement maximal (peut laisser un reste à charge, payable en plusieurs fois) */}
      {(() => {
        const res = computeDevis(optimMax.optimizedLines, garanties)
        const to = optimMax.totalsOptim
        return (
          <div style={{ marginTop: 18 }} className="report report-optim">
            <div className="rhd">
              <h3>Devis optimisé — remboursement maximal</h3>
              <p>Remboursement mutuelle maximisé selon le tableau · reste à charge réduit, payable en plusieurs fois</p>
            </div>
            <div className="rbd">
              <table className="resp-cards">
                <thead>
                  <tr>
                    <th>Acte</th>
                    <th className="num">Prix</th>
                    <th className="num">Part Sécu</th>
                    <th className="num">Part mutuelle</th>
                    <th className="num">Remb. total</th>
                    <th className="num">À votre charge</th>
                  </tr>
                </thead>
                <tbody>
                  {optimMax.optimizedLines.map((L, i) => {
                    const r = res[i]
                    return (
                      <tr key={i}>
                        <td data-label="Acte">
                          {optimMax.perLine[i].optimNom}
                          {L.qty > 1 ? ` ×${L.qty}` : ''}
                        </td>
                        <td className="num" data-label="Prix">{eur(r.prix)}</td>
                        <td className="num" data-label="Part Sécu">{eur(r.secu)}</td>
                        <td className="num" data-label="Part mutuelle">{eur(r.mut)}</td>
                        <td className="num" data-label="Remb. total" style={{ color: 'var(--green)' }}>
                          {eur(r.secu + r.mut)}
                        </td>
                        <td className="num" data-label="À votre charge">
                          <b>{eur(r.rac)}</b>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--green)' }}>
                    <td data-label=""><b>Total</b></td>
                    <td className="num" data-label="Prix"><b>{eur(to.prix)}</b></td>
                    <td className="num" data-label="Part Sécu"><b>{eur(to.secu)}</b></td>
                    <td className="num" data-label="Part mutuelle"><b>{eur(to.mut)}</b></td>
                    <td className="num" data-label="Remb. total" style={{ color: 'var(--green)' }}>
                      <b>{eur(to.secu + to.mut)}</b>
                    </td>
                    <td className="num" data-label="À votre charge"><b>{eur(to.rac)}</b></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="nc">
              Remboursement mutuelle <b>maximisé</b> d'après le tableau de garanties. Le reste à charge
              restant peut être réglé <b>en plusieurs fois</b> (ci‑dessous). À valider par le cabinet.
            </div>
          </div>
        )
      })()}

      {/* Paiement en plusieurs fois du reste à charge du devis « remboursement maximal » */}
      {optimMax.totalsOptim.prix > 0 && (
        <PaiementAlma
          rac={optimMax.totalsOptim.rac}
          total={optimMax.totalsOptim.prix}
          patientName={patientName || undefined}
        />
      )}

      {/* DEVIS 3 — Reste à charge 0 */}
      {(() => {
        const optimRes = computeDevis(optim.optimizedLines, garanties)
        const to = optim.totalsOptim
        return (
          <div style={{ marginTop: 18 }} className="report report-optim">
            <div className="rhd">
              <h3>Devis optimisé — reste à charge 0</h3>
              <p>Honoraires ajustés pour un reste à charge nul pour le patient</p>
            </div>
            <div className="rbd">
              <table className="resp-cards">
                <thead>
                  <tr>
                    <th>Acte optimisé</th>
                    <th className="num">Prix</th>
                    <th className="num">Part Sécu</th>
                    <th className="num">Part mutuelle</th>
                    <th className="num">Remb. total</th>
                    <th className="num">À votre charge</th>
                  </tr>
                </thead>
                <tbody>
                  {optim.optimizedLines.map((L, i) => {
                    const r = optimRes[i]
                    return (
                      <tr key={i}>
                        <td data-label="Acte">
                          {optim.perLine[i].optimNom}
                          {L.qty > 1 ? ` ×${L.qty}` : ''}
                        </td>
                        <td className="num" data-label="Prix">{eur(r.prix)}</td>
                        <td className="num" data-label="Part Sécu">{eur(r.secu)}</td>
                        <td className="num" data-label="Part mutuelle">{eur(r.mut)}</td>
                        <td className="num" data-label="Remb. total" style={{ color: 'var(--green)' }}>
                          {eur(r.secu + r.mut)}
                        </td>
                        <td className="num" data-label="À votre charge">
                          <b>{eur(r.rac)}</b>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--green)' }}>
                    <td data-label=""><b>Total</b></td>
                    <td className="num" data-label="Prix"><b>{eur(to.prix)}</b></td>
                    <td className="num" data-label="Part Sécu"><b>{eur(to.secu)}</b></td>
                    <td className="num" data-label="Part mutuelle"><b>{eur(to.mut)}</b></td>
                    <td className="num" data-label="Remb. total" style={{ color: 'var(--green)' }}>
                      <b>{eur(to.secu + to.mut)}</b>
                    </td>
                    <td className="num" data-label="À votre charge"><b>{eur(to.rac)}</b></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="nc">
              Devis « zéro reste à charge » : honoraires ajustés pour que le patient ne paie rien,
              dans la limite des garanties. À valider par le cabinet.
            </div>
          </div>
        )
      })()}

      {saveError && (
        <div className="banner" style={{ marginTop: 16 }}>
          <span>⚠️</span>
          <div>{saveError}</div>
        </div>
      )}

      <div className="btn-row">
        <button className="btn ghost" onClick={onBack}>
          ← Modifier le devis
        </button>
        <button className="btn" onClick={handlePdf}>
          Télécharger le PDF
        </button>
        {cabinet ? (
          <button className="btn" onClick={handleSave} disabled={saveState !== 'idle'}>
            {saveState === 'saving'
              ? 'Enregistrement…'
              : saveState === 'saved'
                ? '✓ Devis enregistré'
                : 'Enregistrer le devis'}
          </button>
        ) : (
          <Link className="btn ghost" to="/connexion">
            Se connecter pour enregistrer
          </Link>
        )}
      </div>

      {saveState === 'saved' && (
        <p className="sub" style={{ marginTop: 12 }}>
          ✓ Enregistré dans votre{' '}
          <Link to="/cabinet" style={{ color: 'var(--blue)' }}>
            espace cabinet
          </Link>
          .
        </p>
      )}
    </div>
  )
}
