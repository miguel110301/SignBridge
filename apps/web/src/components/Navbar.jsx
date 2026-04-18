import { NavLink } from 'react-router-dom'
import { useI18n } from '../i18n/I18nProvider.jsx'
import { useAuth } from '../modules/auth/AuthProvider.jsx'

export default function Navbar({ isDark, onToggleDark }) {
  const { t, lang, toggleLang } = useI18n()
  const { isAuthenticated, user, logout } = useAuth()

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo */}
        <NavLink to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white text-sm font-bold shadow-md shadow-brand-600/30">
            S
          </div>
          <span className="text-lg font-extrabold tracking-tight text-brand-600 dark:text-brand-400">
            SignBridge
          </span>
        </NavLink>

        {/* Nav links — desktop */}
        <div className="hidden items-center gap-1 md:flex">
          <NavLink
            to="/traductor"
            className={({ isActive }) =>
              `rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`
            }
          >
            {t('nav.translate')}
          </NavLink>
          <NavLink
            to="/practica"
            className={({ isActive }) =>
              `rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`
            }
          >
            {t('nav.practice')}
          </NavLink>
          <NavLink
            to="/academia"
            className={({ isActive }) =>
              `rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`
            }
          >
            {t('nav.academy')}
          </NavLink>
          <NavLink
            to="/entrenamiento"
            className={({ isActive }) =>
              `rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent-50 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`
            }
          >
            {t('nav.training')}
          </NavLink>
        </div>

        {/* Right side: controls */}
        <div className="flex items-center gap-2">
          {/* Language toggle */}
          <button
            type="button"
            onClick={toggleLang}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300 transition-colors hover:border-brand-400"
            aria-label="Toggle language"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.6 9h16.8M3.6 15h16.8M12 3c2.21 2.52 3.46 5.68 3.46 9s-1.25 6.48-3.46 9c-2.21-2.52-3.46-5.68-3.46-9s1.25-6.48 3.46-9z" />
            </svg>
            {lang === 'es' ? 'ES' : 'EN'}
          </button>

          {/* Dark mode toggle */}
          <button
            type="button"
            onClick={onToggleDark}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors hover:border-brand-400"
            aria-label="Toggle dark mode"
          >
            {isDark ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m8.66-13.66l-.71.71M4.05 19.95l-.71.71M21 12h-1M4 12H3m16.66 7.66l-.71-.71M4.05 4.05l-.71-.71M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* Auth */}
          {isAuthenticated ? (
            <div className="hidden items-center gap-2 sm:flex">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{user?.name}</span>
              <button
                type="button"
                onClick={logout}
                className="rounded-xl px-3 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-red-500 transition-colors"
              >
                {t('nav.logout')}
              </button>
            </div>
          ) : (
            <NavLink
              to="/login"
              className="hidden rounded-2xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand-600/25 transition-all hover:bg-brand-700 active:scale-95 sm:block"
            >
              {t('nav.login')}
            </NavLink>
          )}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="fixed bottom-0 inset-x-0 z-50 border-t border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-around py-2">
          <NavLink
            to="/traductor"
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium transition-colors ${
                isActive ? 'text-brand-600 dark:text-brand-400' : 'text-zinc-500 dark:text-zinc-400'
              }`
            }
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {t('nav.translate')}
          </NavLink>
          <NavLink
            to="/practica"
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium transition-colors ${
                isActive ? 'text-brand-600 dark:text-brand-400' : 'text-zinc-500 dark:text-zinc-400'
              }`
            }
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {t('nav.practice')}
          </NavLink>
          <NavLink
            to="/academia"
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium transition-colors ${
                isActive ? 'text-brand-600 dark:text-brand-400' : 'text-zinc-500 dark:text-zinc-400'
              }`
            }
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0v6m-4-3.5l4 2.5 4-2.5" />
            </svg>
            {t('nav.academy')}
          </NavLink>
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium transition-colors ${
                isActive ? 'text-brand-600 dark:text-brand-400' : 'text-zinc-500 dark:text-zinc-400'
              }`
            }
          >
            <div className="flex h-10 w-10 -mt-5 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/40">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a2 2 0 01-2-2v-4a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2h-4z" />
              </svg>
            </div>
          </NavLink>
          <NavLink
            to="/entrenamiento"
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium transition-colors ${
                isActive ? 'text-accent-600 dark:text-accent-400' : 'text-zinc-500 dark:text-zinc-400'
              }`
            }
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t('nav.training')}
          </NavLink>
          <NavLink
            to="/login"
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium transition-colors ${
                isActive ? 'text-brand-600 dark:text-brand-400' : 'text-zinc-500 dark:text-zinc-400'
              }`
            }
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {t('nav.login')}
          </NavLink>
        </div>
      </div>
    </nav>
  )
}
