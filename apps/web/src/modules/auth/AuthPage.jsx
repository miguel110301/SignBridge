import { useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider.jsx'
import { useI18n } from '../../i18n/I18nProvider.jsx'

function getRedirectPath(locationState) {
  return locationState?.from?.pathname || '/practica'
}


export default function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, login, register } = useAuth()
  const { t } = useI18n()

  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const redirectTo = useMemo(() => getRedirectPath(location.state), [location.state])

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      if (mode === 'login') {
        await login({ email, password })
      } else {
        await register({ name, email, password })
      }

      navigate(redirectTo, { replace: true })
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSubmitting(false)
    }
  }

  const inputClasses =
    'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-brand-400 dark:focus:ring-brand-400/20'

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-72px)] w-full max-w-lg items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
      {/* ─── Form card ─── */}
      <section className="w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50 dark:border-zinc-800 dark:bg-zinc-900/80 dark:shadow-black/20 sm:p-8">
          {/* Tab switcher */}
          <div className="inline-flex rounded-full border border-zinc-200 bg-zinc-100 p-1 text-sm dark:border-zinc-700 dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`rounded-full px-5 py-2 font-medium transition ${
                mode === 'login'
                  ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/25'
                  : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              {t('auth.login')}
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`rounded-full px-5 py-2 font-medium transition ${
                mode === 'register'
                  ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/25'
                  : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              {t('auth.register')}
            </button>
          </div>

          <h1 className="mt-6 text-2xl font-bold text-zinc-900 dark:text-white sm:text-3xl">
            {mode === 'login' ? t('auth.login_title') : t('auth.register_title')}
          </h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            {t('auth.subtitle')}
          </p>

          <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
            {mode === 'register' && (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('auth.name_label')}</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className={inputClasses}
                  placeholder={t('auth.name_placeholder')}
                  required
                />
              </label>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('auth.email_label')}</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClasses}
                placeholder={t('auth.email_placeholder')}
                required
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('auth.password_label')}</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClasses}
                placeholder={t('auth.password_placeholder')}
                minLength={8}
                required
              />
            </label>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="mt-1 rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting}
            >
              {submitting
                ? t('auth.submitting')
                : mode === 'login'
                  ? t('auth.submit_login')
                  : t('auth.submit_register')}
            </button>
          </form>

          {/* Switch mode link */}
          <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {mode === 'login' ? t('auth.no_account') : t('auth.has_account')}{' '}
            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="font-semibold text-brand-600 transition hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            >
              {mode === 'login' ? t('auth.create_one') : t('auth.login_here')}
            </button>
          </p>
      </section>
    </div>
  )
}
