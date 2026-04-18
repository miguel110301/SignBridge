import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider.jsx'

export default function RequireAuth({ children }) {
  const location = useLocation()
  const { booting, isAuthenticated } = useAuth()

  if (booting) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 px-6 py-5 text-sm text-zinc-300">
          Validando sesión...
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}
