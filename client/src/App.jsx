import { Routes, Route, NavLink } from 'react-router-dom'
import TranslatorPage from './modules/translator/TranslatorPage.jsx'
import PracticePage   from './modules/practice/PracticePage.jsx'
import LandingPage    from './modules/landing/LandingPage.jsx'
import TrainingPage   from './modules/training/TrainingPage.jsx'

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <NavLink to="/" className="text-xl font-bold text-brand-500 tracking-tight">
          SignBridge
        </NavLink>
        <div className="flex gap-4 text-sm">
          <NavLink
            to="/traductor"
            className={({ isActive }) =>
              isActive ? 'text-white font-medium' : 'text-zinc-400 hover:text-white transition-colors'
            }
          >
            Traductor
          </NavLink>
          <NavLink
            to="/practica"
            className={({ isActive }) =>
              isActive ? 'text-white font-medium' : 'text-zinc-400 hover:text-white transition-colors'
            }
          >
            Practica
          </NavLink>
          <NavLink
            to="/entrenamiento"
            className={({ isActive }) =>
              isActive ? 'text-white font-medium' : 'text-emerald-400 hover:text-emerald-300 transition-colors'
            }
          >
            Entrenamiento
          </NavLink>
        </div>
      </nav>

      {/* Pages */}
      <main className="flex-1">
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
