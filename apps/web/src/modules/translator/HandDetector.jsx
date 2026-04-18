import { useRef, useEffect, useState, useCallback } from 'react'
import {
  assessHandDetectionQuality,
  createGestureSequenceRecognizer,
  createSmoother,
  extractHandMetrics,
} from '@signbridge/sign-engine'
import { useHandDetection } from '../../hooks/useHandDetection.js'
import { requestCameraStream, stopCameraStream as releaseCameraStream } from '../../utils/cameraStream.js'

const REQUIRED_STABILITY_FRAMES = 8
const HAND_LOST_GRACE_MS = 180
const STATIC_POSE_WINDOW_MS = 220
const STATIC_POSE_MIN_FRAMES = 3
const STATIC_POSE_MAX_TRAVEL = 0.05
const STATIC_POSE_MAX_RANGE = 0.09
const MIN_STATIC_CONFIDENCE = 0.7
const MIN_STATIC_MARGIN = 0.14

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
]

function getPalmCenter(landmarks) {
  return {
    x: (landmarks[0].x + landmarks[5].x + landmarks[9].x + landmarks[17].x) / 4,
    y: (landmarks[0].y + landmarks[5].y + landmarks[9].y + landmarks[17].y) / 4,
  }
}

function pushStaticPoseSample(historyRef, landmarks, timestamp) {
  const palmCenter = getPalmCenter(landmarks)
  historyRef.current.push({ timestamp, palmCenter })

  const oldestAllowed = timestamp - STATIC_POSE_WINDOW_MS
  while (historyRef.current.length > 0 && historyRef.current[0].timestamp < oldestAllowed) {
    historyRef.current.shift()
  }

  const samples = historyRef.current
  const xs = samples.map((sample) => sample.palmCenter.x)
  const ys = samples.map((sample) => sample.palmCenter.y)
  const rangeX = xs.length ? Math.max(...xs) - Math.min(...xs) : 0
  const rangeY = ys.length ? Math.max(...ys) - Math.min(...ys) : 0
  const first = samples[0]?.palmCenter ?? palmCenter
  const last = samples[samples.length - 1]?.palmCenter ?? palmCenter
  const travel = Math.hypot(last.x - first.x, last.y - first.y)
  const stable =
    samples.length >= STATIC_POSE_MIN_FRAMES &&
    travel <= STATIC_POSE_MAX_TRAVEL &&
    rangeX <= STATIC_POSE_MAX_RANGE &&
    rangeY <= STATIC_POSE_MAX_RANGE

  return {
    sampleCount: samples.length,
    palmCenter,
    rangeX,
    rangeY,
    travel,
    stable,
  }
}

function inferMirrorPreview(track) {
  if (!track) return true

  const settings = track.getSettings?.() ?? {}
  const facingMode = settings.facingMode?.toLowerCase?.() ?? ''
  const label = track.label?.toLowerCase?.() ?? ''

  if (facingMode === 'environment') return false
  if (facingMode === 'user') return true

  if (/rear|back|environment|trasera|posterior/.test(label)) return false
  if (/front|facetime|face time|user|frontal|integrated|built-in|built in/.test(label)) return true

  return true
}

function getHandednessLabel(handedness) {
  const rawLabel =
    handedness?.categoryName ||
    handedness?.displayName ||
    handedness?.label ||
    ''

  const normalized = String(rawLabel).trim().toLowerCase()
  if (normalized === 'left') return 'left'
  if (normalized === 'right') return 'right'
  return 'unknown'
}

function clearCanvas(canvas) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
}

function drawLandmarks(landmarks, canvas, handQuality, currentDetection) {
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  canvas.width = width
  canvas.height = height
  ctx.clearRect(0, 0, width, height)

  if (!landmarks?.length) return

  drawHandSkeleton(ctx, landmarks, width, height, handQuality, true)

  if (currentDetection?.display) {
    ctx.fillStyle = 'rgba(8, 15, 28, 0.8)'
    ctx.fillRect(12, 12, 108, 40)
    ctx.fillStyle = '#ffffff'
    ctx.font = '700 26px Inter, system-ui, sans-serif'
    ctx.fillText(currentDetection.display, 22, 40)
  }
}

