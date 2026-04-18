/**
 * useSpeechRecognition.js
 *
 * Hook que usa la Web Speech API del browser para transcribir
 * la voz de la persona oyente en tiempo real.
 *
 * No requiere APIs externas — corre 100% en el browser.
 * Compatible con Chrome, Edge y Safari 16+.
 */

import { useRef, useState, useCallback, useEffect } from 'react'

function canUseSpeechRecognition() {
  if (typeof window === 'undefined') return false
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
}

function isSafariSpeechRuntime() {
  if (typeof window === 'undefined') return false

  const userAgent = window.navigator.userAgent || ''
  const vendor = window.navigator.vendor || ''
  const isAppleVendor = /Apple/i.test(vendor)
  const isSafariEngine = /Safari/i.test(userAgent) && !/Chrome|CriOS|FxiOS|EdgiOS|EdgA|OPiOS|OPR/i.test(userAgent)

  return isAppleVendor || isSafariEngine
}

export function useSpeechRecognition({
  onTranscript,
  onInterim,
  onError,
  language = 'es-MX',
}) {
  const recognitionRef = useRef(null)
  const shouldRestartRef = useRef(false)
  const intentionalStopRef = useRef(false)
  const restartTimerRef = useRef(null)
  const onTranscriptRef = useRef(onTranscript)
  const onInterimRef = useRef(onInterim)
  const onErrorRef = useRef(onError)
  const [listening, setListening] = useState(false)
  const [supported] = useState(canUseSpeechRecognition)
  const [isSafariRuntime] = useState(isSafariSpeechRuntime)

  useEffect(() => {
    onTranscriptRef.current = onTranscript
  }, [onTranscript])

  useEffect(() => {
    onInterimRef.current = onInterim
  }, [onInterim])

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  const stop = useCallback(() => {
    shouldRestartRef.current = false
    intentionalStopRef.current = true
    onInterimRef.current?.('')

    if (restartTimerRef.current) {
      window.clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }

    const recognition = recognitionRef.current
    recognitionRef.current = null
    recognition?.stop?.()
    setListening(false)
  }, [])

  const start = useCallback(() => {
    if (!supported || recognitionRef.current) return

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SR()
    intentionalStopRef.current = false
    shouldRestartRef.current = true

    recognition.lang = language
    recognition.continuous = !isSafariRuntime
    recognition.interimResults = !isSafariRuntime
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      let interimTranscript = ''
      const finalTranscripts = []

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const transcript = result?.[0]?.transcript?.trim?.() ?? ''
        if (!transcript) continue

        if (result.isFinal) {
          finalTranscripts.push(transcript)
        } else {
          interimTranscript = transcript
        }
      }

      onInterimRef.current?.(interimTranscript)

      if (finalTranscripts.length > 0) {
        onInterimRef.current?.('')
        onTranscriptRef.current?.(finalTranscripts.join(' ').trim())
      }
    }

    recognition.onerror = (event) => {
      const errorCode = event.error || 'speech_error'
      const isManualAbort =
        errorCode === 'aborted' &&
        (intentionalStopRef.current || !shouldRestartRef.current)

      if (errorCode === 'aborted') {
        if (!isManualAbort) {
          console.warn('[SpeechRecognition] Reconocimiento abortado; se intentara reiniciar.')
        }
        setListening(false)
        return
      }

      if (errorCode !== 'no-speech') {
        console.error('[SpeechRecognition] Error:', errorCode)
      }

      if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') {
        shouldRestartRef.current = false
      }

      onErrorRef.current?.(errorCode)
      setListening(false)
    }

    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null
      }

      if (!shouldRestartRef.current) {
        setListening(false)
        onInterimRef.current?.('')
        return
      }

      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null
        if (shouldRestartRef.current) {
          start()
        }
      }, isSafariRuntime ? 900 : 180)
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
      setListening(true)
    } catch (error) {
      recognitionRef.current = null
      shouldRestartRef.current = false
      setListening(false)
      console.error('[SpeechRecognition] No se pudo iniciar:', error)
      onErrorRef.current?.('start_failed')
    }
  }, [isSafariRuntime, language, supported])

  useEffect(() => {
    return () => {
      shouldRestartRef.current = false
      intentionalStopRef.current = true

      if (restartTimerRef.current) {
        window.clearTimeout(restartTimerRef.current)
        restartTimerRef.current = null
      }

      recognitionRef.current?.stop?.()
      recognitionRef.current = null
    }
  }, [])

  return { start, stop, listening, supported }
}
