import { useCallback, useEffect, useRef, useState } from 'react'
import { useHandDetection } from '../../hooks/useHandDetection.js'
import { classifySign, createSmoother } from './SignClassifier.js'

const API_BASE = (import.meta.env.VITE_SERVER_URL ?? '').replace(/\/$/, '')

const LETTER_STABILITY_FRAMES = 8
const LETTER_COOLDOWN_MS = 300
const WORD_PAUSE_MS = 800
const PHRASE_PAUSE_MS = 2000
const HAND_LOST_GRACE_MS = 180
const MAX_SUBTITLE_LINES = 4

function normalizeWord(word) {
  return word.trim().toLowerCase()
}

function formatSpelledWord(word) {
  return word ? word.split('').join(' ') : '...'
}

function getCameraErrorMessage(error) {
  if (error?.name === 'NotAllowedError') {
    return 'Permiso de camara denegado. Abre la PWA en HTTPS y acepta el acceso.'
  }

  if (error?.name === 'NotFoundError') {
    return 'No se encontro una camara disponible en este dispositivo.'
  }

  if (error?.name === 'NotReadableError') {
    return 'La camara ya esta en uso por otra app.'
  }

  return error?.message || 'No se pudo abrir la camara trasera.'
}

async function requestRearCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Este navegador no soporta acceso a camara.')
  }

  const attempts = [
    {
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    },
    {
      audio: false,
      video: {
        facingMode: 'environment',
      },
    },
    {
      audio: false,
      video: true,
    },
  ]

  let lastError = null

  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error('No se pudo iniciar la camara.')
}

