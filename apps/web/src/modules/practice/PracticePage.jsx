import { useCallback, useEffect, useRef, useState } from 'react'
import { assessHandDetectionQuality, extractHandFeatures } from '@signbridge/sign-engine'
import { useHandDetection } from '../../hooks/useHandDetection.js'
import { requestCameraStream, stopCameraStream } from '../../utils/cameraStream.js'
import { requestPracticeFeedback } from './practiceClient.js'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function captureVideoFrame(video) {
  if (!video?.videoWidth || !video?.videoHeight) return null

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.92)
}

function drawOverlay(canvas, video, hands, handQuality) {
  if (!canvas || !video) return

  const ctx = canvas.getContext('2d')
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  canvas.width = width
  canvas.height = height
  ctx.clearRect(0, 0, width, height)

  const primaryHand = hands?.[0]
  if (!primaryHand?.landmarks?.length) return

  const xs = primaryHand.landmarks.map((point) => point.x)
  const ys = primaryHand.landmarks.map((point) => point.y)
  const minX = Math.min(...xs) * width
  const maxX = Math.max(...xs) * width
  const minY = Math.min(...ys) * height
  const maxY = Math.max(...ys) * height

  const stroke =
    handQuality?.status === 'good'
      ? 'rgba(34, 197, 94, 0.95)'
      : handQuality?.status === 'fair'
        ? 'rgba(245, 158, 11, 0.95)'
        : 'rgba(239, 68, 68, 0.95)'

  ctx.lineWidth = 3
  ctx.strokeStyle = stroke
  ctx.fillStyle = stroke.replace('0.95', '0.08')
  ctx.beginPath()
  ctx.rect(minX, minY, maxX - minX, maxY - minY)
  ctx.fill()
  ctx.stroke()
}

function formatStatus(status) {
  if (status === 'good') return 'verde'
  if (status === 'fair') return 'amarillo'
  return 'rojo'
}

