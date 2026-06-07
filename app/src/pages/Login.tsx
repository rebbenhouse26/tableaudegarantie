import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { api, ApiError } from '../api/client'
import './Account.css'

export default function Login() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function switchMode(m: 'login' | 'register' | 'forgot') {
    setMode(m)
    setError(null)
    setInfo(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      if (mode === 'forgot') {
        const r = await api.post<{ ok: boolean; emailed: boolean; newPassword?: string }>(
          '/auth/forgot-password',
          { email },
        )
        if (r.emailed) {
          setInfo(`Si un compte existe pour ${email}, un nouveau mot de passe vient d'être envoyé par e-mail. Pensez à vérifier vos spams.`)
        } else if (r.newPassword) {
          // E-mail non configuré (dev) : on affiche le nouveau mot de passe pour rester testable.
          setInfo(`Nouveau mot de passe : ${r.newPassword}  (l'envoi par e-mail n'est pas activé sur cette instance)`)
        } else {
          setInfo(`Si un compte existe pour ${email}, un nouveau mot de passe a été envoyé par e-mail.`)
        }
        return
      }
      if (mode === 'login') await login(email, password)
      else await register(name, email, password)
      navigate('/cabinet')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
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
        <div className="links">
          <Link to="/app">Démo</Link>
        </div>
      </div>

      <div className="auth-wrap">
        <div className="auth-card">
          <h1>
            {mode === 'login'
              ? 'Connexion cabinet'
              : mode === 'register'
                ? 'Créer un compte cabinet'
                : 'Mot de passe oublié'}
          </h1>
          <p className="sub">
            {mode === 'login'
              ? 'Accédez à vos devis enregistrés.'
              : mode === 'register'
                ? 'Quelques secondes pour commencer à enregistrer vos devis.'
                : 'Saisissez votre e-mail : nous vous envoyons un nouveau mot de passe.'}
          </p>

          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <>
                <label htmlFor="name">Nom du cabinet</label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="organization"
                />
              </>
            )}
            <label htmlFor="email">E-mail professionnel</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            {mode !== 'forgot' && (
              <>
                <label htmlFor="password">Mot de passe</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={mode === 'register' ? 8 : undefined}
                />
              </>
            )}

            {mode === 'login' && (
              <p style={{ textAlign: 'right', margin: '8px 0 0' }}>
                <button
                  type="button"
                  className="link-btn"
                  style={{ fontSize: 13 }}
                  onClick={() => switchMode('forgot')}
                >
                  🔑 Mot de passe oublié ?
                </button>
              </p>
            )}

            {error && <div className="auth-err">{error}</div>}
            {info && (
              <div className="auth-info">
                ✅ {info}
              </div>
            )}

            <button className="btn" type="submit" disabled={busy} style={{ marginTop: 14 }}>
              {busy
                ? 'Veuillez patienter…'
                : mode === 'login'
                  ? 'Se connecter'
                  : mode === 'register'
                    ? 'Créer mon compte'
                    : 'Recevoir un nouveau mot de passe'}
            </button>
          </form>

          <p className="auth-switch">
            {mode === 'login' ? (
              <>
                Pas encore de compte ?{' '}
                <button onClick={() => switchMode('register')}>Créer un compte</button>
              </>
            ) : mode === 'register' ? (
              <>
                Déjà inscrit ?{' '}
                <button onClick={() => switchMode('login')}>Se connecter</button>
              </>
            ) : (
              <>
                <button onClick={() => switchMode('login')}>← Retour à la connexion</button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
