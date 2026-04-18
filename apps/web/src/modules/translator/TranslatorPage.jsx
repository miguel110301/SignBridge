import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  assessHandDetectionQuality,
  createGestureSequenceRecognizer,
  createSmoother,
  debugFingers,
  decodeFingerSpelling,
  extractHandMetrics,
  hydrateTemplatesFromServer,
  SIGN_LANGUAGE_PROFILE,
} from '@signbridge/sign-engine'
import { useHandDetection } from '../../hooks/useHandDetection.js'
import { requestCameraStream } from '../../utils/cameraStream.js'
import { useI18n } from '../../i18n/I18nProvider.jsx'

const API_BASE = (import.meta.env.VITE_SERVER_URL ?? '').replace(/\/$/, '')

const LETTER_STABILITY_FRAMES = 8
const LETTER_COOLDOWN_MS = 300
const WORD_PAUSE_MS = 800
const PHRASE_PAUSE_MS = 2000
const HAND_LOST_GRACE_MS = 180
const MAX_SUBTITLE_LINES = 4
const DEBUG_UI_THROTTLE_MS = 90
const STATIC_POSE_WINDOW_MS = 220
const STATIC_POSE_MIN_FRAMES = 3
const STATIC_POSE_MAX_TRAVEL = 0.05
const STATIC_POSE_MAX_RANGE = 0.09
const MIN_STATIC_CONFIDENCE = 0.7

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
]

const FACE_DEBUG_KEYPOINTS = [
  { index: 10, label: 'FOREHEAD', color: '#67e8f9' },
  { index: 33, label: 'L-EYE', color: '#a5f3fc' },
  { index: 263, label: 'R-EYE', color: '#a5f3fc' },
  { index: 1, label: 'NOSE', color: '#22d3ee' },
  { index: 61, label: 'M-L', color: '#93c5fd' },
  { index: 291, label: 'M-R', color: '#93c5fd' },
  { index: 152, label: 'CHIN', color: '#67e8f9' },
]

function normalizeWord(word) {
  return word.trim().toLowerCase()
}

function formatSpelledWord(word) {
  return word ? word.split('').join(' ') : '...'
}

function formatQualityReason(reason) {
  switch (reason) {
    case 'mano_recortada':
      return 'mano recortada por el borde'
    case 'mano_pequena':
      return 'mano muy pequena / lejos'
    case 'poco_ancho':
      return 'mano muy angosta'
    case 'poco_alto':
      return 'mano muy baja de altura'
    case 'landmarks_inestables':
      return 'landmarks inestables'
    case 'sin_landmarks':
      return 'sin landmarks'
    default:
      return reason
  }
}

function formatQualityStatus(status) {
  if (status === 'good') return 'verde'
  if (status === 'fair') return 'amarillo'
  return 'rojo'
}

function formatTopCandidates(candidates = []) {
  if (!candidates.length) return '—'

  return candidates
    .slice(0, 3)
    .map((candidate) => `${candidate.letter}:${candidate.confidence.toFixed(2)}`)
    .join(' ')
}

function shortDirection(direction) {
  if (direction === 'horizontal') return 'h'
  if (direction === 'up') return 'u'
  if (direction === 'down') return 'd'
  return '—'
}

function formatDirectionMap(directionMap) {
  if (!directionMap) return '—'

  return ['T', 'I', 'M', 'R', 'P']
    .map((key) => `${key}:${shortDirection(directionMap[key])}`)
    .join(' ')
}

function formatVector2(vector) {
  if (!vector) return '(—, —)'
  return `(${vector.x.toFixed(2)},${vector.y.toFixed(2)})`
}

function formatVector3(vector) {
  if (!vector) return '(—, —, —)'
  return `(${vector.x.toFixed(2)},${vector.y.toFixed(2)},${vector.z.toFixed(2)})`
}

function inferMirrorPreview(track) {
  if (!track) return false

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
  return requestCameraStream({ preferredFacingMode: 'environment' })
}

function clearDebugCanvas(canvas) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
}

