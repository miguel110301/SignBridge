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
    <div className="max-w-3xl mx-auto px-6 py-16 flex flex-col gap-20">

      {/* ── Hero ── */}
      <section className="text-center flex flex-col gap-6">
        <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/30
                        rounded-full px-4 py-1.5 text-sm text-brand-300 mx-auto">
          <span className="w-2 h-2 bg-brand-500 rounded-full animate-pulse" />
          Hackathon Troyano 2026
        </div>

        <h1 className="text-5xl font-bold leading-tight">
          Cada persona sorda<br />
          <span className="text-brand-500">merece una voz.</span>
        </h1>

        <p className="text-zinc-400 text-lg max-w-xl mx-auto leading-relaxed">
          En México hay 2 millones de personas sordas y menos de 200 intérpretes certificados.
          SignBridge cierra esa brecha con IA en tiempo real, desde cualquier teléfono, sin instalar nada.
        </p>

        <div className="flex gap-4 justify-center flex-wrap">
          <button
            onClick={() => navigate('/traductor')}
            className="btn-primary text-base"
          >
            Probar ahora →
          </button>
          <a
            href="https://github.com/miguel110301/SignBridge"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 border border-zinc-700 hover:border-zinc-500
                       rounded-xl text-sm font-medium text-zinc-300 transition-colors"
          >
            Ver código
          </a>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="grid grid-cols-3 gap-4">
        {STATS.map(s => (
          <div key={s.value}
               className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center">
            <p className="text-3xl font-bold text-brand-400 mb-1">{s.value}</p>
            <p className="text-xs text-zinc-500 leading-snug">{s.label}</p>
          </div>
        ))}
      </section>

      {/* ── Cómo funciona ── */}
      <section className="flex flex-col gap-8">
        <h2 className="text-2xl font-bold text-center">Cómo funciona</h2>
        <div className="flex flex-col gap-4">
          {HOW_IT_WORKS.map((step, i) => (
            <div key={i}
                 className="flex items-start gap-4 bg-zinc-900 border border-zinc-800
                            rounded-2xl p-5">
              <div className="text-3xl flex-shrink-0">{step.icon}</div>
              <div>
                <h3 className="font-semibold mb-1">{step.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Sponsors ── */}
      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold text-center">Construido con</h2>
        <div className="flex flex-wrap gap-3 justify-center">
          {['MediaPipe', 'ElevenLabs', 'Gemini API', 'MongoDB Atlas', 'Vultr', 'React PWA'].map(t => (
            <span key={t}
                  className="bg-zinc-800 border border-zinc-700 rounded-full
                             px-4 py-1.5 text-sm text-zinc-300">
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="text-center bg-brand-500/10 border border-brand-500/20
                          rounded-3xl p-10 flex flex-col gap-4">
        <h2 className="text-2xl font-bold">
          No construimos un traductor.<br />
          Construimos el puente que<br />
          debería existir desde hace 20 años.
        </h2>
        <button
          onClick={() => navigate('/traductor')}
          className="btn-primary text-base mx-auto"
        >
          Iniciar conversación →
        </button>
      </section>

    </div>
  )
}
