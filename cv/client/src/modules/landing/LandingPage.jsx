/**
 * LandingPage.jsx
 * Página de presentación del proyecto.
 * Tono: humano, empático, directo. Nada técnico.
 */

import { useNavigate } from 'react-router-dom'

const STATS = [
  { value: '2M+',  label: 'personas sordas en México' },
  { value: '<200', label: 'intérpretes certificados' },
  { value: '0',    label: 'costo de acceso con SignBridge' },
]

const HOW_IT_WORKS = [
  {
    icon: '🤟',
    title: 'La persona sorda hace señas',
    desc: 'La cámara detecta los 21 puntos de la mano en tiempo real. Sin hardware adicional.'
  },
  {
    icon: '🧠',
    title: 'La IA interpreta',
    desc: 'MediaPipe y nuestro clasificador reconocen cada seña del alfabeto LSM en milisegundos.'
  },
  {
    icon: '🔊',
    title: 'ElevenLabs da la voz',
    desc: 'El texto traducido se convierte en voz natural. La persona sorda elige con qué voz quiere ser escuchada.'
  },
]

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.22),_transparent_38%),radial-gradient(circle_at_bottom,_rgba(16,185,129,0.12),_transparent_34%)]" />

      <div className="relative mx-auto flex max-w-5xl flex-col gap-14 px-4 py-10 sm:px-6 sm:py-14 sm:gap-20">

        {/* ── Hero ── */}
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] px-5 py-8 text-center shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:px-10 sm:py-12">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-sm text-brand-300">
            <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
          Hackathon Troyano 2026
          </div>

          <h1 className="mt-6 text-4xl font-bold leading-tight sm:text-6xl">
            Traducción de señas<br />
            <span className="bg-gradient-to-r from-brand-400 via-white to-emerald-300 bg-clip-text text-transparent">
              en tiempo real desde tu teléfono
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">
            SignBridge convierte deletreo y gestos de lengua de señas en subtítulos y voz natural.
            Apunta la cámara, detecta la mano y deja que la app interprete automáticamente.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={() => navigate('/traductor')}
              className="btn-primary text-base"
            >
              Abrir traductor
            </button>
            <a
              href="https://github.com/miguel110301/SignBridge"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500"
            >
              Ver repositorio
            </a>
          </div>
        </section>

        {/* ── Stats ── */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STATS.map(s => (
            <div
              key={s.value}
              className="rounded-2xl border border-white/8 bg-zinc-900/80 p-5 text-center shadow-[0_10px_30px_rgba(0,0,0,0.22)]"
            >
              <p className="mb-1 text-3xl font-bold text-brand-400">{s.value}</p>
              <p className="text-xs leading-snug text-zinc-500">{s.label}</p>
            </div>
          ))}
        </section>

        {/* ── Cómo funciona ── */}
        <section className="flex flex-col gap-8">
          <h2 className="text-center text-2xl font-bold">Cómo funciona</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {HOW_IT_WORKS.map((step, i) => (
              <div
                key={i}
                className="rounded-[1.75rem] border border-white/8 bg-zinc-900/75 p-5"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-2xl">
                  {step.icon}
                </div>
                <h3 className="mb-2 font-semibold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Sponsors ── */}
        <section className="flex flex-col gap-4">
          <h2 className="text-center text-2xl font-bold">Construido con</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {['MediaPipe', 'ElevenLabs', 'Gemini API', 'MongoDB Atlas', 'Vultr', 'React PWA'].map(t => (
              <span
                key={t}
                className="rounded-full border border-zinc-700 bg-zinc-800/90 px-4 py-1.5 text-sm text-zinc-300"
              >
                {t}
              </span>
            ))}
          </div>
        </section>

        {/* ── CTA final ── */}
        <section className="flex flex-col gap-4 rounded-[2rem] border border-brand-500/20 bg-gradient-to-br from-brand-500/14 to-emerald-500/10 p-6 text-center sm:p-10">
          <h2 className="text-xl font-bold sm:text-2xl">
            No es un demo de cámara.<br />
            Es una conversación que por fin puede ocurrir.
          </h2>
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-zinc-300">
            La experiencia está optimizada para móvil porque ahí es donde realmente importa: abrir, apuntar y escuchar.
          </p>
          <button
            onClick={() => navigate('/traductor')}
            className="btn-primary mx-auto text-base"
          >
            Iniciar conversación
          </button>
        </section>
      </div>
    </div>
  )
}