function detectStandaloneMode() {
  if (typeof window === 'undefined') return false

  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

function createSilentWavBlob(durationMs = 80, sampleRate = 8000) {
  const sampleCount = Math.max(1, Math.ceil((sampleRate * durationMs) / 1000))
  const buffer = new ArrayBuffer(44 + sampleCount)
  const view = new DataView(buffer)

  function writeString(offset, value) {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + sampleCount, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate, true)
  view.setUint16(32, 1, true)
  view.setUint16(34, 8, true)
  writeString(36, 'data')
  view.setUint32(40, sampleCount, true)

  for (let index = 0; index < sampleCount; index += 1) {
    view.setUint8(44 + index, 128)
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

function createCanvasProjection(canvas, video) {
  const width = canvas.offsetWidth
  const height = canvas.offsetHeight
  const dpr = window.devicePixelRatio || 1

  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)

  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  const sourceWidth = video?.videoWidth || width
  const sourceHeight = video?.videoHeight || height
  // Igual que en Entrenamiento: no recortamos el video para que
  // el preview corresponda al encuadre real que ve MediaPipe.
  const scale = Math.min(width / sourceWidth, height / sourceHeight)
  const renderWidth = sourceWidth * scale
  const renderHeight = sourceHeight * scale
  const offsetX = (width - renderWidth) / 2
  const offsetY = (height - renderHeight) / 2

  return {
    ctx,
    width,
    height,
    renderWidth,
    renderHeight,
    offsetX,
    offsetY,
  }
}

function toCanvasPoint(point, projection) {
  return {
    x: projection.offsetX + (point.x * projection.renderWidth),
    y: projection.offsetY + (point.y * projection.renderHeight),
  }
}

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

function drawArrow(ctx, from, to, color, label = '') {
  const headLength = 10
  const angle = Math.atan2(to.y - from.y, to.x - from.x)

  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(
    to.x - headLength * Math.cos(angle - Math.PI / 6),
    to.y - headLength * Math.sin(angle - Math.PI / 6)
  )
  ctx.lineTo(
    to.x - headLength * Math.cos(angle + Math.PI / 6),
    to.y - headLength * Math.sin(angle + Math.PI / 6)
  )
  ctx.closePath()
  ctx.fill()

  if (label) {
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.fillStyle = color
    ctx.fillText(label, to.x + 6, to.y - 6)
  }
}

function getHandQualityStroke(handQuality) {
  if (!handQuality) {
    return {
      stroke: 'rgba(239, 68, 68, 0.95)',
      fill: 'rgba(239, 68, 68, 0.06)',
    }
  }

  if (handQuality.status === 'good') {
    return {
      stroke: 'rgba(34, 197, 94, 0.95)',
      fill: 'rgba(34, 197, 94, 0.08)',
    }
  }

  if (handQuality.status === 'fair') {
    return {
      stroke: 'rgba(245, 158, 11, 0.95)',
      fill: 'rgba(245, 158, 11, 0.08)',
    }
  }

  return {
    stroke: 'rgba(239, 68, 68, 0.95)',
    fill: 'rgba(239, 68, 68, 0.08)',
  }
}

function drawFaceDebug(ctx, projection, faceLandmarks, faceAnchor) {
  if (!faceLandmarks?.length && !faceAnchor) return

  if (faceAnchor) {
    const leftTop = toCanvasPoint({ x: faceAnchor.left, y: faceAnchor.top }, projection)
    const rightBottom = toCanvasPoint({ x: faceAnchor.right, y: faceAnchor.bottom }, projection)
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.95)'
    ctx.fillStyle = 'rgba(34, 211, 238, 0.06)'
    ctx.lineWidth = 2
    ctx.fillRect(
      leftTop.x,
      leftTop.y,
      rightBottom.x - leftTop.x,
      rightBottom.y - leftTop.y
    )
    ctx.strokeRect(
      leftTop.x,
      leftTop.y,
      rightBottom.x - leftTop.x,
      rightBottom.y - leftTop.y
    )

    const center = toCanvasPoint(faceAnchor.center, projection)
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.95)'
    ctx.beginPath()
    ctx.moveTo(center.x - 10, center.y)
    ctx.lineTo(center.x + 10, center.y)
    ctx.moveTo(center.x, center.y - 10)
    ctx.lineTo(center.x, center.y + 10)
    ctx.stroke()
  }

  if (!faceLandmarks?.length) return

  ctx.fillStyle = 'rgba(56, 189, 248, 0.22)'
  for (let index = 0; index < faceLandmarks.length; index += 12) {
    const projected = toCanvasPoint(faceLandmarks[index], projection)
    ctx.beginPath()
    ctx.arc(projected.x, projected.y, 1.8, 0, Math.PI * 2)
    ctx.fill()
  }

  for (const keypoint of FACE_DEBUG_KEYPOINTS) {
    const point = faceLandmarks[keypoint.index]
    if (!point) continue

    const projected = toCanvasPoint(point, projection)
    ctx.fillStyle = keypoint.color
    ctx.beginPath()
    ctx.arc(projected.x, projected.y, 4.5, 0, Math.PI * 2)
    ctx.fill()

    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.fillText(keypoint.label, projected.x + 6, projected.y - 4)
  }
}

function drawHandAxes(ctx, projection, rawPalmCenter, handMetrics) {
  const screenAxes = handMetrics?.orientation?.axes?.screen
  if (!screenAxes?.x || !screenAxes?.y) return

  const palmCenter = toCanvasPoint(rawPalmCenter, projection)
  const axisLength = 56

  drawArrow(
    ctx,
    palmCenter,
    {
      x: palmCenter.x + (screenAxes.x.x * axisLength),
      y: palmCenter.y + (screenAxes.x.y * axisLength),
    },
    '#f97316',
    'X'
  )

  drawArrow(
    ctx,
    palmCenter,
    {
      x: palmCenter.x + (screenAxes.y.x * axisLength),
      y: palmCenter.y + (screenAxes.y.y * axisLength),
    },
    '#22d3ee',
    'Y'
  )

  const palmNormal = handMetrics?.orientation?.palmNormal
  if (palmNormal) {
    drawArrow(
      ctx,
      palmCenter,
      {
        x: palmCenter.x + (palmNormal.x * 34),
        y: palmCenter.y + (palmNormal.y * 34),
      },
      '#e879f9',
      `N z:${palmNormal.z.toFixed(2)}`
    )
  }
}

