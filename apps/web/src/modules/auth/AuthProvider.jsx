import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchProfile, loginUser, registerUser } from './authClient.js'

const STORAGE_KEY = 'signbridge_auth_session'
const AuthContext = createContext(null)

function readStoredSession() {
  if (typeof window === 'undefined') return { token: null, user: null }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { token: null, user: null }
    const parsed = JSON.parse(raw)
    return {
      token: parsed.token ?? null,
      user: parsed.user ?? null,
    }
  } catch {
    return { token: null, user: null }
  }
}

function writeStoredSession(session) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

function clearStoredSession() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

export function AuthProvider({ children }) {
  const initialSession = readStoredSession()
  const [token, setToken] = useState(initialSession.token)
  const [user, setUser] = useState(initialSession.user)
  const [booting, setBooting] = useState(Boolean(initialSession.token))

  const persistSession = useCallback((nextToken, nextUser) => {
    setToken(nextToken)
    setUser(nextUser)
    writeStoredSession({ token: nextToken, user: nextUser })
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    clearStoredSession()
  }, [])

  const refreshProfile = useCallback(async (activeToken = token) => {
    if (!activeToken) return null

    try {
      const result = await fetchProfile(activeToken)
      persistSession(activeToken, result.user)
      return result.user
    } catch (error) {
      logout()
      throw error
    }
  }, [logout, persistSession, token])

  const login = useCallback(async (credentials) => {
    const result = await loginUser(credentials)
    persistSession(result.token, result.user)
    return result.user
  }, [persistSession])

  const register = useCallback(async (payload) => {
    const result = await registerUser(payload)
    persistSession(result.token, result.user)
    return result.user
  }, [persistSession])

  useEffect(() => {
    if (!initialSession.token) {
      setBooting(false)
      return
    }

    refreshProfile(initialSession.token)
      .catch(() => {})
      .finally(() => setBooting(false))
  }, [initialSession.token, refreshProfile])

  const value = useMemo(() => ({
    token,
    user,
    isAuthenticated: Boolean(token && user),
    booting,
    login,
    register,
    logout,
    refreshProfile,
  }), [booting, login, logout, refreshProfile, register, token, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}