export default function TranslatorPage() {
  const streamRef = useRef(null)
  const smootherRef = useRef(createSmoother(8))

  // Estos refs mantienen el valor "real" para que timers y callbacks no dependan
  // de cierres viejos cuando estamos procesando frames a 30-60fps.
  const wordBufferRef = useRef('')
  const phraseWordsRef = useRef([])
  const handPresentRef = useRef(false)
  const displayLetterRef = useRef(null)
  const displayConfidenceRef = useRef(0)

  const candidateLetterRef = useRef(null)
  const candidateFramesRef = useRef(0)
  const appendLockRef = useRef(null)
  const lastAcceptedAtRef = useRef(0)
  const lastHandSeenAtRef = useRef(Date.now())
  const wordPauseHandledRef = useRef(false)
  const phrasePauseHandledRef = useRef(false)

  const audioQueueRef = useRef([])
  const audioGenerationRef = useRef(0)
  const activeAudioRef = useRef(null)
  const activeAudioUrlRef = useRef(null)
  const isAudioProcessingRef = useRef(false)

  const [isActive, setIsActive] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [ttsError, setTtsError] = useState('')
  const [handPresent, setHandPresent] = useState(false)
  const [currentLetter, setCurrentLetter] = useState(null)
  const [currentConfidence, setCurrentConfidence] = useState(0)
  const [wordBuffer, setWordBufferState] = useState('')
  const [phraseWords, setPhraseWordsState] = useState([])
  const [subtitleLines, setSubtitleLines] = useState([])
  const [audioStatus, setAudioStatus] = useState('idle')
  const [queueSize, setQueueSize] = useState(0)

  const setWordBuffer = useCallback((nextValue) => {
    const next =
      typeof nextValue === 'function' ? nextValue(wordBufferRef.current) : nextValue

    wordBufferRef.current = next
    setWordBufferState(next)
    return next
  }, [])

  const setPhraseWords = useCallback((nextValue) => {
    const next =
      typeof nextValue === 'function' ? nextValue(phraseWordsRef.current) : nextValue

    phraseWordsRef.current = next
    setPhraseWordsState(next)
    return next
  }, [])

  const setHandPresence = useCallback((next) => {
    if (handPresentRef.current === next) return next

    handPresentRef.current = next
    setHandPresent(next)
    return next
  }, [])

  const updateDetectionDisplay = useCallback((letter, confidence) => {
    if (displayLetterRef.current !== letter) {
      displayLetterRef.current = letter
      setCurrentLetter(letter)
    }

    if (
      confidence === 0 ||
      Math.abs(displayConfidenceRef.current - confidence) >= 0.03
    ) {
      displayConfidenceRef.current = confidence
      setCurrentConfidence(confidence)
    }
  }, [])

  const resetPredictionState = useCallback(() => {
    smootherRef.current.reset()
    candidateLetterRef.current = null
    candidateFramesRef.current = 0
    appendLockRef.current = null
    updateDetectionDisplay(null, 0)
    setHandPresence(false)
  }, [setHandPresence, updateDetectionDisplay])

  const stopActiveAudio = useCallback(() => {
    const audio = activeAudioRef.current

    if (audio) {
      audio.pause()
      audio.src = ''
      activeAudioRef.current = null
    }

    if (activeAudioUrlRef.current) {
      URL.revokeObjectURL(activeAudioUrlRef.current)
      activeAudioUrlRef.current = null
    }
  }, [])

  const clearAudioQueue = useCallback(() => {
    audioGenerationRef.current += 1
    audioQueueRef.current = []
    isAudioProcessingRef.current = false
    setQueueSize(0)
    setAudioStatus('idle')
    stopActiveAudio()
  }, [stopActiveAudio])

  const playAudioBlob = useCallback(async (url, generation) => {
    await new Promise((resolve, reject) => {
      if (generation !== audioGenerationRef.current) {
        resolve()
        return
      }

      const audio = new Audio(url)
      activeAudioRef.current = audio

      let settled = false

      const finalize = (callback) => {
        if (settled) return

        settled = true
        audio.onended = null
        audio.onpause = null
        audio.onerror = null

        if (activeAudioRef.current === audio) {
          activeAudioRef.current = null
        }

        callback?.()
      }

      audio.onended = () => finalize(resolve)
      audio.onpause = () => finalize(resolve)
      audio.onerror = () => finalize(() => reject(new Error('No se pudo reproducir el audio.')))

      audio.play()
        .then(() => {
          if (generation !== audioGenerationRef.current) {
            audio.pause()
            finalize(resolve)
            return
          }

          setAudioStatus('playing')
        })
        .catch((error) => finalize(() => reject(error)))
    })
  }, [])

  const processAudioQueue = useCallback(async () => {
    if (isAudioProcessingRef.current) return

    // Un solo worker procesa la cola: primero generamos audio, luego lo reproducimos,
    // y solo despues pasamos a la siguiente palabra.
    isAudioProcessingRef.current = true
    const generation = audioGenerationRef.current

    while (audioQueueRef.current.length > 0 && generation === audioGenerationRef.current) {
      const nextText = audioQueueRef.current.shift()
      setQueueSize(audioQueueRef.current.length)

      try {
        setAudioStatus('fetching')

        const response = await fetch(`${API_BASE}/api/speak`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: nextText }),
        })

        if (generation !== audioGenerationRef.current) break

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error || 'No se pudo generar la voz.')
        }

        const blob = await response.blob()

        if (generation !== audioGenerationRef.current) break

        const url = URL.createObjectURL(blob)
        activeAudioUrlRef.current = url
        await playAudioBlob(url, generation)

        if (activeAudioUrlRef.current === url) {
          URL.revokeObjectURL(url)
          activeAudioUrlRef.current = null
        }
      } catch (error) {
        if (generation !== audioGenerationRef.current) break

        console.error('[Translator TTS]', error)
        setTtsError(error.message || 'No se pudo generar el audio.')
      } finally {
        if (activeAudioUrlRef.current && !activeAudioRef.current) {
          URL.revokeObjectURL(activeAudioUrlRef.current)
          activeAudioUrlRef.current = null
        }
      }
    }

    if (generation === audioGenerationRef.current) {
      setAudioStatus(audioQueueRef.current.length > 0 ? 'queued' : 'idle')
    }

    isAudioProcessingRef.current = false
  }, [playAudioBlob])

  const enqueueSpeech = useCallback((text) => {
    if (!text) return

    setTtsError('')
    audioQueueRef.current.push(text)
    setQueueSize(audioQueueRef.current.length)
    void processAudioQueue()
  }, [processAudioQueue])

  const commitWord = useCallback(() => {
    const rawWord = wordBufferRef.current.trim()
    if (!rawWord) return null

    const committedWord = normalizeWord(rawWord)

    setWordBuffer('')
    setPhraseWords((prev) => [...prev, committedWord])
    enqueueSpeech(committedWord)

    return committedWord
  }, [enqueueSpeech, setPhraseWords, setWordBuffer])

  const commitPhrase = useCallback(() => {
    if (wordBufferRef.current.trim()) {
      commitWord()
    }

    if (phraseWordsRef.current.length === 0) return null

    const phrase = phraseWordsRef.current.join(' ')

    setSubtitleLines((prev) => {
      const next = [...prev, phrase]
      return next.slice(-MAX_SUBTITLE_LINES)
    })

    setPhraseWords([])
    return phrase
  }, [commitWord, setPhraseWords])

  const appendLetter = useCallback((letter) => {
    const now = Date.now()

    if (appendLockRef.current === letter) return
    if (now - lastAcceptedAtRef.current < LETTER_COOLDOWN_MS) return

    lastAcceptedAtRef.current = now
    appendLockRef.current = letter
    setWordBuffer((prev) => prev + letter)
  }, [setWordBuffer])

  const handleLandmarks = useCallback((landmarks) => {
    const now = Date.now()
    const rawPrediction = classifySign(landmarks)
    const smoothedPrediction = smootherRef.current.push(rawPrediction)
    const prediction = smoothedPrediction || rawPrediction

    lastHandSeenAtRef.current = now
    wordPauseHandledRef.current = false
    phrasePauseHandledRef.current = false
    setHandPresence(true)

    if (!prediction) {
      candidateLetterRef.current = null
      candidateFramesRef.current = 0
      updateDetectionDisplay(null, 0)
      return
    }

    // Pedimos 8 frames consistentes antes de aceptar una letra.
    // El smoother reduce ruido; este contador evita duplicados por un frame aislado.
    const stabilityFrames =
      prediction.letter === candidateLetterRef.current
        ? candidateFramesRef.current + 1
        : 1

    candidateLetterRef.current = prediction.letter
    candidateFramesRef.current = stabilityFrames

    if (appendLockRef.current && appendLockRef.current !== prediction.letter) {
      appendLockRef.current = null
    }

    const frameConfidence = Math.min(stabilityFrames / LETTER_STABILITY_FRAMES, 1)
    const confidence = Math.max(prediction.confidence ?? 0, frameConfidence)

    updateDetectionDisplay(prediction.letter, confidence)

    if (stabilityFrames >= LETTER_STABILITY_FRAMES) {
      appendLetter(prediction.letter)
    }
  }, [appendLetter, setHandPresence, updateDetectionDisplay])

  const { videoRef, ready, error: detectionError } = useHandDetection({
    onLandmarks: handleLandmarks,
    enabled: isActive,
  })

  const stopCameraStream = useCallback(() => {
    const stream = streamRef.current
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }

    setCameraReady(false)
  }, [videoRef])

  useEffect(() => {
    return () => {
      stopCameraStream()
      clearAudioQueue()
    }
  }, [clearAudioQueue, stopCameraStream])

  useEffect(() => {
    if (!isActive) {
      stopCameraStream()
      clearAudioQueue()
      resetPredictionState()
      return
    }

    let cancelled = false

    async function startCamera() {
      if (!window.isSecureContext && window.location.hostname !== 'localhost') {
        setCameraError('La camara en movil requiere HTTPS. Abre la PWA con certificado valido.')
        setIsActive(false)
        return
      }

      setCameraError('')
      setCameraReady(false)
      setTtsError('')
      lastHandSeenAtRef.current = Date.now()
      wordPauseHandledRef.current = false
      phrasePauseHandledRef.current = false

      try {
        const stream = await requestRearCamera()

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream

        if (!videoRef.current) return

        videoRef.current.srcObject = stream
        await videoRef.current.play()

        if (!cancelled) {
          setCameraReady(true)
        }
      } catch (cameraStartError) {
        console.error('[Translator Camera]', cameraStartError)
        if (!cancelled) {
          setCameraError(getCameraErrorMessage(cameraStartError))
          setIsActive(false)
        }
      }
    }

    void startCamera()

    return () => {
      cancelled = true
      stopCameraStream()
    }
  }, [clearAudioQueue, isActive, resetPredictionState, stopCameraStream, videoRef])

  useEffect(() => {
    if (!isActive) return

    const intervalId = window.setInterval(() => {
      const idleFor = Date.now() - lastHandSeenAtRef.current

      // Como el hook solo nos avisa cuando SI hay mano, las pausas se infieren
      // midiendo cuanto tiempo llevamos sin recibir landmarks.
      if (idleFor >= HAND_LOST_GRACE_MS) {
        resetPredictionState()
      }

      if (idleFor >= WORD_PAUSE_MS && !wordPauseHandledRef.current) {
        wordPauseHandledRef.current = true
        commitWord()
      }

      if (idleFor >= PHRASE_PAUSE_MS && !phrasePauseHandledRef.current) {
        phrasePauseHandledRef.current = true
        commitPhrase()
      }
    }, 100)

    return () => window.clearInterval(intervalId)
  }, [commitPhrase, commitWord, isActive, resetPredictionState])

  const toggleTranslation = useCallback(() => {
    setIsActive((prev) => !prev)
  }, [])

  const recentLines = subtitleLines.slice(-3)
  const liveSubtitle = [...phraseWords, wordBuffer ? normalizeWord(wordBuffer) : '']
    .filter(Boolean)
    .join(' ')

  const statusLabel = detectionError
    ? 'Error IA'
    : !ready
      ? 'Cargando IA'
      : !isActive
        ? 'En pausa'
        : cameraReady && handPresent
          ? 'Detectando'
          : cameraReady
            ? 'Esperando mano'
            : 'Abriendo camara'

  return (
    <section className="relative h-full min-h-[calc(100dvh-73px)] overflow-hidden bg-black">
      <video
        ref={videoRef}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
          cameraReady ? 'opacity-100' : 'opacity-0'
        }`}
        muted
        playsInline
      />

      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/10 to-black/85" />

      {!cameraReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
          <div className="max-w-sm px-6 text-center">
            <div className="mx-auto mb-4 h-14 w-14 rounded-full border-2 border-brand-500/60 border-t-transparent animate-spin" />
            <h1 className="mb-2 text-2xl font-semibold tracking-tight">SignBridge Live</h1>
            <p className="text-sm text-zinc-300">
              {isActive
                ? 'Abriendo camara trasera y preparando la deteccion en tiempo real.'
                : 'Toca iniciar y apunta la camara trasera hacia la persona que esta senando.'}
            </p>
          </div>
        </div>
      )}

      <div
        className="absolute inset-x-0 top-0 z-10 px-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-black/35 p-4 backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-300">Letra detectada</p>
              <div className="mt-1 flex items-end gap-3">
                <span className="text-6xl font-black leading-none text-white sm:text-7xl">
                  {currentLetter || '—'}
                </span>
                <span className="pb-2 text-sm text-zinc-200">
                  {Math.round(currentConfidence * 100)}%
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 text-right">
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-zinc-100">
                {statusLabel}
              </span>

              {(audioStatus !== 'idle' || queueSize > 0) && (
                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-200">
                  {audioStatus === 'fetching'
                    ? 'Preparando audio'
                    : audioStatus === 'playing'
                      ? 'Reproduciendo'
                      : 'Audio en cola'}
                  {queueSize > 0 ? ` · ${queueSize}` : ''}
                </span>
              )}
            </div>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-150"
              style={{
                width: `${Math.max(currentConfidence * 100, currentLetter ? 8 : 0)}%`,
                background:
                  currentConfidence > 0.85
                    ? 'linear-gradient(90deg, #34d399 0%, #10b981 100%)'
                    : currentConfidence > 0.6
                      ? 'linear-gradient(90deg, #f59e0b 0%, #f97316 100%)'
                      : 'linear-gradient(90deg, #fb7185 0%, #ef4444 100%)',
              }}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-300">
            <span className="rounded-full bg-white/8 px-3 py-1">
              Letra estable: {LETTER_STABILITY_FRAMES} frames
            </span>
            <span className="rounded-full bg-white/8 px-3 py-1">
              Pausa palabra: {WORD_PAUSE_MS} ms
            </span>
            <span className="rounded-full bg-white/8 px-3 py-1">
              Pausa frase: {PHRASE_PAUSE_MS} ms
            </span>
          </div>
        </div>
      </div>

      <div
        className="absolute inset-x-0 bottom-0 z-10 px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
      >
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-black/45 p-4 backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-300">Palabra actual</p>
              <p className="mt-1 text-lg font-semibold tracking-[0.28em] text-white">
                {formatSpelledWord(wordBuffer)}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right text-xs text-zinc-300">
              <p>{handPresent ? 'Mano visible' : 'Sin mano'}</p>
              <p className="mt-1 text-zinc-400">Se habla automaticamente al cerrar palabra</p>
            </div>
          </div>

          <div className="space-y-2">
            {recentLines.map((line, index) => (
              <p key={`${line}-${index}`} className="text-sm text-zinc-400">
                {line}
              </p>
            ))}

            <p className="min-h-[2.5rem] text-2xl font-semibold leading-tight text-white sm:text-3xl">
              {liveSubtitle || 'Los subtitulos apareceran aqui en cuanto detectemos la mano.'}
            </p>
          </div>

          {(cameraError || detectionError || ttsError) && (
            <div className="mt-4 space-y-2 text-sm">
              {cameraError && (
                <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-200">
                  {cameraError}
                </p>
              )}
              {detectionError && (
                <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-200">
                  Error del modelo: {detectionError}
                </p>
              )}
              {ttsError && (
                <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-100">
                  Audio: {ttsError}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={toggleTranslation}
        className={`absolute bottom-6 right-4 z-20 rounded-full px-5 py-4 text-sm font-semibold shadow-2xl transition active:scale-95 touch-manipulation ${
          isActive
            ? 'bg-red-500 text-white'
            : 'bg-brand-500 text-white'
        }`}
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
      >
        {isActive ? 'Pausar traduccion' : 'Iniciar traduccion'}
      </button>
    </section>
  )
}