function drawDebugOverlay(canvas, video, debugFrame, showDebug) {
  if (!canvas) return

  const projection = createCanvasProjection(canvas, video)
  const { ctx } = projection
  if (!showDebug || !debugFrame?.landmarks) return

  const { landmarks, frameMeta = {}, handMetrics, handQuality, gestureDebug, staticPose } = debugFrame
  const rawPalmCenter = getPalmCenter(landmarks)

  drawFaceDebug(ctx, projection, frameMeta.faceLandmarks, frameMeta.faceAnchor)

  if (gestureDebug?.currentFrame?.headZone) {
    const zone = gestureDebug.currentFrame.headZone
    const leftTop = toCanvasPoint({ x: zone.left, y: zone.top }, projection)
    const rightBottom = toCanvasPoint({ x: zone.right, y: zone.bottom }, projection)
    ctx.strokeStyle = 'rgba(14, 165, 233, 0.95)'
    ctx.lineWidth = 2
    ctx.setLineDash([8, 6])
    ctx.strokeRect(
      leftTop.x,
      leftTop.y,
      rightBottom.x - leftTop.x,
      rightBottom.y - leftTop.y
    )
    ctx.setLineDash([])
  }

  if (handQuality?.bbox) {
    const bbox = handQuality.bbox
    const leftTop = toCanvasPoint({ x: bbox.minX, y: bbox.minY }, projection)
    const rightBottom = toCanvasPoint({ x: bbox.maxX, y: bbox.maxY }, projection)
    const qualityStroke = getHandQualityStroke(handQuality)
    ctx.strokeStyle = qualityStroke.stroke
    ctx.fillStyle = qualityStroke.fill
    ctx.lineWidth = 2
    ctx.fillRect(
      leftTop.x,
      leftTop.y,
      rightBottom.x - leftTop.x,
      rightBottom.y - leftTop.y
    )
    ctx.strokeRect(
      leftTop.x,
      leftTop.y,
      rightBottom.x - leftTop.x,
      rightBottom.y - leftTop.y
    )
  }

  ctx.strokeStyle = 'rgba(34, 197, 94, 0.75)'
  ctx.lineWidth = 2
  for (const [fromIndex, toIndex] of HAND_CONNECTIONS) {
    const from = toCanvasPoint(landmarks[fromIndex], projection)
    const to = toCanvasPoint(landmarks[toIndex], projection)
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
  }

  landmarks.forEach((point, index) => {
    const projected = toCanvasPoint(point, projection)
    ctx.fillStyle = index === 0 ? '#f97316' : '#f8fafc'
    ctx.beginPath()
    ctx.arc(projected.x, projected.y, index === 0 ? 5 : 4, 0, Math.PI * 2)
    ctx.fill()

    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.fillStyle = '#facc15'
    ctx.fillText(String(index), projected.x + 6, projected.y - 4)
  })

  const vectorSpecs = [
    { mcp: 2, tip: 4, label: 'T', color: '#f59e0b' },
    { mcp: 5, tip: 8, label: 'I', color: '#22c55e' },
    { mcp: 9, tip: 12, label: 'M', color: '#38bdf8' },
    { mcp: 13, tip: 16, label: 'R', color: '#a855f7' },
    { mcp: 17, tip: 20, label: 'P', color: '#fb7185' },
  ]

  for (const vectorSpec of vectorSpecs) {
    const from = toCanvasPoint(landmarks[vectorSpec.mcp], projection)
    const to = toCanvasPoint(landmarks[vectorSpec.tip], projection)
    drawArrow(ctx, from, to, vectorSpec.color, vectorSpec.label)
  }

  if (handMetrics) {
    const palmCenter = toCanvasPoint(rawPalmCenter, projection)
    ctx.fillStyle = '#06b6d4'
    ctx.beginPath()
    ctx.arc(palmCenter.x, palmCenter.y, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.fillText('PALM', palmCenter.x + 8, palmCenter.y + 4)
    drawHandAxes(ctx, projection, rawPalmCenter, handMetrics)
  }

  if (gestureDebug?.currentFrame?.palmCenter) {
    const gesturePalm = toCanvasPoint(gestureDebug.currentFrame.palmCenter, projection)
    ctx.fillStyle = gestureDebug.currentFrame.nearHead ? '#22c55e' : '#ef4444'
    ctx.beginPath()
    ctx.arc(gesturePalm.x, gesturePalm.y, 7, 0, Math.PI * 2)
    ctx.fill()
  }

  if (staticPose?.stable && staticPose.palmCenter) {
    const posePalm = toCanvasPoint(staticPose.palmCenter, projection)
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.95)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(posePalm.x, posePalm.y, 11, 0, Math.PI * 2)
    ctx.stroke()
  }
}

