/**
 * LandingPage.jsx
 * Rediseño inspirado en mockup mobile-first.
 * Usa i18n, dark mode con Tailwind, branding SignBridge.
 */

import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n/I18nProvider.jsx'

/* ── Value Icons (inline SVG) ─────────────────────────────────────────────── */
const VALUE_ICONS = {
  empathy: (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  ),
  bridge: (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.03a4.5 4.5 0 00-6.364-6.364L4.5 8.25l4.5 4.5" />
    </svg>
  ),
  access: (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.354-5.646A9 9 0 008.646 3.646 9.004 9.004 0 0012 21zm0 0V3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 18c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3" />
    </svg>
  ),
  voice: (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
    </svg>
  ),
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { t } = useI18n()

  const values = t('values.items')

  return (
    <div className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(124,58,237,0.08),_transparent_50%)] dark:bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.22),_transparent_38%),radial-gradient(circle_at_bottom,_rgba(16,185,129,0.12),_transparent_34%)]" />

      <div className="relative mx-auto flex max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-12 sm:gap-16">

        {/* ── Hero ── */}
        <section className="text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-brand-200 dark:border-brand-500/30 bg-brand-50 dark:bg-brand-500/10 px-4 py-1.5 text-sm font-medium text-brand-700 dark:text-brand-300">
            <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
            {t('hero.badge')}
          </div>

          <h1 className="mt-6 text-4xl font-extrabold leading-tight text-zinc-900 dark:text-white sm:text-6xl">
            {t('hero.title')}
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-zinc-600 dark:text-zinc-300 sm:text-lg">
            {t('hero.subtitle')}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={() => navigate('/traductor')}
              className="btn-primary text-base"
            >
              {t('hero.cta')}
            </button>
            <a
              href="https://github.com/miguel110301/SignBridge"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outlined text-sm"
            >
              {t('hero.secondary_cta')}
            </a>
          </div>
        </section>

        {/* ── Feature Cards (2-column bento) ── */}
        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* Live Translate */}
          <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-500 p-6 text-white shadow-xl shadow-brand-600/20 sm:p-8">
            <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
            <div className="relative">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold">{t('features.live_translate.title')}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/80">
                {t('features.live_translate.desc')}
              </p>
              <button
                onClick={() => navigate('/traductor')}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-brand-700 shadow-lg transition-all hover:shadow-xl active:scale-95"
              >
                {t('features.live_translate.cta')}
              </button>
            </div>
          </div>

          {/* Text to Sign */}
          <div className="card group relative overflow-hidden p-6 sm:p-8">
            <div className="absolute -right-8 -bottom-8 h-28 w-28 rounded-full bg-brand-100 dark:bg-brand-900/20 blur-2xl" />
            <div className="relative">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">{t('features.text_to_sign.title')}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {t('features.text_to_sign.desc')}
              </p>
              <button
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-accent-500/25 transition-all hover:bg-accent-600 active:scale-95"
              >
                {t('features.text_to_sign.cta')}
              </button>
            </div>
          </div>
        </section>

        {/* ── Values ── */}
        <section className="flex flex-col gap-6">
          <div className="text-center">
            <h2 className="text-2xl font-extrabold text-zinc-900 dark:text-white sm:text-3xl">
              {t('values.title')}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400 italic">
              "{t('values.subtitle')}"
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.isArray(values) && values.map((item, i) => {
              const colors = [
                'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400',
                'bg-accent-50 dark:bg-accent-900/20 text-accent-600 dark:text-accent-400',
                'bg-tertiary-50 dark:bg-tertiary-900/20 text-tertiary-800 dark:text-tertiary-400',
                'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400',
              ]
              return (
                <div key={i} className="card p-5 sm:p-6">
                  <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl ${colors[i]}`}>
                    {VALUE_ICONS[item.icon] || VALUE_ICONS.empathy}
                  </div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {item.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Recent Connections (mock) ── */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{t('recent.title')}</h2>
            <button className="text-sm font-semibold text-brand-600 dark:text-brand-400 hover:underline">
              {t('recent.view_history')}
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <div className="card flex items-start gap-4 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-100 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t('recent.sign_to_text')}
                </p>
                <p className="mt-1 text-base font-semibold text-zinc-900 dark:text-white">
                  "Would you like some coffee?"
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">{t('recent.hours_ago', { n: 2 })}</p>
              </div>
              <button className="shrink-0 text-zinc-300 dark:text-zinc-600 hover:text-brand-500 transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
            </div>

            <div className="card flex items-start gap-4 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t('recent.text_to_sign')}
                </p>
                <p className="mt-1 text-base font-semibold text-zinc-900 dark:text-white">
                  "The meeting is at 3 PM."
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">{t('recent.yesterday')}</p>
              </div>
              <button className="shrink-0 text-zinc-300 dark:text-zinc-600 hover:text-brand-500 transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
            </div>
          </div>
        </section>

        {/* ── Stats + Practice ── */}
        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* Stats */}
          <div className="card flex flex-col items-center justify-center p-6 text-center">
            <p className="text-5xl font-black text-accent-500">128</p>
            <div className="mt-3 h-2 w-32 overflow-hidden rounded-full bg-accent-100 dark:bg-accent-900/30">
              <div className="h-full w-3/4 rounded-full bg-accent-500" />
            </div>
            <p className="mt-3 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {t('stats.phrases_mastered')}
            </p>
          </div>

          {/* Practice CTA */}
          <div
            className="group relative overflow-hidden rounded-3xl bg-cover bg-center p-6 text-white shadow-xl sm:p-8"
            style={{ backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.3)), url("https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=600&q=75")' }}
          >
            <div className="relative mt-8">
              <h3 className="text-2xl font-bold">{t('practice.title')}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/70">
                {t('practice.desc')}
              </p>
              <button
                onClick={() => navigate('/practica')}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-white/30 active:scale-95"
              >
                {t('practice.title')}
              </button>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="flex flex-col gap-8">
          <h2 className="text-center text-2xl font-extrabold text-zinc-900 dark:text-white sm:text-3xl">
            {t('how.title')}
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {t('how.steps').map((step, i) => (
              <div key={i} className="card p-5 sm:p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 dark:bg-white/5 text-2xl">
                  {step.icon}
                </div>
                <h3 className="mb-2 font-bold text-zinc-900 dark:text-white">{step.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Sponsors ── */}
        <section className="flex flex-col gap-4">
          <h2 className="text-center text-2xl font-extrabold text-zinc-900 dark:text-white">
            {t('sponsors.title')}
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            {['MediaPipe', 'ElevenLabs', 'Gemini API', 'MongoDB Atlas', 'Vultr', 'React PWA'].map((tech) => (
              <span
                key={tech}
                className="rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/90 px-4 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                {tech}
              </span>
            ))}
          </div>
        </section>

        {/* ── CTA final ── */}
        <section className="flex flex-col gap-4 rounded-3xl border border-brand-200 dark:border-brand-500/20 bg-gradient-to-br from-brand-50 dark:from-brand-500/14 to-accent-50 dark:to-emerald-500/10 p-6 text-center sm:p-10">
          <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white sm:text-2xl">
            {t('cta.title')}<br />
            {t('cta.title2')}
          </h2>
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            {t('cta.desc')}
          </p>
          <button
            onClick={() => navigate('/traductor')}
            className="btn-primary mx-auto text-base"
          >
            {t('cta.button')}
          </button>
        </section>

        {/* ── Footer ── */}
        <footer className="flex flex-col items-center gap-2 py-6 text-center text-xs text-zinc-500 dark:text-zinc-500">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white text-xs font-bold">S</div>
            <span className="font-bold text-brand-600 dark:text-brand-400">SignBridge</span>
          </div>
          <p>{t('footer.tagline')}</p>
          <p>&copy; {new Date().getFullYear()} SignBridge. {t('footer.rights')}</p>
        </footer>

      </div>
    </div>
  )
}

