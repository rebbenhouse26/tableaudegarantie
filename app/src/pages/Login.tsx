import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'
import './Account.css'

export default function Login() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
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
          <h1>{mode === 'login' ? 'Connexion cabinet' : 'Créer un compte cabinet'}</h1>
          <p className="sub">
            {mode === 'login'
              ? 'Accédez à vos devis enregistrés.'
              : 'Quelques secondes pour commencer à enregistrer vos devis.'}
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

            {error && <div className="auth-err">{error}</div>}

            <button className="btn" type="submit" disabled={busy}>
              {busy
                ? 'Veuillez patienter…'
                : mode === 'login'
                  ? 'Se connecter'
                  : 'Créer mon compte'}
            </button>
          </form>

          <p className="auth-switch">
            {mode === 'login' ? (
              <>
                Pas encore de compte ?{' '}
                <button onClick={() => { setMode('register'); setError(null) }}>
                  Créer un compte
                </button>
              </>
            ) : (
              <>
                Déjà inscrit ?{' '}
                <button onClick={() => { setMode('login'); setError(null) }}>Se connecter</button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
