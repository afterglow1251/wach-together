import { createContext, useContext, createSignal, type ParentComponent } from "solid-js"
import type { User } from "../../shared/types"
import { api } from "../services/api"

interface AuthState {
  user: () => User | null
  isLoggedIn: () => boolean
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthState>()

export const AuthProvider: ParentComponent = (props) => {
  const stored = localStorage.getItem("wt_user")
  const [user, setUser] = createSignal<User | null>(stored ? JSON.parse(stored) : null)

  const login = async (username: string, password: string) => {
    const resp = await api.auth({ username, password })
    if (resp.ok && resp.user) {
      setUser(resp.user)
      localStorage.setItem("wt_user", JSON.stringify(resp.user))
      return { ok: true }
    }
    return { ok: false, error: resp.error }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("wt_user")
  }

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: () => user() !== null, login, logout }}>
      {props.children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
