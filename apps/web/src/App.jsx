import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import TranslatorPage from './modules/translator/TranslatorPage.jsx'
import PracticePage   from './modules/practice/PracticePage.jsx'
import LandingPage    from './modules/landing/LandingPage.jsx'
import TrainingPage   from './modules/training/TrainingPage.jsx'
import AuthPage from './modules/auth/AuthPage.jsx'
import RequireAuth from './modules/auth/RequireAuth.jsx'
import { useAuth } from './modules/auth/AuthProvider.jsx'

export default function App() {
  const location = useLocation()
  const isImmersiveRoute = location.pathname === '/traductor'
  const { isAuthenticated, user, logout } = useAuth()

  return (
    <div className={isImmersiveRoute ? 'h-[100dvh] bg-black' : 'min-h-screen flex flex-col'}>
      {!isImmersiveRoute && (
        <nav className="border-b border-zinc-800 px-4 py-4 sm:px-6">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <NavLink to="/" className="text-lg font-bold tracking-tight text-brand-500 sm:text-xl">
              SignBridge
            </NavLink>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <NavLink
                to="/traductor"
                className={({ isActive }) =>
                  isActive ? 'font-medium text-white' : 'text-zinc-400 transition-colors hover:text-white'
                }
              >
                Traductor
              </NavLink>
              <NavLink
                to="/practica"
                className={({ isActive }) =>
                  isActive ? 'font-medium text-white' : 'text-zinc-400 transition-colors hover:text-white'
                }
              >
                Practica
              </NavLink>
              <NavLink
                to="/entrenamiento"
                className={({ isActive }) =>
                  isActive ? 'font-medium text-white' : 'text-emerald-400 transition-colors hover:text-emerald-300'
                }
              >
                Entrenamiento
              </NavLink>
              {isAuthenticated ? (
                <>
                  <span className="max-w-[12rem] truncate text-zinc-400">
                    {user?.name}
                  </span>
                  <button
                    type="button"
                    onClick={logout}
                    className="text-zinc-400 transition-colors hover:text-white"
                  >
                    Salir
                  </button>
                </>
              ) : (
                <NavLink
                  to="/login"
                  className={({ isActive }) =>
                    isActive ? 'font-medium text-white' : 'text-zinc-400 transition-colors hover:text-white'
                  }
                >
                  Login
                </NavLink>
              )}
            </div>
          </div>
        </nav>
      )}

      <main className={isImmersiveRoute ? 'h-full' : 'flex-1'}>
        <Routes>
          <Route path="/"           element={<LandingPage />} />
          <Route path="/login"      element={<AuthPage />} />
          <Route path="/traductor"  element={<TranslatorPage />} />
          <Route path="/practica"   element={<RequireAuth><PracticePage /></RequireAuth>} />
          <Route path="/entrenamiento" element={<RequireAuth><TrainingPage /></RequireAuth>} />
        </Routes>
      </main>
    </div>
  )
}