export default function PracticePage() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [selectedLetter, setSelectedLetter] = useState('A')
  const [readyState, setReadyState] = useState(false)
  const [handQuality, setHandQuality] = useState(null)
  const [featureSummary, setFeatureSummary] = useState(null)
  const [handsCount, setHandsCount] = useState(0)
  const [feedback, setFeedback] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [message, setMessage] = useState('')

  const handleLandmarks = useCallback((landmarks, frameMeta = {}) => {
    const quality = assessHandDetectionQuality(landmarks)
    const features = extractHandFeatures(landmarks, frameMeta.handWorldLandmarks)

    setHandQuality(quality)
    setHandsCount(frameMeta.handsCount ?? 1)
    setFeatureSummary(
      features
        ? {
            thumbRole: features.thumb_role,
            gapIM: Number(features.gap_IM.toFixed(3)),
            crossedIM: features.crossed_IM,
            palmOrientation: features.palm_orientation,
            cameraDirections: features.camera_directions,
          }
        : null
    )

    drawOverlay(canvasRef.current, videoRef.current, frameMeta.hands ?? null, quality)
  }, [])

  const { videoRef: hookVideoRef, ready, error } = useHandDetection({
    onLandmarks: handleLandmarks,
    enabled: true,
  })

  useEffect(() => {
    let mounted = true
    let streamRef = null

    if (videoRef.current) {
      hookVideoRef.current = videoRef.current
      requestCameraStream({ preferredFacingMode: 'user' })
        .then((stream) => {
          if (!mounted || !videoRef.current) {
            stopCameraStream(stream)
            return
          }

          streamRef = stream
          videoRef.current.srcObject = stream
          return videoRef.current.play()
        })
        .then(() => {
          if (mounted) setReadyState(true)
        })
        .catch((streamError) => {
          console.error('[Practice] Camera error:', streamError)
          if (mounted) setReadyState(false)
        })
    }

    return () => {
      mounted = false
      stopCameraStream(streamRef)
    }
  }, [hookVideoRef])

  const handleAnalyze = useCallback(async () => {
    if (!videoRef.current) return

    const imageBase64 = captureVideoFrame(videoRef.current)
    if (!imageBase64) {
      setMessage('No pude capturar la imagen actual de la camara.')
      return
    }

    setIsAnalyzing(true)
    setMessage('')
    setFeedback(null)

    try {
      const result = await requestPracticeFeedback({
        imageBase64,
        targetSign: selectedLetter,
        targetType: 'letter',
        handCount: handsCount,
        handQuality,
        featureSummary,
      })

      setFeedback(result)
    } catch (analysisError) {
      console.error('[Practice] Gemini error:', analysisError)
      setMessage('No se pudo obtener feedback de Gemini.')
    } finally {
      setIsAnalyzing(false)
    }
  }, [selectedLetter, handsCount, handQuality, featureSummary])

  return (
    <div className="min-h-[calc(100dvh-65px)] bg-zinc-950 px-4 py-4 text-white sm:px-6 sm:py-6">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="relative min-h-[38dvh] overflow-hidden rounded-[2rem] border border-white/10 bg-black sm:min-h-[44dvh]">
          <video
            ref={videoRef}
            className="h-full min-h-[38dvh] w-full object-contain sm:min-h-[44dvh]"
            muted
            playsInline
          />
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full"
          />
          {(!ready || !readyState) && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <p className="text-sm text-zinc-300">Cargando camara y MediaPipe...</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-950/70 p-6 text-center">
              <p className="text-sm text-red-200">No se pudo inicializar la deteccion: {error}</p>
            </div>
          )}

          <div className="absolute left-3 right-3 top-3 rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-[11px] backdrop-blur-xl sm:left-4 sm:right-auto sm:max-w-xs sm:text-xs">
            <p className="font-semibold uppercase tracking-[0.2em] text-cyan-200">Practica LSM</p>
            <p className="mt-2 font-mono">letra:{selectedLetter} hands:{handsCount}</p>
            <p className="mt-1 font-mono">
              caja:{formatStatus(handQuality?.status)} usable:{handQuality?.reliable ? '1' : '0'} score:{handQuality?.qualityScore?.toFixed(2) ?? '—'}
            </p>
          </div>
        </section>

        <aside className="space-y-5 rounded-[2rem] border border-white/10 bg-zinc-900/80 p-4 backdrop-blur-xl sm:p-5">
          <div>
            <h2 className="text-2xl font-bold">Practica con Gemini</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Captura una pose estatica y recibe feedback especifico sobre la letra objetivo.
            </p>
          </div>

          <div>
            <p className="mb-3 text-sm font-medium text-zinc-300">Letra objetivo</p>
            <div className="flex flex-wrap gap-2">
              {ALPHABET.map((letter) => (
                <button
                  key={letter}
                  type="button"
                  onClick={() => setSelectedLetter(letter)}
                  className={`h-10 w-10 rounded-xl text-sm font-bold transition-colors ${
                    selectedLetter === letter
                      ? 'bg-brand-500 text-white'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isAnalyzing || !handQuality?.reliable}
            className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {isAnalyzing ? 'Analizando...' : 'Analizar con Gemini'}
          </button>

          {message && (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              {message}
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-200">
            <p className="font-semibold text-white">Motor local</p>
            <div className="mt-2 space-y-1 font-mono text-xs">
              <p>thumb:{featureSummary?.thumbRole ?? '—'}</p>
              <p>gap_IM:{featureSummary?.gapIM?.toFixed?.(3) ?? '—'} crossed:{featureSummary?.crossedIM ? '1' : '0'}</p>
              <p>palm:{featureSummary?.palmOrientation ?? '—'}</p>
            </div>
          </div>

          {feedback && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-white">Feedback Gemini</p>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  feedback.correct
                    ? 'bg-emerald-500/20 text-emerald-200'
                    : 'bg-rose-500/20 text-rose-200'
                }`}>
                  {feedback.score}/100
                </span>
              </div>
              <p className="mt-3 text-sm text-zinc-200">{feedback.feedback}</p>
              <p className="mt-3 text-xs text-zinc-400">
                usableForTraining: {feedback.usableForTraining ? 'si' : 'no'}
              </p>
              {feedback.issues?.length > 0 && (
                <p className="mt-2 text-xs text-zinc-400">
                  issues: {feedback.issues.join(', ')}
                </p>
              )}
              <p className="mt-2 text-xs text-cyan-200">
                siguiente ajuste: {feedback.recommendation}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