function drawSecondaryHand(landmarks, canvas) {
  if (!canvas || !landmarks?.length) return
  const ctx = canvas.getContext('2d')
  const width = canvas.width
  const height = canvas.height
  drawHandSkeleton(ctx, landmarks, width, height, null, false)
}

function drawHandSkeleton(ctx, landmarks, width, height, handQuality, isPrimary) {
  const bbox = handQuality?.bbox
  const stroke = isPrimary
    ? (handQuality?.status === 'good'
        ? 'rgba(34, 197, 94, 0.95)'
        : handQuality?.status === 'fair'
          ? 'rgba(245, 158, 11, 0.95)'
          : 'rgba(239, 68, 68, 0.95)')
    : 'rgba(168, 85, 247, 0.75)'

  if (isPrimary && bbox) {
    const minX = bbox.minX * width
    const minY = bbox.minY * height
    const boxWidth = bbox.width * width
    const boxHeight = bbox.height * height

    ctx.lineWidth = 3
    ctx.strokeStyle = stroke
    ctx.fillStyle = stroke.replace('0.95', '0.08')
    ctx.beginPath()
    ctx.rect(minX, minY, boxWidth, boxHeight)
    ctx.fill()
    ctx.stroke()
  }

  ctx.strokeStyle = isPrimary ? 'rgba(34, 211, 238, 0.8)' : 'rgba(196, 148, 251, 0.7)'
  ctx.lineWidth = 2
  for (const [fromIndex, toIndex] of HAND_CONNECTIONS) {
    ctx.beginPath()
    ctx.moveTo(landmarks[fromIndex].x * width, landmarks[fromIndex].y * height)
    ctx.lineTo(landmarks[toIndex].x * width, landmarks[toIndex].y * height)
    ctx.stroke()
  }

  ctx.fillStyle = isPrimary ? '#f8fafc' : '#e9d5ff'
  for (const point of landmarks) {
    ctx.beginPath()
    ctx.arc(point.x * width, point.y * height, 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

function getCameraErrorMessage(error) {
  if (error?.name === 'NotAllowedError') {
    return 'Permiso de camara denegado.'
  }

  if (error?.name === 'NotFoundError') {
    return 'No se encontro una camara disponible.'
  }

  if (error?.name === 'NotReadableError') {
    return 'La camara esta siendo usada por otra app.'
  }

  return error?.message || 'No se pudo abrir la camara.'
}

export default function HandDetector({ onSignDetected, enabled = true }) {
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const lastSeenAtRef = useRef(0)
  const lastEmittedRef = useRef(null)
  const candidateLetterRef = useRef(null)
  const candidateFramesRef = useRef(0)
  const staticPoseHistoryRef = useRef([])
  const smootherRef = useRef(createSmoother(REQUIRED_STABILITY_FRAMES))
  const gestureRecognizerRef = useRef(createGestureSequenceRecognizer())

  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [shouldMirrorPreview, setShouldMirrorPreview] = useState(true)
  const [currentDetection, setCurrentDetection] = useState(null)
  const [handQuality, setHandQuality] = useState(null)

  const emitDetection = useCallback((detection, meta) => {
    if (!detection) return

    const signature = `${detection.type}:${detection.label}`
    if (signature === lastEmittedRef.current) return

    lastEmittedRef.current = signature
    onSignDetected?.(detection, meta)
  }, [onSignDetected])

  const resetPredictionState = useCallback(() => {
    smootherRef.current.reset()
    gestureRecognizerRef.current.reset()
    candidateLetterRef.current = null
    candidateFramesRef.current = 0
    staticPoseHistoryRef.current = []
    lastEmittedRef.current = null
    setCurrentDetection(null)
    setHandQuality(null)
    clearCanvas(canvasRef.current)
  }, [])

  const handleLandmarks = useCallback((landmarks, frameMeta = {}) => {
    const now = Date.now()
    const secondaryLandmarks = frameMeta.secondaryLandmarks ?? null
    const handedness = getHandednessLabel(frameMeta.handedness)
    const handMetrics = extractHandMetrics(landmarks, {
      handedness,
      worldLandmarks: frameMeta.handWorldLandmarks,
      handsCount: frameMeta.handsCount,
    })
    const nextHandQuality = assessHandDetectionQuality(landmarks)
    const staticPose = pushStaticPoseSample(staticPoseHistoryRef, landmarks, now)
    const enrichedFrameMeta = {
      ...frameMeta,
      handQuality: nextHandQuality,
      staticPose,
      handedness,
    }
    const gestureState = gestureRecognizerRef.current.push(landmarks, enrichedFrameMeta, now)

    lastSeenAtRef.current = now
    setHandQuality(nextHandQuality)

    if (gestureState.gesture) {
      smootherRef.current.reset()
      candidateLetterRef.current = null
      candidateFramesRef.current = 0

      const gestureDetection = {
        type: 'gesture',
        label: gestureState.gesture.word,
        display: String(gestureState.gesture.word || '').toUpperCase(),
        confidence: gestureState.gesture.confidence,
      }

      setCurrentDetection(gestureDetection)
      drawLandmarks(landmarks, canvasRef.current, nextHandQuality, gestureDetection)
      drawSecondaryHand(secondaryLandmarks, canvasRef.current)
      emitDetection(gestureDetection, {
        handMetrics,
        handQuality: nextHandQuality,
        staticPose,
        handedness,
      })
      return
    }

    if (!nextHandQuality.reliable || !staticPose.stable || gestureState.suppressStatic) {
      smootherRef.current.reset()
      candidateLetterRef.current = null
      candidateFramesRef.current = 0
      setCurrentDetection(null)
      drawLandmarks(landmarks, canvasRef.current, nextHandQuality, null)
      drawSecondaryHand(secondaryLandmarks, canvasRef.current)
      return
    }

    const bestCandidate = handMetrics?.classification?.bestCandidate ?? null
    const topCandidates = handMetrics?.classification?.topCandidates ?? []
    const secondCandidate = topCandidates[1] ?? null
    const candidateMargin =
      bestCandidate && secondCandidate
        ? bestCandidate.confidence - secondCandidate.confidence
        : bestCandidate
          ? bestCandidate.confidence
          : 0

    if (
      !bestCandidate ||
      bestCandidate.confidence < MIN_STATIC_CONFIDENCE ||
      candidateMargin < MIN_STATIC_MARGIN
    ) {
      smootherRef.current.reset()
      candidateLetterRef.current = null
      candidateFramesRef.current = 0
      setCurrentDetection(null)
      drawLandmarks(landmarks, canvasRef.current, nextHandQuality, null)
      drawSecondaryHand(secondaryLandmarks, canvasRef.current)
      return
    }

    const rawPrediction = {
      letter: bestCandidate.letter,
      confidence: bestCandidate.confidence,
    }
    const smoothedPrediction = smootherRef.current.push(rawPrediction)
    const prediction = smoothedPrediction || rawPrediction
    const stabilityFrames =
      prediction.letter === candidateLetterRef.current
        ? candidateFramesRef.current + 1
        : 1

    candidateLetterRef.current = prediction.letter
    candidateFramesRef.current = stabilityFrames

    const frameConfidence = Math.min(stabilityFrames / REQUIRED_STABILITY_FRAMES, 1)
    const confidence = Math.max(prediction.confidence ?? 0, frameConfidence)
    const letterDetection = {
      type: 'letter',
      label: prediction.letter,
      display: prediction.letter,
      confidence,
    }

    setCurrentDetection(letterDetection)
    drawLandmarks(landmarks, canvasRef.current, nextHandQuality, letterDetection)
    drawSecondaryHand(secondaryLandmarks, canvasRef.current)

    if (stabilityFrames >= REQUIRED_STABILITY_FRAMES) {
      emitDetection(letterDetection, {
        handMetrics,
        handQuality: nextHandQuality,
        staticPose,
        handedness,
        margin: candidateMargin,
      })
    }
  }, [emitDetection])

  const { videoRef, ready, error } = useHandDetection({
    onLandmarks: handleLandmarks,
    enabled,
  })

  const stopCamera = useCallback(() => {
    releaseCameraStream(streamRef.current)
    streamRef.current = null

    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }

    setCameraReady(false)
    setCameraError('')
  }, [videoRef])

  useEffect(() => {
    if (!enabled) {
      stopCamera()
      resetPredictionState()
      return
    }

    let cancelled = false

    async function startCamera() {
      try {
        const stream = await requestCameraStream({ preferredFacingMode: 'user' })
        if (cancelled) {
          releaseCameraStream(stream)
          return
        }

        streamRef.current = stream
        const videoTrack = stream.getVideoTracks?.()[0] ?? null
        setShouldMirrorPreview(inferMirrorPreview(videoTrack))

        if (!videoRef.current) return

        videoRef.current.srcObject = stream
        await videoRef.current.play()
        if (!cancelled) {
          setCameraReady(true)
        }
      } catch (streamError) {
        if (!cancelled) {
          console.error('[Practice Camera]', streamError)
          setCameraError(getCameraErrorMessage(streamError))
          setCameraReady(false)
        }
      }
    }

    void startCamera()

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [enabled, resetPredictionState, stopCamera, videoRef])

  useEffect(() => {
    if (!enabled) return undefined

    const intervalId = window.setInterval(() => {
      const idleFor = Date.now() - lastSeenAtRef.current
      if (idleFor < HAND_LOST_GRACE_MS) return

      resetPredictionState()
    }, 100)

    return () => window.clearInterval(intervalId)
  }, [enabled, resetPredictionState])

  useEffect(() => {
    return () => {
      stopCamera()
      resetPredictionState()
    }
  }, [resetPredictionState, stopCamera])

  const statusLabel = cameraError
    ? 'Error camara'
    : error
      ? 'Error modelo'
      : !ready
        ? 'Cargando IA'
        : !cameraReady
          ? 'Abriendo camara'
          : currentDetection
            ? currentDetection.type === 'gesture'
              ? 'Gesto detectado'
              : 'Letra detectada'
            : handQuality
              ? 'Analizando mano'
              : 'Esperando mano'

  return (
    <div className="relative mx-auto w-full overflow-hidden rounded-[1.8rem] border border-white/10 bg-black shadow-2xl">
      <div className="aspect-[4/3] w-full">
        <video
          ref={videoRef}
          className={`h-full w-full object-cover transition-opacity duration-300 ${
            cameraReady ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ transform: shouldMirrorPreview ? 'scaleX(-1)' : 'none' }}
          muted
          playsInline
          autoPlay
        />

        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ transform: shouldMirrorPreview ? 'scaleX(-1)' : 'none' }}
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/75" />

        {(!ready || !cameraReady) && !cameraError && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/65">
            <div className="text-center">
              <div className="mx-auto mb-3 h-10 w-10 rounded-full border-2 border-cyan-300/60 border-t-transparent animate-spin" />
              <p className="text-sm text-zinc-300">
                {!ready ? 'Cargando modelo de IA...' : 'Abriendo camara...'}
              </p>
            </div>
          </div>
        )}

        {(cameraError || error) && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-950/80 p-4 text-center">
            <p className="max-w-xs text-sm text-red-100">
              {cameraError || `Error al cargar el modelo: ${error}`}
            </p>
          </div>
        )}

        <div className="absolute left-3 right-3 top-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 bg-black/55 px-3 py-1 text-[11px] font-medium text-zinc-100 backdrop-blur-md">
            {statusLabel}
          </span>
          {handQuality && (
            <span className="rounded-full border border-white/10 bg-black/45 px-3 py-1 text-[11px] text-zinc-200 backdrop-blur-md">
              Calidad: {handQuality.status}
            </span>
          )}
        </div>

        <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/10 bg-black/60 p-3 backdrop-blur-xl">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-300">
                Deteccion en vivo
              </p>
              <p className="mt-1 text-4xl font-black leading-none text-white">
                {currentDetection?.display ?? '—'}
              </p>
            </div>
            <span className="text-xs text-zinc-300">
              {Math.round((currentDetection?.confidence ?? 0) * 100)}%
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-150"
              style={{
                width: `${Math.max((currentDetection?.confidence ?? 0) * 100, currentDetection ? 8 : 0)}%`,
                background:
                  (currentDetection?.confidence ?? 0) > 0.85
                    ? 'linear-gradient(90deg, #34d399 0%, #10b981 100%)'
                    : (currentDetection?.confidence ?? 0) > 0.6
                      ? 'linear-gradient(90deg, #f59e0b 0%, #f97316 100%)'
                      : 'linear-gradient(90deg, #fb7185 0%, #ef4444 100%)',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
