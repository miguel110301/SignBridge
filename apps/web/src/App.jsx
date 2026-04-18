import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import TranslatorPage from './modules/translator/TranslatorPage.jsx'
import PracticePage   from './modules/practice/PracticePage.jsx'
import LandingPage    from './modules/landing/LandingPage.jsx'
import TrainingPage   from './modules/training/TrainingPage.jsx'

//comentario de prueba

export default function App() {
  const location = useLocation()
  const isImmersiveRoute = location.pathname === '/traductor'

  return (
    <div className={isImmersiveRoute ? 'h-[100dvh] bg-black' : 'min-h-screen flex flex-col'}>
      {!isImmersiveRoute && (
        <nav className="flex items-center justify-between border-b border-zinc-800 px-4 py-4 sm:px-6">
          <NavLink to="/" className="text-lg font-bold tracking-tight text-brand-500 sm:text-xl">
            SignBridge
          </NavLink>
          <div className="flex gap-3 text-sm sm:gap-4">
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
          </div>
        </nav>
      )}

      <main className={isImmersiveRoute ? 'h-full' : 'flex-1'}>
        <Routes>
          <Route path="/"           element={<LandingPage />} />
          <Route path="/traductor"  element={<TranslatorPage />} />
          <Route path="/practica"   element={<PracticePage />} />
          <Route path="/entrenamiento" element={<TrainingPage />} />
        </Routes>
      </main>
    </div>
  )
}
