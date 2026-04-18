import { Routes, Route, useLocation } from 'react-router-dom'
import TranslatorPage from './modules/translator/TranslatorPage.jsx'
import PracticePage   from './modules/practice/PracticePage.jsx'
import LandingPage    from './modules/landing/LandingPage.jsx'
import TrainingPage   from './modules/training/TrainingPage.jsx'
import AuthPage from './modules/auth/AuthPage.jsx'
import RequireAuth from './modules/auth/RequireAuth.jsx'
import Navbar from './components/Navbar.jsx'
import { useDarkMode } from './hooks/useDarkMode.js'

export default function App() {
  const location = useLocation()
  const isImmersiveRoute = location.pathname === '/traductor'
  const { isDark, toggle: toggleDark } = useDarkMode()

  return (
    <div className={isImmersiveRoute ? 'h-[100dvh] bg-black' : 'min-h-screen flex flex-col bg-neutral-50 dark:bg-zinc-950'}>
      {!isImmersiveRoute && (
        <Navbar isDark={isDark} onToggleDark={toggleDark} />
      )}

      <main className={isImmersiveRoute ? 'h-full' : 'flex-1 pb-20 md:pb-0'}>
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
