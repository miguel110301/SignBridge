import { Routes, Route, useLocation } from 'react-router-dom'
import TranslatorPage from './modules/translator/TranslatorPage.jsx'
import PracticePage   from './modules/practice/PracticePage.jsx'
import FundamentosLsmModulePage from './modules/practice/FundamentosLsmModulePage.jsx'
import InteraccionesBasicasModulePage from './modules/practice/InteraccionesBasicasModulePage.jsx'
import ContextosRealesModulePage from './modules/practice/ContextosRealesModulePage.jsx'
import {
  CONTEXTOS_REALES_MODULE_ROUTE,
  FUNDAMENTALS_MODULE_ROUTE,
  INTERACCIONES_BASICAS_MODULE_ROUTE,
} from './modules/practice/moduleRoutes.js'
import LandingPage    from './modules/landing/LandingPage.jsx'
import TrainingPage   from './modules/training/TrainingPage.jsx'
import AcademyPage    from './modules/academy/AcademyPage.jsx'
import LessonPage     from './modules/academy/LessonPage.jsx'
import LessonComplete from './modules/academy/LessonComplete.jsx'
import AuthPage from './modules/auth/AuthPage.jsx'
import RequireAuth from './modules/auth/RequireAuth.jsx'
import Navbar from './components/Navbar.jsx'
import { useDarkMode } from './hooks/useDarkMode.js'

export default function App() {
  const location = useLocation()
  const isImmersiveRoute = location.pathname === '/traductor'
  const isLessonRoute = location.pathname.startsWith('/academia/leccion')
  const { isDark, toggle: toggleDark } = useDarkMode()

  return (
    <div className={isImmersiveRoute ? 'h-[100dvh] bg-black' : 'min-h-screen flex flex-col bg-neutral-50 dark:bg-zinc-950'}>
      {!isImmersiveRoute && !isLessonRoute && (
        <Navbar isDark={isDark} onToggleDark={toggleDark} />
      )}

      <main className={isImmersiveRoute ? 'h-full' : 'flex-1'}>
        <Routes>
          <Route path="/"           element={<LandingPage />} />
          <Route path="/login"      element={<AuthPage />} />
          <Route path="/traductor"  element={<TranslatorPage />} />
          <Route path="/practica"   element={<RequireAuth><PracticePage /></RequireAuth>} />
          <Route path={FUNDAMENTALS_MODULE_ROUTE} element={<RequireAuth><FundamentosLsmModulePage /></RequireAuth>} />
          <Route path={INTERACCIONES_BASICAS_MODULE_ROUTE} element={<RequireAuth><InteraccionesBasicasModulePage /></RequireAuth>} />
          <Route path={CONTEXTOS_REALES_MODULE_ROUTE} element={<RequireAuth><ContextosRealesModulePage /></RequireAuth>} />
          <Route path="/entrenamiento" element={<RequireAuth><TrainingPage /></RequireAuth>} />
          <Route path="/academia"   element={<RequireAuth><AcademyPage /></RequireAuth>} />
          <Route path="/academia/leccion/:unitId/:lessonId" element={<RequireAuth><LessonPage /></RequireAuth>} />
          <Route path="/academia/resultado/:unitId/:lessonId" element={<RequireAuth><LessonComplete /></RequireAuth>} />
        </Routes>
      </main>
    </div>
  )
}
