import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import './Account.css'
import { api, ApiError } from '../api/client'

export default function ResetPassword() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [state, setState] = useState<'checking' | 'invalid' | 'form' | 'done'>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api
      .get(`/auth/reset-password/${token}`)
      .then(() => setState('form'))
      .catch(() => setState('invalid'))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError('Mot de passe : 8 caractères minimum.')
    if (password !== confirm) return setError('Les deux mots de passe ne correspondent pas.')
    setBusy(true)
    try {
      await api.post('/auth/reset-password', { token, password })
      setState('done')
      setTimeout(() => navigate('/connexion'), 2500)
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
      </div>

      <div className="auth-wrap">
        <div className="auth-card">
          <h1>Nouveau mot de passe</h1>

          {state === 'checking' && <p className="sub">Vérification du lien…</p>}

          {state === 'invalid' && (
            <>
              <p className="sub">
                Ce lien de réinitialisation est <b>invalide ou expiré</b> (valable 1 heure).
              </p>
              <p className="auth-switch">
                <Link to="/connexion" style={{ color: 'var(--blue)' }}>
                  ← Refaire une demande
                </Link>
              </p>
            </>
          )}

          {state === 'form' && (
            <>
              <p className="sub">Choisissez votre nouveau mot de passe (8 caractères minimum).</p>
              <form onSubmit={handleSubmit}>
                <label htmlFor="pwd">Nouveau mot de passe</label>
                <input
                  id="pwd"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <label htmlFor="pwd2">Confirmer le mot de passe</label>
                <input
                  id="pwd2"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                {error && <div className="auth-err">{error}</div>}
                <button className="btn" type="submit" disabled={busy} style={{ marginTop: 14 }}>
                  {busy ? 'Enregistrement…' : 'Enregistrer le nouveau mot de passe'}
                </button>
              </form>
            </>
          )}

          {state === 'done' && (
            <>
              <div className="auth-info">✅ Mot de passe mis à jour. Redirection vers la connexion…</div>
              <p className="auth-switch">
                <Link to="/connexion" style={{ color: 'var(--blue)' }}>
                  Se connecter maintenant
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
