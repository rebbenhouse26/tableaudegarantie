import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api, getToken, setToken } from '../api/client'
import type { AuthResponse, Cabinet } from '../api/types'

interface AuthState {
  cabinet: Cabinet | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

const CABINET_KEY = 'tdg_cabinet'

function readStoredCabinet(): Cabinet | null {
  const raw = localStorage.getItem(CABINET_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Cabinet
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [cabinet, setCabinet] = useState<Cabinet | null>(() =>
    getToken() ? readStoredCabinet() : null,
  )
  const [loading] = useState(false)

  useEffect(() => {
    if (cabinet) localStorage.setItem(CABINET_KEY, JSON.stringify(cabinet))
    else localStorage.removeItem(CABINET_KEY)
  }, [cabinet])

  function apply(res: AuthResponse) {
    setToken(res.token)
    setCabinet(res.cabinet)
  }

  const value = useMemo<AuthState>(
    () => ({
      cabinet,
      loading,
      async login(email, password) {
        apply(await api.post<AuthResponse>('/auth/login', { email, password }))
      },
      async register(name, email, password) {
        apply(await api.post<AuthResponse>('/auth/register', { name, email, password }))
      },
      logout() {
        setToken(null)
        setCabinet(null)
      },
    }),
    [cabinet, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return ctx
}
