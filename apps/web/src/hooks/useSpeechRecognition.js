/**
 * useSpeechRecognition.js
 *
 * Hook que usa la Web Speech API del browser para transcribir
 * la voz de la persona oyente en tiempo real.
 *
 * No requiere APIs externas — corre 100% en el browser.
 * Compatible con Chrome, Edge y Safari 16+.
 */

import { useRef, useState, useCallback } from 'react'

export function useSpeechRecognition({ onTranscript, language = 'es-MX' }) {
  const recognitionRef = useRef(null)
  const [listening, setListening] = useState(false)
  const [supported] = useState(() => 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window)

  const start = useCallback(() => {
    if (!supported) return

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SR()

    recognition.lang            = language
    recognition.continuous      = true    // no para después de cada frase
    recognition.interimResults  = false   // solo resultados finales (más limpio)
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      const last       = event.results.length - 1
      const transcript = event.results[last][0].transcript.trim()
      if (transcript) onTranscript?.(transcript)
    }

    recognition.onerror = (e) => {
      console.error('[SpeechRecognition] Error:', e.error)
      setListening(false)
    }

    recognition.onend = () => {
      // Si sigue en modo "listening", reiniciar automáticamente
      if (recognitionRef.current) recognition.start()
    }

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }, [supported, language, onTranscript])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setListening(false)
  }, [])

  return { start, stop, listening, supported }
}
