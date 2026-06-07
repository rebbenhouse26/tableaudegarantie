import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import './Account.css'
import { API_URL } from '../api/client'

type RegisterResp = { ok: boolean; emailed: boolean; emailError?: string; token: string; link?: string }
type LoginResp = { name: string; token: string; status: string; link: string }

export default function PatientRegister() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const cabinetSlug = searchParams.get('cab') ?? undefined
  const [mode, setMode] = useState<'register' | 'login'>('register')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [consent, setConsent] = useState(false)
  const [done, setDone] = useState<{ emailed: boolean; token: string } | null>(null)

  async function post<T>(path: string, body: unknown): Promise<T> {
    const r = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(data.error ?? 'Une erreur est survenue.')
    return data as T
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'register') {
        const r = await post<RegisterResp>('/patient/register', { name, email, password, cabinetSlug })
        setDone({ emailed: r.emailed, token: r.token })
      } else {
        const r = await post<LoginResp>('/patient/login', { email, password })
        navigate(`/espace-patient/${r.token}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="acct">
      <div className="topbar">
        <Link to="/" className="brand">
          <div className="logo">TG</div>
          Tableau de Garanti
        </Link>
      </div>

      <div className="auth-wrap" style={{ maxWidth: 520 }}>
        <div className="auth-card">
          {done ? (
            <>
              <h1>Compte créé ✅</h1>
              {done.emailed ? (
                <p className="sub">
                  Un e-mail vient d'être envoyé à <b>{email}</b> avec votre lien personnel pour
                  déposer votre tableau de garanties. Pensez à vérifier vos spams.
                </p>
              ) : (
                <>
                  <p className="sub">
                    Votre compte est prêt. L'envoi par e-mail n'est pas encore activé sur cette
                    instance — vous pouvez accéder directement à votre espace de dépôt :
                  </p>
                  <button
                    className="btn"
                    style={{ width: '100%', marginTop: 12 }}
                    onClick={() => navigate(`/espace-patient/${done.token}`)}
                  >
                    Déposer mon tableau de garanties →
                  </button>
                </>
              )}
              <p className="sub" style={{ fontSize: 12.5, marginTop: 16 }}>
                Vous pourrez revenir à tout moment via <button className="link-btn" onClick={() => { setDone(null); setMode('login') }}>Connexion</button>.
              </p>
            </>
          ) : (
            <>
              <h1>{mode === 'register' ? 'Créer mon espace patient' : 'Connexion patient'}</h1>
              <p className="sub">
                {mode === 'register'
                  ? 'Créez votre compte : vous recevrez un lien par e-mail pour déposer votre tableau de garanties avant le rendez-vous.'
                  : 'Accédez à votre espace pour déposer ou mettre à jour votre tableau de garanties.'}
              </p>

              <form onSubmit={handleSubmit}>
                {mode === 'register' && (
                  <>
                    <label htmlFor="pname">Votre nom</label>
                    <input
                      id="pname"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                    />
                  </>
                )}
                <label htmlFor="pemail">E-mail</label>
                <input
                  id="pemail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
                <label htmlFor="ppwd">Mot de passe</label>
                <input
                  id="ppwd"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  minLength={mode === 'register' ? 8 : undefined}
                />

                {error && <div className="auth-err">{error}</div>}

                {mode === 'register' && (
                  <label
                    style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 16, fontSize: 12.5, fontWeight: 400 }}
                  >
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      style={{ marginTop: 3 }}
                    />
                    <span>
                      J'accepte le traitement de mes données de santé pour l'estimation de mon reste à
                      charge, et j'ai pris connaissance de la{' '}
                      <Link to="/confidentialite" target="_blank" style={{ color: 'var(--blue)' }}>
                        politique de confidentialité
                      </Link>{' '}
                      et des{' '}
                      <Link to="/cgu" target="_blank" style={{ color: 'var(--blue)' }}>
                        CGU
                      </Link>
                      .
                    </span>
                  </label>
                )}

                <button
                  className="btn"
                  style={{ width: '100%', marginTop: 16 }}
                  disabled={busy || (mode === 'register' && !consent)}
                >
                  {busy
                    ? 'Veuillez patienter…'
                    : mode === 'register'
                      ? 'Créer mon compte'
                      : 'Me connecter'}
                </button>
              </form>

              <p className="sub" style={{ marginTop: 16, fontSize: 13.5 }}>
                {mode === 'register' ? (
                  <>
                    Déjà un compte ?{' '}
                    <button className="link-btn" onClick={() => { setError(null); setMode('login') }}>
                      Se connecter
                    </button>
                  </>
                ) : (
                  <>
                    Pas encore de compte ?{' '}
                    <button className="link-btn" onClick={() => { setError(null); setMode('register') }}>
                      Créer un espace patient
                    </button>
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