export default function TranslatorPage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const streamRef = useRef(null)
  const debugCanvasRef = useRef(null)
  const smootherRef = useRef(createSmoother(8))
  const gestureRecognizerRef = useRef(createGestureSequenceRecognizer())
  const staticPoseHistoryRef = useRef([])
  const lastDebugUiUpdateRef = useRef(0)

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
  const audioUnlockedRef = useRef(false)

  const [isCompactViewport, setIsCompactViewport] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  ))
  const [isStandaloneMode, setIsStandaloneMode] = useState(() => detectStandaloneMode())
  const [shouldMirrorPreview, setShouldMirrorPreview] = useState(false)
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
  const [lastDecodedWord, setLastDecodedWord] = useState(null)
  const [currentDetectionType, setCurrentDetectionType] = useState('letter')
  const [lastGestureWord, setLastGestureWord] = useState('')
  const [showDebug, setShowDebug] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  ))
  const [debugSnapshot, setDebugSnapshot] = useState(null)
  const requiredStabilityFrames = isCompactViewport ? 6 : LETTER_STABILITY_FRAMES

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

  const updateDetectionDisplay = useCallback((letter, confidence, type = 'letter') => {
    if (displayLetterRef.current !== letter) {
      displayLetterRef.current = letter
      setCurrentLetter(letter)
    }

    setCurrentDetectionType(type)

    if (
      confidence === 0 ||
      Math.abs(displayConfidenceRef.current - confidence) >= 0.03
    ) {
      displayConfidenceRef.current = confidence
      setCurrentConfidence(confidence)
    }
  }, [])

  const updateDebugVisuals = useCallback((debugFrame) => {
    drawDebugOverlay(debugCanvasRef.current, videoRef.current, debugFrame, showDebug)

    const now = Date.now()
    if (now - lastDebugUiUpdateRef.current < DEBUG_UI_THROTTLE_MS) return

    lastDebugUiUpdateRef.current = now

    setDebugSnapshot({
      gestureDebug: debugFrame.gestureState?.debug ?? null,
      rawPrediction: debugFrame.rawPrediction ?? null,
      smoothedPrediction: debugFrame.smoothedPrediction ?? null,
      resolvedPrediction: debugFrame.prediction ?? null,
      currentDetectionType: debugFrame.gestureState?.gesture ? 'gesture' : (debugFrame.prediction ? 'letter' : 'none'),
      fingerDebugString: debugFrame.fingerDebugString ?? null,
      fingerFlags: {
        thumb: debugFrame.handMetrics?.fingers?.thumb?.extended ?? false,
        index: debugFrame.handMetrics?.fingers?.index?.extended ?? false,
        middle: debugFrame.handMetrics?.fingers?.middle?.extended ?? false,
        ring: debugFrame.handMetrics?.fingers?.ring?.extended ?? false,
        pinky: debugFrame.handMetrics?.fingers?.pinky?.extended ?? false,
      },
      pairMetrics: debugFrame.handMetrics?.pairs?.indexMiddle ?? null,
      classification: debugFrame.handMetrics?.classification ?? null,
      featureState: debugFrame.handMetrics?.features
        ? {
            gapIM: debugFrame.handMetrics.features.gap_IM,
            crossedIM: debugFrame.handMetrics.features.crossed_IM,
            thumbRole: debugFrame.handMetrics.features.thumb_role,
            palmOrientation: debugFrame.handMetrics.features.palm_orientation,
          }
        : null,
      directionState: {
        camera: debugFrame.handMetrics?.directions?.camera ?? null,
        local: debugFrame.handMetrics?.directions?.local ?? null,
        palmNormal: debugFrame.handMetrics?.orientation?.palmNormal ?? null,
        palmOrientation: debugFrame.handMetrics?.orientation?.palmOrientation ?? null,
        screenAxes: debugFrame.handMetrics?.orientation?.axes?.screen ?? null,
      },
      palmCenter: debugFrame.handMetrics?.posture?.palmCenter ?? null,
      handQuality: debugFrame.handQuality ?? null,
      staticPose: debugFrame.staticPose ?? null,
      handedness: debugFrame.handedness ?? 'unknown',
    })
  }, [showDebug])

  const resetPredictionState = useCallback(() => {
    smootherRef.current.reset()
    gestureRecognizerRef.current.reset()
    staticPoseHistoryRef.current = []
    candidateLetterRef.current = null
    candidateFramesRef.current = 0
    appendLockRef.current = null
    updateDetectionDisplay(null, 0, 'letter')
    setHandPresence(false)
    setDebugSnapshot(null)
    clearDebugCanvas(debugCanvasRef.current)
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

  const unlockAudioPlayback = useCallback(async () => {
    if (audioUnlockedRef.current) return true

    try {
      const silentBlob = createSilentWavBlob()
      const url = URL.createObjectURL(silentBlob)
      const audio = new Audio(url)
      audio.playsInline = true
      await audio.play()
      audio.pause()
      audio.currentTime = 0
      URL.revokeObjectURL(url)
      audioUnlockedRef.current = true
      return true
    } catch (error) {
      console.warn('[Translator Audio] No se pudo desbloquear audio en este contexto:', error)
      return false
    }
  }, [])

  const playAudioBlob = useCallback(async (url, generation) => {
    await new Promise((resolve, reject) => {
      if (generation !== audioGenerationRef.current) {
        resolve()
        return
      }

      const audio = new Audio(url)
      audio.playsInline = true
      audio.preload = 'auto'
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
        const rawMessage = error.message || 'No se pudo generar el audio.'
        const friendlyMessage = /not allowed|user agent|platform/i.test(rawMessage)
          ? 'Safari bloqueo el audio automatico. Toca pausar e iniciar traduccion una vez para habilitarlo.'
          : rawMessage
        setTtsError(friendlyMessage)
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

  const pushRecognizedWord = useCallback((recognizedWord, metadata = null) => {
    if (!recognizedWord) return null

    setPhraseWords((prev) => [...prev, recognizedWord])
    setLastDecodedWord(metadata)
    enqueueSpeech(recognizedWord)
    return recognizedWord
  }, [enqueueSpeech, setPhraseWords])

  const commitWord = useCallback(() => {
    const rawWord = wordBufferRef.current.trim()
    if (!rawWord) return null

    // La palabra final no sale directo del buffer:
    // primero la pasamos por la capa de decodificacion para corregir ruido.
    const decodedWord = decodeFingerSpelling(rawWord)
    const committedWord = decodedWord.corrected || normalizeWord(rawWord)

    setWordBuffer('')
    return pushRecognizedWord(committedWord, decodedWord)
  }, [pushRecognizedWord, setWordBuffer])

  const commitGesture = useCallback((gesture) => {
    if (!gesture?.word) return null

    setWordBuffer('')
    setLastGestureWord(gesture.word)
    candidateLetterRef.current = null
    candidateFramesRef.current = 0
    appendLockRef.current = null

    return pushRecognizedWord(gesture.word, {
      raw: gesture.word,
      normalized: gesture.word,
      corrected: gesture.word,
      changed: false,
      confidence: gesture.confidence,
      reason: 'dynamic_gesture',
    })
  }, [pushRecognizedWord, setWordBuffer])

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

  const handleLandmarks = useCallback((landmarks, frameMeta = {}) => {
    const now = Date.now()
    const handedness = getHandednessLabel(frameMeta.handedness)
    const handMetrics = extractHandMetrics(landmarks, { handedness, worldLandmarks: frameMeta.handWorldLandmarks })
    const handQuality = assessHandDetectionQuality(landmarks)
    const staticPose = pushStaticPoseSample(staticPoseHistoryRef, landmarks, now)
    const enrichedFrameMeta = {
      ...frameMeta,
      handQuality,
      staticPose,
      handedness,
    }
    const gestureState = gestureRecognizerRef.current.push(landmarks, enrichedFrameMeta, now)

    let rawPrediction = null
    if (handQuality.reliable && staticPose.stable && !gestureState.suppressStatic) {
      const bestCandidate = handMetrics?.classification?.bestCandidate ?? null
      const basePrediction = bestCandidate
        ? {
            letter: bestCandidate.letter,
            confidence: bestCandidate.confidence,
            candidates: handMetrics.classification.topCandidates,
            classifierDebug: handMetrics.classification,
            secondCandidateFailure: handMetrics.classification.topCandidates[1]?.failedRule ?? null,
          }
        : null
      if (basePrediction) {
        const adjustedConfidence = basePrediction.confidence
        if (adjustedConfidence >= MIN_STATIC_CONFIDENCE) {
          rawPrediction = {
            ...basePrediction,
            confidence: adjustedConfidence,
          }
        }
      }
    }

    const smoothedPrediction = rawPrediction
      ? smootherRef.current.push(rawPrediction)
      : (smootherRef.current.reset(), null)
    const prediction = smoothedPrediction || rawPrediction

    updateDebugVisuals({
      landmarks,
      frameMeta: enrichedFrameMeta,
      handMetrics,
      handQuality,
      staticPose,
      handedness,
      fingerDebugString: debugFingers(landmarks, { handedness }),
      gestureState,
      rawPrediction,
      smoothedPrediction,
      prediction,
    })

    lastHandSeenAtRef.current = now
    wordPauseHandledRef.current = false
    phrasePauseHandledRef.current = false
    setHandPresence(true)

    if (gestureState.gesture) {
      updateDetectionDisplay(gestureState.gesture.word.toUpperCase(), gestureState.gesture.confidence, 'gesture')
      commitGesture(gestureState.gesture)
      return
    }

    if (gestureState.suppressStatic || !handQuality.reliable || !staticPose.stable) {
      smootherRef.current.reset()
      candidateLetterRef.current = null
      candidateFramesRef.current = 0
      updateDetectionDisplay(null, 0, gestureState.suppressStatic ? 'gesture' : 'letter')
      return
    }

    if (!prediction) {
      candidateLetterRef.current = null
      candidateFramesRef.current = 0
      updateDetectionDisplay(null, 0, 'letter')
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

    const frameConfidence = Math.min(stabilityFrames / requiredStabilityFrames, 1)
    const confidence = Math.max(prediction.confidence ?? 0, frameConfidence)

    updateDetectionDisplay(prediction.letter, confidence, 'letter')

    if (stabilityFrames >= requiredStabilityFrames) {
      appendLetter(prediction.letter)
    }
  }, [appendLetter, commitGesture, requiredStabilityFrames, setHandPresence, updateDebugVisuals, updateDetectionDisplay])

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
    setShouldMirrorPreview(false)
  }, [videoRef])

  useEffect(() => {
    return () => {
      stopCameraStream()
      clearAudioQueue()
    }
  }, [clearAudioQueue, stopCameraStream])

  useEffect(() => {
    function syncViewportMode() {
      const compact = window.innerWidth < 768
      setIsCompactViewport(compact)
      setIsStandaloneMode(detectStandaloneMode())
    }

    syncViewportMode()
    window.addEventListener('resize', syncViewportMode)
    return () => window.removeEventListener('resize', syncViewportMode)
  }, [])

  useEffect(() => {
    hydrateTemplatesFromServer().catch((error) => {
      console.warn('[Translator] No se pudo hidratar dataset desde MongoDB; se usará cache local.', error)
    })
  }, [])

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
        const videoTrack = stream.getVideoTracks?.()[0] ?? null
        setShouldMirrorPreview(inferMirrorPreview(videoTrack))

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
    if (showDebug) return
    clearDebugCanvas(debugCanvasRef.current)
  }, [showDebug])

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

  const toggleTranslation = useCallback(async () => {
    if (!isActive) {
      setTtsError('')
      await unlockAudioPlayback()
    }

    setIsActive((prev) => !prev)
  }, [isActive, unlockAudioPlayback])

  const recentLines = subtitleLines.slice(-3)
  const liveDecodedWord = wordBuffer ? decodeFingerSpelling(wordBuffer) : null
  const liveWordPreview = liveDecodedWord?.corrected || (wordBuffer ? normalizeWord(wordBuffer) : '')
  const liveSubtitle = [...phraseWords, liveWordPreview]
    .filter(Boolean)
    .join(' ')
  const detectionHeading = currentDetectionType === 'gesture' ? t('translator.gesture_detected') : t('translator.letter_detected')
  const gestureDebug = debugSnapshot?.gestureDebug
  const currentGestureFrame = gestureDebug?.currentFrame
  const mobileBottomOffset = isCompactViewport
    ? (isStandaloneMode ? '1rem' : '5.5rem')
    : '1rem'

  const statusLabel = detectionError
    ? t('translator.status_error')
    : !ready
      ? t('translator.status_loading')
      : !isActive
        ? t('translator.status_paused')
        : cameraReady && handPresent
          ? t('translator.status_detecting')
          : cameraReady
            ? t('translator.status_waiting')
            : t('translator.status_camera')

  return (
    <section className="relative h-full min-h-[100dvh] overflow-hidden bg-zinc-950">
      {/* Camera feed */}
      <video
        ref={videoRef}
        className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-500 ${
          cameraReady ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ transform: shouldMirrorPreview ? 'scaleX(-1)' : 'none' }}
        muted
        playsInline
        autoPlay
        disablePictureInPicture
      />

      {/* Debug canvas */}
      <canvas
        ref={debugCanvasRef}
        className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-200 ${
          showDebug ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ transform: shouldMirrorPreview ? 'scaleX(-1)' : 'none' }}
      />

      {/* Gradient vignette with brand tint */}
      <div className="absolute inset-0 bg-gradient-to-b from-brand-950/80 via-transparent to-zinc-950/90" />

      {/* Loading state */}
      {isActive && !cameraReady && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-br from-zinc-950 via-brand-950/40 to-zinc-950">
          <div className="max-w-sm px-6 text-center">
            <div className="mx-auto mb-6 h-16 w-16 rounded-2xl border-2 border-brand-400 border-t-transparent animate-spin" />
            <h1 className="mb-2 text-3xl font-bold tracking-tight text-white">{t('translator.loading_title')}</h1>
            <p className="text-sm leading-relaxed text-brand-200/70">
              {t('translator.loading_desc')}
            </p>
          </div>
        </div>
      )}

      {/* Idle state — hero card */}
      {!isActive && (
        <div className="absolute inset-x-0 top-1/2 z-[5] px-4 -translate-y-1/2 sm:px-6">
          <div className="mx-auto max-w-sm overflow-hidden rounded-2xl border border-brand-500/30 bg-gradient-to-b from-brand-950/60 to-zinc-900/70 px-5 py-6 text-center shadow-2xl shadow-brand-500/10 backdrop-blur-2xl sm:max-w-md sm:rounded-3xl sm:p-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/20 text-2xl ring-1 ring-brand-400/30 sm:mb-5 sm:h-16 sm:w-16 sm:text-3xl">
              🤟
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{t('translator.idle_title')}</h1>
            <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-zinc-300 sm:mt-3 sm:text-sm">
              {t('translator.idle_desc')}
            </p>
            <button
              type="button"
              onClick={toggleTranslation}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 active:scale-95 touch-manipulation sm:mt-6 sm:px-8 sm:py-3"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" /></svg>
              {t('translator.start_translation')}
            </button>
          </div>
        </div>
      )}

      {/* ─── Top detection HUD ─── */}
      <div
        className="absolute inset-x-0 top-0 z-10 px-3 sm:px-4"
        style={{ paddingTop: `calc(env(safe-area-inset-top, 0px) + ${isCompactViewport ? '0.75rem' : '1rem'})` }}
      >
        <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-brand-500/25 bg-gradient-to-r from-brand-950/70 via-zinc-900/60 to-brand-950/70 px-3 py-2.5 shadow-xl shadow-brand-500/5 backdrop-blur-2xl sm:rounded-3xl sm:p-4">
          {/* Main detection row */}
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-brand-300 sm:text-[10px]">{detectionHeading}</p>
              <div className="mt-1 flex items-end gap-2 sm:mt-1.5 sm:gap-3">
                <span className="bg-gradient-to-b from-white to-brand-100 bg-clip-text text-4xl font-black leading-none text-transparent sm:text-7xl">
                  {currentLetter || '—'}
                </span>
                <span className="mb-0.5 rounded-md bg-white/10 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-zinc-200 sm:mb-2 sm:rounded-lg sm:px-2 sm:text-sm">
                  {Math.round(currentConfidence * 100)}%
                </span>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${
                isActive && cameraReady && handPresent
                  ? 'bg-accent-500/20 text-accent-300 ring-1 ring-accent-400/30'
                  : isActive
                    ? 'bg-brand-500/20 text-brand-200 ring-1 ring-brand-400/20'
                    : 'bg-white/10 text-zinc-300 ring-1 ring-white/10'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${
                  isActive && cameraReady && handPresent ? 'bg-accent-400 animate-pulse' : isActive ? 'bg-brand-400' : 'bg-zinc-500'
                }`} />
                {statusLabel}
              </span>

              {cameraReady && (
                <span className="rounded-full bg-white/8 px-2.5 py-0.5 text-[10px] font-medium text-zinc-400">
                  {shouldMirrorPreview ? t('translator.mirror_view') : t('translator.normal_view')}
                </span>
              )}

              {(audioStatus !== 'idle' || queueSize > 0) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-500/15 px-2.5 py-0.5 text-[10px] font-medium text-accent-300 ring-1 ring-accent-400/20">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" /></svg>
                  {audioStatus === 'fetching'
                    ? t('translator.audio_fetching')
                    : audioStatus === 'playing'
                      ? t('translator.audio_playing')
                      : t('translator.audio_queued')}
                  {queueSize > 0 ? ` · ${queueSize}` : ''}
                </span>
              )}
            </div>
          </div>

          {/* Confidence bar */}
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{
                width: `${Math.max(currentConfidence * 100, currentLetter ? 8 : 0)}%`,
                background:
                  currentConfidence > 0.85
                    ? 'linear-gradient(90deg, #34d399 0%, #10b981 100%)'
                    : currentConfidence > 0.6
                      ? 'linear-gradient(90deg, #a78bfa 0%, #7c3aed 100%)'
                      : 'linear-gradient(90deg, #fb7185 0%, #ef4444 100%)',
              }}
            />
          </div>

          {/* Metadata pills */}
          <div className="mt-2 flex flex-wrap items-center gap-1 text-[9px] text-zinc-400 sm:mt-2.5 sm:gap-1.5 sm:text-[11px]">
            <span className="rounded-full bg-white/5 px-2 py-0.5 sm:px-2.5">
              {t('translator.stable_letter')}: {requiredStabilityFrames}f
            </span>
            <span className="rounded-full bg-white/5 px-2 py-0.5 sm:px-2.5">
              {t('translator.word_pause')}: {WORD_PAUSE_MS}ms
            </span>
            <span className="hidden rounded-full bg-white/5 px-2.5 py-0.5 sm:inline">
              {t('translator.phrase_pause')}: {PHRASE_PAUSE_MS}ms
            </span>
            <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-brand-300 sm:px-2.5">
              {SIGN_LANGUAGE_PROFILE.code}
            </span>
            <span className="rounded-full bg-accent-500/10 px-2 py-0.5 text-accent-300 sm:px-2.5">
              {t('translator.spelling_gestures')}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Debug panels (unchanged logic, brand-tinted borders) ─── */}
      {showDebug && debugSnapshot && (
        isCompactViewport ? (
          <div
            className="absolute inset-x-3 z-10 max-h-[24dvh] overflow-y-auto rounded-2xl border border-brand-400/20 bg-zinc-900/80 p-3 backdrop-blur-2xl"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 7rem)' }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-brand-300">Debug</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] text-zinc-300">
              <span className="rounded-lg bg-white/5 px-2.5 py-1.5">Tipo: {debugSnapshot.currentDetectionType}</span>
              <span className="rounded-lg bg-white/5 px-2.5 py-1.5">Final: {debugSnapshot.resolvedPrediction?.letter ?? '—'}</span>
              <span className="rounded-lg bg-white/5 px-2.5 py-1.5">Calidad: {debugSnapshot.handQuality?.qualityScore?.toFixed(2) ?? '—'}</span>
              <span className="rounded-lg bg-white/5 px-2.5 py-1.5">Caja: {formatQualityStatus(debugSnapshot.handQuality?.status)}</span>
            </div>
            <div className="mt-2 space-y-1 rounded-xl bg-white/5 p-2.5 font-mono text-[10px] text-zinc-300">
              <p>mano:{debugSnapshot.handedness}</p>
              <p>stable:{debugSnapshot.staticPose?.stable ? '1' : '0'} usable:{debugSnapshot.handQuality?.reliable ? '1' : '0'}</p>
              <p>move:{debugSnapshot.staticPose?.travel?.toFixed(3) ?? '—'} rx:{debugSnapshot.staticPose?.rangeX?.toFixed(3) ?? '—'} ry:{debugSnapshot.staticPose?.rangeY?.toFixed(3) ?? '—'}</p>
              <p>motivo:{debugSnapshot.handQuality?.reasons?.length ? debugSnapshot.handQuality.reasons.map(formatQualityReason).join(', ') : 'ok'}</p>
              <p>estado:{debugSnapshot.fingerDebugString ?? '—'}</p>
              <p>cam:{formatDirectionMap(debugSnapshot.directionState?.camera)}</p>
              <p>loc:{formatDirectionMap(debugSnapshot.directionState?.local)}</p>
              <p>palm:{debugSnapshot.directionState?.palmOrientation ?? '—'} n:{formatVector3(debugSnapshot.directionState?.palmNormal)}</p>
              <p>top3:{formatTopCandidates(debugSnapshot.classification?.topCandidates)}</p>
              <p>gap_IM:{debugSnapshot.featureState?.gapIM?.toFixed(2) ?? '—'} crossed:{debugSnapshot.featureState?.crossedIM ? '1' : '0'} thumb:{debugSnapshot.featureState?.thumbRole ?? '—'}</p>
              <p>2o fallo:{debugSnapshot.classification?.topCandidates?.[1]?.failedRule ?? '—'}</p>
              <p>hola head:{currentGestureFrame?.nearHead ? '1' : '0'} 2F:{currentGestureFrame?.twoFingerHandshape ? '1' : '0'} palm:{currentGestureFrame?.palmFacingCamera ? '1' : '0'}</p>
            </div>
          </div>
        ) : (
          <div
            className="absolute left-3 right-3 z-10 max-h-[40dvh] overflow-y-auto rounded-2xl border border-brand-400/20 bg-zinc-900/75 p-3 backdrop-blur-2xl md:left-4 md:right-auto md:w-[min(22rem,calc(100vw-2rem))] md:p-4"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 9.25rem)' }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-brand-300">Debug Mapper</p>
            <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px] text-zinc-300">
              <span className="rounded-lg bg-white/5 px-2.5 py-1.5">Tipo: {debugSnapshot.currentDetectionType}</span>
              <span className="rounded-lg bg-white/5 px-2.5 py-1.5">Raw: {debugSnapshot.rawPrediction?.letter ?? '—'}</span>
              <span className="rounded-lg bg-white/5 px-2.5 py-1.5">Smooth: {debugSnapshot.smoothedPrediction?.letter ?? '—'}</span>
              <span className="rounded-lg bg-white/5 px-2.5 py-1.5">Final: {debugSnapshot.resolvedPrediction?.letter ?? '—'}</span>
            </div>

            <div className="mt-3 rounded-xl bg-white/5 p-3 text-[11px] text-zinc-300">
              <p className="font-semibold text-brand-200">Calidad mano</p>
              <div className="mt-2 space-y-1 font-mono">
                <p>reliable:{debugSnapshot.handQuality?.reliable ? '1' : '0'} status:{debugSnapshot.handQuality?.status ?? '—'} score:{debugSnapshot.handQuality?.qualityScore?.toFixed(3) ?? '—'}</p>
                <p>edges:{debugSnapshot.handQuality?.edgeTouches ?? '—'} area:{debugSnapshot.handQuality?.area?.toFixed(3) ?? '—'}</p>
                <p>stablePose:{debugSnapshot.staticPose?.stable ? '1' : '0'} frames:{debugSnapshot.staticPose?.sampleCount ?? 0}</p>
                <p>move:{debugSnapshot.staticPose?.travel?.toFixed(3) ?? '—'} rx:{debugSnapshot.staticPose?.rangeX?.toFixed(3) ?? '—'} ry:{debugSnapshot.staticPose?.rangeY?.toFixed(3) ?? '—'}</p>
                <p>caja: verde=usable amarillo=marginal rojo=mala calidad</p>
                <p>motivo: {debugSnapshot.handQuality?.reasons?.length ? debugSnapshot.handQuality.reasons.map(formatQualityReason).join(', ') : 'ok'}</p>
              </div>
            </div>

            <div className="mt-3 rounded-xl bg-white/5 p-3 text-[11px] text-zinc-300">
              <p className="font-semibold text-brand-200">Dedos extendidos</p>
              <p className="mt-2 font-mono">
                T:{debugSnapshot.fingerFlags?.thumb ? '1' : '0'} I:{debugSnapshot.fingerFlags?.index ? '1' : '0'} M:{debugSnapshot.fingerFlags?.middle ? '1' : '0'} R:{debugSnapshot.fingerFlags?.ring ? '1' : '0'} P:{debugSnapshot.fingerFlags?.pinky ? '1' : '0'}
              </p>
              <p className="mt-2 font-mono">
                {debugSnapshot.fingerDebugString ?? 'T:- I:- M:- R:- P:- gap:-'}
              </p>
              <p className="mt-2 font-mono">
                gap:{debugSnapshot.pairMetrics?.gap?.toFixed(3) ?? '—'} horiz:{debugSnapshot.pairMetrics?.horizontal ? '1' : '0'} vert:{debugSnapshot.pairMetrics?.vertical ? '1' : '0'}
              </p>
              <p className="mt-2 font-mono">
                top3:{formatTopCandidates(debugSnapshot.classification?.topCandidates)}
              </p>
              <p className="mt-2 font-mono">
                gap_IM:{debugSnapshot.featureState?.gapIM?.toFixed(3) ?? '—'} crossed_IM:{debugSnapshot.featureState?.crossedIM ? '1' : '0'} thumb_role:{debugSnapshot.featureState?.thumbRole ?? '—'} palm:{debugSnapshot.featureState?.palmOrientation ?? '—'}
              </p>
              <p className="mt-2 font-mono text-amber-300">
                2o fallo:{debugSnapshot.classification?.topCandidates?.[1]?.failedRule ?? '—'}
              </p>
            </div>

            <div className="mt-3 rounded-xl bg-white/5 p-3 text-[11px] text-zinc-300">
              <p className="font-semibold text-brand-200">Ejes / orientacion</p>
              <div className="mt-2 space-y-1 font-mono">
                <p>camDir:{formatDirectionMap(debugSnapshot.directionState?.camera)}</p>
                <p>locDir:{formatDirectionMap(debugSnapshot.directionState?.local)}</p>
                <p>axisX:{formatVector2(debugSnapshot.directionState?.screenAxes?.x)} axisY:{formatVector2(debugSnapshot.directionState?.screenAxes?.y)}</p>
                <p>normal:{formatVector3(debugSnapshot.directionState?.palmNormal)}</p>
              </div>
            </div>

            <div className="mt-3 rounded-xl bg-white/5 p-3 text-[11px] text-zinc-300">
              <p className="font-semibold text-brand-200">Gesto hola</p>
              <div className="mt-2 space-y-1 font-mono">
                <p>nearHead:{currentGestureFrame?.nearHead ? '1' : '0'} twoFinger:{currentGestureFrame?.twoFingerHandshape ? '1' : '0'}</p>
                <p>palmFacing:{currentGestureFrame?.palmFacingCamera ? '1' : '0'} score:{currentGestureFrame?.palmFacingScore?.toFixed(3) ?? '—'}</p>
                <p>ratioHead:{gestureDebug?.nearHeadRatio?.toFixed(2) ?? '—'} ratio2F:{gestureDebug?.twoFingerRatio?.toFixed(2) ?? '—'}</p>
                <p>ratioPalm:{gestureDebug?.palmFacingRatio?.toFixed(2) ?? '—'} ratioOk:{gestureDebug?.reliableRatio?.toFixed(2) ?? '—'}</p>
                <p>rangeX:{gestureDebug?.recentRangeX?.toFixed(3) ?? '—'} frames:{gestureDebug?.frameCount ?? 0} suppress:{gestureDebug?.suppressStatic ? '1' : '0'}</p>
                {gestureDebug?.detectionDebug && (
                  <p className="text-accent-300">
                    detectado conf:{gestureDebug.detectionDebug?.nearHeadRatio?.toFixed(2) ?? '—'} swing:{gestureDebug.detectionDebug?.maxSwingAmplitude?.toFixed(3) ?? '—'}
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      )}

      {/* ─── Bottom subtitle panel ─── */}
      <div
        className="absolute inset-x-0 bottom-0 z-10 px-3 sm:px-4"
        style={{ paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${mobileBottomOffset})` }}
      >
        <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-brand-500/25 bg-gradient-to-r from-zinc-900/75 via-brand-950/50 to-zinc-900/75 px-3 py-2.5 shadow-xl shadow-brand-500/5 backdrop-blur-2xl sm:rounded-3xl sm:p-4">
          <div className="mb-2 flex items-center justify-between gap-2 sm:mb-3 sm:flex-row sm:gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-brand-300 sm:text-[10px]">{t('translator.current_word')}</p>
              <p className="mt-0.5 text-base font-bold tracking-[0.2em] text-white sm:mt-1 sm:text-xl sm:tracking-[0.24em]">
                {formatSpelledWord(wordBuffer)}
              </p>
              {liveDecodedWord?.changed && (
                <p className="mt-1 text-[11px] text-accent-300">
                  {t('translator.interpreting_as').replace('{raw}', liveDecodedWord.normalized).replace('{corrected}', liveDecodedWord.corrected)}
                </p>
              )}
              {lastGestureWord && currentDetectionType === 'gesture' && (
                <p className="mt-1 text-[11px] text-brand-300">
                  {t('translator.gesture_recognized').replace('{word}', lastGestureWord)}
                </p>
              )}
            </div>

            <div className="shrink-0 rounded-lg border border-white/8 bg-white/5 px-2.5 py-1.5 text-right text-[10px] sm:rounded-xl sm:px-3 sm:py-2 sm:text-[11px]">
              <p className={handPresent ? 'font-medium text-accent-300' : 'text-zinc-400'}>{handPresent ? t('translator.hand_visible') : t('translator.no_hand')}</p>
              <p className="mt-0.5 hidden text-zinc-500 sm:block">{t('translator.auto_speak')}</p>
            </div>
          </div>

          {/* Subtitle area */}
          <div className="space-y-1 border-t border-white/8 pt-2 sm:space-y-1.5 sm:pt-3">
            {recentLines.map((line, index) => (
              <p key={`${line}-${index}`} className="text-[11px] text-zinc-500 sm:text-sm">
                {line}
              </p>
            ))}

            <p className="min-h-[2rem] text-lg font-bold leading-snug text-white sm:min-h-[2.5rem] sm:text-2xl md:text-3xl">
              {liveSubtitle || <span className="text-zinc-500 text-sm sm:text-base">{t('translator.subtitle_placeholder')}</span>}
            </p>

            {lastDecodedWord?.changed && (
              <p className="text-xs text-accent-300">
                {t('translator.last_correction')}: &ldquo;{lastDecodedWord.normalized}&rdquo; {'→'} &ldquo;{lastDecodedWord.corrected}&rdquo;
              </p>
            )}
          </div>

          {/* Errors */}
          {(cameraError || detectionError || ttsError) && (
            <div className="mt-3 space-y-1.5 text-sm">
              {cameraError && (
                <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {cameraError}
                </p>
              )}
              {detectionError && (
                <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {t('translator.model_error')}: {detectionError}
                </p>
              )}
              {ttsError && (
                <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  {t('translator.audio_label')}: {ttsError}
                </p>
              )}
            </div>
          )}

          {/* Mobile controls */}
          {isCompactViewport && (
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowDebug((prev) => !prev)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-semibold text-zinc-300 transition active:scale-95 touch-manipulation"
              >
                {showDebug ? t('translator.hide_debug') : t('translator.show_debug')}
              </button>

              <button
                type="button"
                onClick={toggleTranslation}
                className={`rounded-xl px-3 py-2.5 text-xs font-semibold shadow-lg transition active:scale-95 touch-manipulation ${
                  isActive
                    ? 'bg-red-500/90 text-white'
                    : 'bg-brand-500 text-white shadow-brand-500/25'
                }`}
              >
                {isActive ? t('translator.pause') : t('translator.start')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Desktop floating controls ─── */}
      {!isCompactViewport && (
        <>
          <button
            type="button"
            onClick={toggleTranslation}
            className={`absolute right-3 z-20 flex items-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-bold shadow-2xl transition active:scale-95 touch-manipulation sm:right-4 ${
              isActive
                ? 'bg-red-500/90 text-white shadow-red-500/20'
                : 'bg-brand-500 text-white shadow-brand-500/30 hover:bg-brand-600'
            }`}
            style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + ${mobileBottomOffset})` }}
          >
            {isActive ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" /></svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" /></svg>
            )}
            {isActive ? t('translator.pause_translation') : t('translator.start_translation')}
          </button>

          <button
            type="button"
            onClick={() => setShowDebug((prev) => !prev)}
            className="absolute left-3 z-20 rounded-2xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm font-semibold text-zinc-300 shadow-xl backdrop-blur-xl transition hover:bg-zinc-800/80 active:scale-95 touch-manipulation sm:left-4"
            style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + ${mobileBottomOffset})` }}
          >
            {showDebug ? t('translator.hide_debug') : t('translator.show_debug')}
          </button>
        </>
      )}

      {/* Exit button */}
      <button
        type="button"
        onClick={() => navigate('/')}
        className="absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-xl border border-white/10 bg-zinc-900/80 px-3.5 py-2 text-sm font-medium text-zinc-300 shadow-xl backdrop-blur-xl transition hover:bg-zinc-800/80 active:scale-95 touch-manipulation sm:right-4 sm:top-4"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        {t('translator.exit')}
      </button>
    </section>
  )
}
