import { useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider.jsx'

function getRedirectPath(locationState) {
  return locationState?.from?.pathname || '/practica'
}

export default function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, login, register } = useAuth()

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

  return (
    <div className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-5xl items-center px-4 py-10 sm:px-6">
      <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-8">
          <div className="inline-flex rounded-full border border-zinc-800 bg-zinc-900/80 p-1 text-sm">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`rounded-full px-4 py-2 transition ${mode === 'login' ? 'bg-brand-500 text-white' : 'text-zinc-400'}`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`rounded-full px-4 py-2 transition ${mode === 'register' ? 'bg-brand-500 text-white' : 'text-zinc-400'}`}
            >
              Crear cuenta
            </button>
          </div>

          <h1 className="mt-6 text-3xl font-bold">
            {mode === 'login' ? 'Accede a tu espacio de aprendizaje' : 'Crea tu cuenta de aprendizaje'}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
            El traductor puede seguir siendo abierto, pero tu avance de práctica y aprendizaje ya queda
            ligado a una cuenta personal.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
            {mode === 'register' && (
              <label className="flex flex-col gap-2 text-sm">
                <span className="text-zinc-300">Nombre</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-brand-500"
                  placeholder="Miguel Moreno"
                  required
                />
              </label>
            )}

            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-300">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-brand-500"
                placeholder="tu@email.com"
                required
              />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-300">Contraseña</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-brand-500"
                placeholder="Minimo 8 caracteres"
                minLength={8}
                required
              />
            </label>

            {error && (
              <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary mt-2 text-base disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? 'Procesando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
            </button>
          </form>
        </section>

        <section className="flex flex-col justify-center rounded-[2rem] border border-brand-500/15 bg-gradient-to-br from-brand-500/12 to-emerald-500/8 p-6 sm:p-8">
          <p className="text-sm uppercase tracking-[0.28em] text-brand-300">SignBridge Learn</p>
          <h2 className="mt-4 text-2xl font-semibold">Qué quedará vinculado a tu cuenta</h2>
          <ul className="mt-6 flex list-disc flex-col gap-3 pl-5 text-sm leading-relaxed text-zinc-300">
            <li>Progreso por letra y señas dominadas.</li>
            <li>Preferencias personales de voz y práctica.</li>
            <li>Módulo de aprendizaje cuando entre en la siguiente fase.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
