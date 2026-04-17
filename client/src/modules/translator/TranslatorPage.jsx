/**
 * TranslatorPage.jsx
 *
 * Página principal del traductor.
 * Integra: HandDetector + ConversationView + VoiceSelector + Speech Recognition
 * y llama al servidor para convertir texto a voz con ElevenLabs.
 */

import { useState, useCallback, useRef } from 'react'
import HandDetector     from './HandDetector.jsx'
import ConversationView from './ConversationView.jsx'
import VoiceSelector    from './VoiceSelector.jsx'
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition.js'

const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

// Tiempo mínimo entre dos señas enviadas al chat (ms)
const SIGN_COOLDOWN = 1200

export default function TranslatorPage() {
  const [messages,    setMessages]    = useState([])
  const [wordBuffer,  setWordBuffer]  = useState('')   // letras acumuladas → palabra
  const [voiceId,     setVoiceId]     = useState('21m00Tcm4TlvDq8ikWAM')
  const [active,      setActive]      = useState(false)
  const [speaking,    setSpeaking]    = useState(false)
  const lastSignTime  = useRef(0)
  const lastLetter    = useRef(null)

  // ── Seña detectada ──────────────────────────────────────────────────────────
  const handleSign = useCallback((letter, confidence) => {
    const now = Date.now()
    if (now - lastSignTime.current < SIGN_COOLDOWN) return
    if (letter === lastLetter.current) return
    lastSignTime.current = now
    lastLetter.current   = letter

    // Acumular letras en el buffer de palabra
    setWordBuffer(prev => prev + letter)
  }, [])

  // ── Confirmar palabra (botón o espacio) ─────────────────────────────────────
  const commitWord = useCallback(async () => {
    if (!wordBuffer.trim()) return

    const text = wordBuffer.trim()
    setWordBuffer('')
    lastLetter.current = null

    // Agregar al chat
    setMessages(prev => [...prev, {
      type: 'sign',
      text,
      timestamp: Date.now()
    }])

    // Llamar a ElevenLabs vía servidor
    try {
      setSpeaking(true)
      const res = await fetch(`${SERVER}/api/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId })
      })

      if (!res.ok) throw new Error('TTS error')

      const blob  = await res.blob()
      const url   = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.onended = () => {
        setSpeaking(false)
        URL.revokeObjectURL(url)
      }
      audio.play()
    } catch (err) {
      console.error('[TTS]', err)
      setSpeaking(false)
    }
  }, [wordBuffer, voiceId])

  // ── Voz del oyente → texto para el sordo ───────────────────────────────────
  const handleTranscript = useCallback((text) => {
    setMessages(prev => [...prev, {
      type: 'voice',
      text,
      timestamp: Date.now()
    }])
  }, [])

  const { start: startListen, stop: stopListen, listening, supported: srSupported }
    = useSpeechRecognition({ onTranscript: handleTranscript })

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] gap-0">

      {/* ── Panel izquierdo: cámara ── */}
      <div className="lg:w-1/2 p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Traductor en tiempo real</h2>
          <button
            onClick={() => setActive(a => !a)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              active
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'btn-primary'
            }`}
          >
            {active ? 'Detener' : 'Iniciar'}
          </button>
        </div>

        {/* Cámara + landmarks */}
        <HandDetector onSignDetected={handleSign} enabled={active} />

        {/* Buffer de la palabra actual */}
        <div className="bg-zinc-900 rounded-xl p-4 flex items-center gap-3">
          <span className="text-zinc-400 text-sm">Palabra:</span>
          <span className="text-2xl font-bold tracking-widest flex-1">
            {wordBuffer || <span className="text-zinc-600">—</span>}
          </span>
          <button
            onClick={commitWord}
            disabled={!wordBuffer}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-30
                       rounded-xl text-sm font-medium transition-all"
          >
            Enviar
          </button>
          <button
            onClick={() => { setWordBuffer(''); lastLetter.current = null }}
            disabled={!wordBuffer}
            className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30
                       rounded-xl text-sm transition-all"
          >
            ✕
          </button>
        </div>

        {/* Selector de voz */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-400">Tu voz:</span>
          <VoiceSelector selectedVoiceId={voiceId} onSelect={setVoiceId} />
          {speaking && (
            <span className="text-xs text-brand-400 animate-pulse">Hablando...</span>
          )}
        </div>
      </div>

      {/* ── Panel derecho: conversación ── */}
      <div className="lg:w-1/2 flex flex-col border-t lg:border-t-0 lg:border-l
                      border-zinc-800">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h2 className="font-semibold">Conversación</h2>
          <button
            onClick={() => setMessages([])}
            className="text-xs text-zinc-500 hover:text-white transition-colors"
          >
            Limpiar
          </button>
        </div>

        <ConversationView messages={messages} />

        {/* Micrófono para la persona oyente */}
        <div className="p-4 border-t border-zinc-800">
          {srSupported ? (
            <button
              onClick={listening ? stopListen : startListen}
              className={`w-full py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                listening
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
              }`}
            >
              <span>{listening ? '⏹' : '🎙'}</span>
              {listening ? 'Detener micrófono (oyente)' : 'Activar micrófono (persona oyente)'}
              {listening && <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />}
            </button>
          ) : (
            <p className="text-xs text-zinc-500 text-center">
              Reconocimiento de voz no disponible en este browser.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
