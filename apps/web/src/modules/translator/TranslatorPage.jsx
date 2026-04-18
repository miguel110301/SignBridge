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
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition.js'
import { requestCameraStream } from '../../utils/cameraStream.js'
import { useAuth } from '../auth/AuthProvider.jsx'

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
const MIN_STATIC_MARGIN = 0.14
const LETTER_RELEASE_MS = 180
const GESTURE_LOCK_MS = 700
const TRANSLATION_MODE = {
  SIGN_TO_VOICE: 'sign_to_voice',
  VOICE_TO_SIGN: 'voice_to_sign',
}

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

function normalizeTranscriptText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

function formatSpelledTranscript(text) {
  return normalizeTranscriptText(text)
    .split(' ')
    .filter(Boolean)
    .map((word) => Array.from(word.toUpperCase()).join(' '))
}

function VoiceToSignPreview({ text, placeholder, compact = false }) {
  const words = formatSpelledTranscript(text)

  if (!words.length) {
    return (
      <p className="font-readable text-sm leading-relaxed text-zinc-400 sm:text-base">
        {placeholder}
      </p>
    )
  }

  return (
    <div className="flex flex-wrap items-start gap-3">
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          className={`font-sign-display max-w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 uppercase text-white shadow-[0_20px_60px_rgba(15,23,42,0.35)] whitespace-normal ${
            compact
              ? 'text-[1.9rem] leading-none tracking-[0.14em]'
              : 'text-[2.35rem] leading-none tracking-[0.18em] sm:text-[3.2rem]'
          }`}
        >
          {word}
        </span>
      ))}
    </div>
  )
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

function formatFingerVectors(vectorMap) {
  if (!vectorMap) return '—'

  return ['T', 'I', 'M', 'R', 'P']
    .map((key) => `${key}:${formatVector2(vectorMap[key])}`)
    .join(' ')
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

function drawHandBox(ctx, projection, bbox, colors) {
  if (!bbox) return

  const leftTop = toCanvasPoint({ x: bbox.minX, y: bbox.minY }, projection)
  const rightBottom = toCanvasPoint({ x: bbox.maxX, y: bbox.maxY }, projection)
  ctx.strokeStyle = colors.stroke
  ctx.fillStyle = colors.fill
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

function drawHandSkeleton(ctx, projection, handLandmarks, color) {
  if (!handLandmarks?.length) return

  ctx.strokeStyle = color
  ctx.lineWidth = 2
  for (const [fromIndex, toIndex] of HAND_CONNECTIONS) {
    const from = toCanvasPoint(handLandmarks[fromIndex], projection)
    const to = toCanvasPoint(handLandmarks[toIndex], projection)
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
  }

  handLandmarks.forEach((point, index) => {
    const projected = toCanvasPoint(point, projection)
    ctx.fillStyle = index === 0 ? '#f97316' : '#f8fafc'
    ctx.beginPath()
    ctx.arc(projected.x, projected.y, index === 0 ? 5 : 4, 0, Math.PI * 2)
    ctx.fill()

    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.fillStyle = color
    ctx.fillText(String(index), projected.x + 6, projected.y - 4)
  })
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

  const hands = frameMeta.hands?.length
    ? frameMeta.hands
    : [{ landmarks, bbox: handQuality?.bbox }]

  hands.forEach((hand, handIndex) => {
    const colors = handIndex === 0
      ? getHandQualityStroke(handQuality)
      : {
          stroke: 'rgba(96, 165, 250, 0.95)',
          fill: 'rgba(96, 165, 250, 0.06)',
        }

    drawHandBox(ctx, projection, hand.bbox, colors)
    drawHandSkeleton(
      ctx,
      projection,
      hand.landmarks,
      handIndex === 0 ? 'rgba(34, 197, 94, 0.75)' : 'rgba(96, 165, 250, 0.85)'
    )
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
  const streamRef = useRef(null)
  const debugCanvasRef = useRef(null)
  const datasetHydratedRef = useRef(false)
  const datasetHydrationPromiseRef = useRef(null)
  const smootherRef = useRef(createSmoother())
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
  const neutralSinceRef = useRef(null)
  const awaitingLetterReleaseRef = useRef(false)
  const gestureLockUntilRef = useRef(0)
  const wordPauseHandledRef = useRef(false)
  const phrasePauseHandledRef = useRef(false)

  const audioQueueRef = useRef([])
  const audioGenerationRef = useRef(0)
  const activeAudioRef = useRef(null)
  const activeAudioUrlRef = useRef(null)
  const isAudioProcessingRef = useRef(false)
  const audioUnlockedRef = useRef(false)
  const lastVoiceTranscriptRef = useRef('')

  const [isCompactViewport, setIsCompactViewport] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  ))
  const [isStandaloneMode, setIsStandaloneMode] = useState(() => detectStandaloneMode())
  const [translationMode, setTranslationMode] = useState(TRANSLATION_MODE.SIGN_TO_VOICE)
  const [shouldMirrorPreview, setShouldMirrorPreview] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [ttsError, setTtsError] = useState('')
  const [speechError, setSpeechError] = useState('')
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
  const [voiceInterim, setVoiceInterim] = useState('')
  const [voiceLines, setVoiceLines] = useState([])
  const [latestVoiceTranscript, setLatestVoiceTranscript] = useState('')
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [showDebug, setShowDebug] = useState(false)
  const [debugSnapshot, setDebugSnapshot] = useState(null)
  const requiredStabilityFrames = isCompactViewport ? 6 : LETTER_STABILITY_FRAMES
  const isVoiceToSignMode = translationMode === TRANSLATION_MODE.VOICE_TO_SIGN

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

  const resetVoiceModeState = useCallback(() => {
    lastVoiceTranscriptRef.current = ''
    setVoiceInterim('')
    setLatestVoiceTranscript('')
    setVoiceLines([])
    setSpeechError('')
  }, [])

  const pushVoiceTranscript = useCallback((transcript) => {
    const normalized = normalizeTranscriptText(transcript)
    if (!normalized) return

    const signature = normalized.toLowerCase()
    if (lastVoiceTranscriptRef.current === signature) return

    lastVoiceTranscriptRef.current = signature
    setVoiceInterim('')
    setLatestVoiceTranscript(normalized)
    setVoiceLines((prev) => [...prev, normalized].slice(-MAX_SUBTITLE_LINES))
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
      classifierState: {
        method: debugFrame.handMetrics?.classification?.method ?? '—',
        staticTop: debugFrame.handMetrics?.classifiers?.static?.topCandidates ?? [],
        knnTop: debugFrame.handMetrics?.classifiers?.knn?.topCandidates ?? [],
        fusion: debugFrame.handMetrics?.classification?.fusion ?? null,
      },
      directionState: {
        camera: debugFrame.handMetrics?.directions?.camera ?? null,
        local: debugFrame.handMetrics?.directions?.local ?? null,
        cameraVectors: debugFrame.handMetrics?.directions?.cameraVectors ?? null,
        localVectors: debugFrame.handMetrics?.directions?.localVectors ?? null,
        palmNormal: debugFrame.handMetrics?.orientation?.palmNormal ?? null,
        palmOrientation: debugFrame.handMetrics?.orientation?.palmOrientation ?? null,
        screenAxes: debugFrame.handMetrics?.orientation?.axes?.screen ?? null,
      },
      trackingState: {
        hasWorldLandmarks: Array.isArray(debugFrame.frameMeta?.handWorldLandmarks) && debugFrame.frameMeta.handWorldLandmarks.length === 21,
      },
      palmCenter: debugFrame.handMetrics?.posture?.palmCenter ?? null,
      handCount: debugFrame.handMetrics?.posture?.handCount ?? 1,
      handQuality: debugFrame.handQuality ?? null,
      staticPose: debugFrame.staticPose ?? null,
      handedness: debugFrame.handedness ?? 'unknown',
      controlState: {
        margin: debugFrame.rawPrediction?.margin ?? null,
        awaitingRelease: awaitingLetterReleaseRef.current,
        gestureLocked: Date.now() < gestureLockUntilRef.current,
      },
    })
  }, [showDebug])

  const resetPredictionState = useCallback(() => {
    smootherRef.current.reset()
    gestureRecognizerRef.current.reset()
    staticPoseHistoryRef.current = []
    candidateLetterRef.current = null
    candidateFramesRef.current = 0
    appendLockRef.current = null
    neutralSinceRef.current = null
    awaitingLetterReleaseRef.current = false
    gestureLockUntilRef.current = 0
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

  const handleSpeechError = useCallback((errorCode) => {
    if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') {
      setSpeechError('Permiso de microfono denegado. Debes habilitarlo para usar voz a senas.')
      setIsActive(false)
      return
    }

    if (errorCode === 'no-speech') {
      setSpeechError('')
      return
    }

    setSpeechError(`Reconocimiento de voz: ${errorCode}`)
  }, [])

  const {
    start: startSpeechRecognition,
    stop: stopSpeechRecognition,
    listening: speechListening,
    supported: speechSupported,
  } = useSpeechRecognition({
    language: 'es-MX',
    onTranscript: pushVoiceTranscript,
    onInterim: setVoiceInterim,
    onError: handleSpeechError,
  })

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
    const spokenWord = gesture.spoken || gesture.word
    setLastGestureWord(spokenWord)
    candidateLetterRef.current = null
    candidateFramesRef.current = 0
    appendLockRef.current = null

    return pushRecognizedWord(spokenWord, {
      raw: gesture.word,
      normalized: gesture.word,
      corrected: spokenWord,
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

  const commitDynamicLetter = useCallback((gesture) => {
    if (!gesture?.letter) return null

    const letter = String(gesture.letter).trim().toUpperCase()
    if (!letter) return null

    setLastGestureWord('')
    candidateLetterRef.current = null
    candidateFramesRef.current = 0
    appendLockRef.current = null
    appendLetter(letter)

    return letter
  }, [appendLetter])

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

    const bestCandidate = handMetrics?.classification?.bestCandidate ?? null
    const topCandidates = handMetrics?.classification?.topCandidates ?? []
    const secondCandidate = topCandidates[1] ?? null
    const candidateMargin =
      bestCandidate && secondCandidate
        ? bestCandidate.confidence - secondCandidate.confidence
        : bestCandidate
          ? bestCandidate.confidence
          : 0

    const staticInputAllowed =
      handQuality.reliable &&
      staticPose.stable &&
      !gestureState.suppressStatic &&
      now >= gestureLockUntilRef.current

    let rawPrediction = null
    if (staticInputAllowed && bestCandidate) {
      const basePrediction = {
        letter: bestCandidate.letter,
        confidence: bestCandidate.confidence,
        candidates: topCandidates,
        classifierDebug: handMetrics.classification,
        secondCandidateFailure: topCandidates[1]?.failedRule ?? null,
        margin: candidateMargin,
      }

      if (
        basePrediction.confidence >= MIN_STATIC_CONFIDENCE &&
        candidateMargin >= MIN_STATIC_MARGIN
      ) {
        rawPrediction = basePrediction
      }
    }

    const smoothedPrediction = rawPrediction
      ? smootherRef.current.push(rawPrediction)
      : (smootherRef.current.reset(), null)
    const prediction = smoothedPrediction

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
    setHandPresence(true)

    if (gestureState.gesture) {
      gestureLockUntilRef.current = now + GESTURE_LOCK_MS
      neutralSinceRef.current = null
      awaitingLetterReleaseRef.current = true
      wordPauseHandledRef.current = false
      phrasePauseHandledRef.current = false

      if (gestureState.gesture.letter) {
        updateDetectionDisplay(gestureState.gesture.letter.toUpperCase(), gestureState.gesture.confidence, 'letter')
        commitDynamicLetter(gestureState.gesture)
      } else {
        updateDetectionDisplay((gestureState.gesture.spoken || gestureState.gesture.word).toUpperCase(), gestureState.gesture.confidence, 'gesture')
        commitGesture(gestureState.gesture)
      }

      return
    }

    const neutralFrame =
      gestureState.suppressStatic ||
      !handQuality.reliable ||
      !staticPose.stable ||
      !rawPrediction

    if (neutralFrame) {
      if (!neutralSinceRef.current) {
        neutralSinceRef.current = now
      }

      if (
        awaitingLetterReleaseRef.current &&
        now - neutralSinceRef.current >= LETTER_RELEASE_MS
      ) {
        awaitingLetterReleaseRef.current = false
        appendLockRef.current = null
      }

      smootherRef.current.reset()
      candidateLetterRef.current = null
      candidateFramesRef.current = 0
      updateDetectionDisplay(null, 0, gestureState.suppressStatic ? 'gesture' : 'letter')
      return
    }

    neutralSinceRef.current = null
    wordPauseHandledRef.current = false
    phrasePauseHandledRef.current = false

    if (!prediction) {
      updateDetectionDisplay(rawPrediction?.letter ?? null, rawPrediction?.confidence ?? 0, 'letter')
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

    if (
      stabilityFrames >= requiredStabilityFrames &&
      !awaitingLetterReleaseRef.current
    ) {
      appendLetter(prediction.letter)
      awaitingLetterReleaseRef.current = true
    }
  }, [appendLetter, commitDynamicLetter, commitGesture, requiredStabilityFrames, setHandPresence, updateDebugVisuals, updateDetectionDisplay])

  const { videoRef, ready, error: detectionError } = useHandDetection({
    onLandmarks: handleLandmarks,
    enabled: isActive && !isVoiceToSignMode,
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
      stopSpeechRecognition()
      clearAudioQueue()
    }
  }, [clearAudioQueue, stopCameraStream, stopSpeechRecognition])

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
    if (
      !isActive ||
      isVoiceToSignMode ||
      datasetHydratedRef.current ||
      datasetHydrationPromiseRef.current
    ) {
      return
    }

    const hydrationPromise = hydrateTemplatesFromServer()
      .then(() => {
        datasetHydratedRef.current = true
      })
      .catch((error) => {
        console.warn('[Translator] No se pudo hidratar dataset desde MongoDB; se usará cache local.', error)
      })
      .finally(() => {
        if (datasetHydrationPromiseRef.current === hydrationPromise) {
          datasetHydrationPromiseRef.current = null
        }
      })

    datasetHydrationPromiseRef.current = hydrationPromise
  }, [isActive, isVoiceToSignMode])

  useEffect(() => {
    if (!isActive) {
      stopCameraStream()
      clearAudioQueue()
      resetPredictionState()
      return
    }

    if (isVoiceToSignMode) {
      stopCameraStream()
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
  }, [clearAudioQueue, isActive, isVoiceToSignMode, resetPredictionState, stopCameraStream, videoRef])

  useEffect(() => {
    if (!isVoiceToSignMode || !isActive) {
      stopSpeechRecognition()
      return
    }

    stopCameraStream()
    setCameraError('')
    setTtsError('')

    if (!speechSupported) {
      setSpeechError('Este navegador no soporta reconocimiento de voz continuo para voz a senas.')
      setIsActive(false)
      return
    }

    setSpeechError('')
    startSpeechRecognition()

    return () => {
      stopSpeechRecognition()
    }
  }, [isActive, isVoiceToSignMode, speechSupported, startSpeechRecognition, stopCameraStream, stopSpeechRecognition])

  useEffect(() => {
    if (showDebug) return
    clearDebugCanvas(debugCanvasRef.current)
  }, [showDebug])

  useEffect(() => {
    if (!isActive || isVoiceToSignMode) return

    const intervalId = window.setInterval(() => {
      const now = Date.now()
      const idleFor = now - lastHandSeenAtRef.current

      // Cuando dejamos de recibir landmarks no debemos resetear todo de inmediato:
      // primero entramos a estado neutral para permitir release + commit de palabra.
      if (idleFor >= HAND_LOST_GRACE_MS) {
        if (!neutralSinceRef.current) {
          neutralSinceRef.current = lastHandSeenAtRef.current + HAND_LOST_GRACE_MS
        }

        setHandPresence(false)
        smootherRef.current.reset()
        candidateLetterRef.current = null
        candidateFramesRef.current = 0
        updateDetectionDisplay(null, 0, 'letter')
      }

      const neutralFor = neutralSinceRef.current ? now - neutralSinceRef.current : 0

      if (
        neutralFor >= LETTER_RELEASE_MS &&
        awaitingLetterReleaseRef.current
      ) {
        awaitingLetterReleaseRef.current = false
        appendLockRef.current = null
      }

      if (neutralFor >= WORD_PAUSE_MS && !wordPauseHandledRef.current) {
        wordPauseHandledRef.current = true
        commitWord()
      }

      if (neutralFor >= PHRASE_PAUSE_MS && !phrasePauseHandledRef.current) {
        phrasePauseHandledRef.current = true
        commitPhrase()
      }
    }, 100)

    return () => window.clearInterval(intervalId)
  }, [commitPhrase, commitWord, isActive, isVoiceToSignMode, setHandPresence, updateDetectionDisplay])

  const toggleTranslation = useCallback(async () => {
    if (!isActive && !isVoiceToSignMode) {
      setTtsError('')
      await unlockAudioPlayback()
    }

    setIsActive((prev) => !prev)
  }, [isActive, isVoiceToSignMode, unlockAudioPlayback])

  const toggleTranslationMode = useCallback(() => {
    setIsActive(false)
    stopCameraStream()
    stopSpeechRecognition()
    clearAudioQueue()
    resetPredictionState()
    resetVoiceModeState()
    setCameraError('')
    setTtsError('')
    setSpeechError('')

    setTranslationMode((prev) => (
      prev === TRANSLATION_MODE.SIGN_TO_VOICE
        ? TRANSLATION_MODE.VOICE_TO_SIGN
        : TRANSLATION_MODE.SIGN_TO_VOICE
    ))
  }, [
    clearAudioQueue,
    resetPredictionState,
    resetVoiceModeState,
    stopCameraStream,
    stopSpeechRecognition,
  ])

  const recentLines = subtitleLines.slice(-3)
  const recentVoiceLines = voiceLines.slice(-3)
  const liveDecodedWord = wordBuffer ? decodeFingerSpelling(wordBuffer) : null
  const liveWordPreview = liveDecodedWord?.corrected || (wordBuffer ? normalizeWord(wordBuffer) : '')
  const liveSubtitle = [...phraseWords, liveWordPreview]
    .filter(Boolean)
    .join(' ')
  const voiceLiveSource = voiceInterim || latestVoiceTranscript || recentVoiceLines[recentVoiceLines.length - 1] || ''
  const voiceHistoryLines = [...recentVoiceLines].reverse()
  const detectionHeading = isVoiceToSignMode
    ? 'Entrada de voz'
    : currentDetectionType === 'gesture'
      ? 'Gesto detectado'
      : 'Letra detectada'
  const gestureDebug = debugSnapshot?.gestureDebug
  const currentGestureFrame = gestureDebug?.currentFrame
  const mobileBottomOffset = '1rem'
  const modeToggleLabel = isVoiceToSignMode ? 'Señas a voz' : 'Voz a señas'
  const startActionLabel = isVoiceToSignMode
    ? (isActive ? 'Pausar voz a señas' : 'Iniciar voz a señas')
    : (isActive ? 'Pausar traduccion' : 'Iniciar traduccion')
  const heroTitle = isVoiceToSignMode ? 'Voz a señas' : 'Listo para traducir'
  const heroDescription = isVoiceToSignMode
    ? 'Toca iniciar, permite el microfono y mostraremos el mensaje dicho en pantalla, deletreado y con alta legibilidad.'
    : 'Toca iniciar, apunta la camara trasera a la persona que esta senando y deja que SignBridge interprete en voz alta.'
  const displayBadgeLabel = isVoiceToSignMode ? 'Deletreo visual activo' : 'Deletreo + gestos activos'
  const displayIndicator = isVoiceToSignMode ? (speechListening ? '🎙' : '—') : (currentLetter || '—')
  const displayConfidence = isVoiceToSignMode ? (speechListening ? 1 : 0) : currentConfidence
  const mainPanelTitle = isVoiceToSignMode ? 'Mensaje actual' : 'Palabra actual'
  const isMobileSignToVoice = isCompactViewport && !isVoiceToSignMode

  const statusLabel = isVoiceToSignMode
    ? !speechSupported
      ? 'Sin speech API'
      : !isActive
        ? 'En pausa'
        : speechListening
          ? 'Escuchando'
          : 'Activando micro'
    : detectionError
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

  if (isVoiceToSignMode) {
    return (
      <section className="relative min-h-[100dvh] overflow-x-hidden bg-black">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_34%),radial-gradient(circle_at_80%_20%,_rgba(16,185,129,0.16),_transparent_28%),linear-gradient(180deg,_rgba(9,9,11,0.96)_0%,_rgba(9,9,11,1)_100%)]" />
          <div className="absolute -left-16 top-24 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute bottom-24 right-0 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
        </div>

        <div
          className="relative mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] sm:px-6"
        >
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-full border border-white/15 bg-black/60 px-4 py-2 text-sm font-medium text-white shadow-xl backdrop-blur-md transition active:scale-95 touch-manipulation"
            >
              Salir
            </button>
          </div>

          <div className="mt-3 rounded-[1.4rem] border border-white/10 bg-black/45 p-4 backdrop-blur-xl sm:rounded-[2rem] sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-300">{detectionHeading}</p>
                <div className="mt-2 flex items-end gap-3">
                  <span className="text-4xl font-black leading-none text-white sm:text-6xl">
                    {displayIndicator}
                  </span>
                  <span className="pb-1 text-sm text-zinc-200 sm:pb-2">
                    {Math.round(displayConfidence * 100)}%
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-zinc-100">
                  {statusLabel}
                </span>
                <span className="rounded-full bg-sky-500/12 px-3 py-1 text-xs text-sky-200">
                  Perfil: {SIGN_LANGUAGE_PROFILE.code}
                </span>
                <span className="rounded-full bg-emerald-500/12 px-3 py-1 text-xs text-emerald-200">
                  {displayBadgeLabel}
                </span>
                <span className="rounded-full bg-cyan-500/12 px-3 py-1 text-xs text-cyan-100">
                  Speech API local
                </span>
              </div>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-150"
                style={{
                  width: `${Math.max(displayConfidence * 100, displayIndicator !== '—' ? 8 : 0)}%`,
                  background: 'linear-gradient(90deg, #34d399 0%, #10b981 100%)',
                }}
              />
            </div>
          </div>

          <div className="mt-4 grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
            <div className="rounded-[1.75rem] border border-white/10 bg-black/25 p-5 backdrop-blur-xl sm:p-7">
              <p className="font-readable text-xs uppercase tracking-[0.24em] text-cyan-200">Modo visual</p>
              <h1 className="font-readable mt-2 text-3xl font-bold tracking-[0.01em] text-white sm:text-5xl">
                Voz a señas
              </h1>
              <p className="font-readable mt-3 max-w-2xl text-sm leading-relaxed text-zinc-300 sm:text-base">
                Escuchamos la frase y la devolvemos en pantalla con deletreo grande y legible mientras llega una version de señas completa.
              </p>

              <div className="mt-5 rounded-[1.75rem] border border-white/10 bg-white/5 p-4 sm:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-readable text-xs uppercase tracking-[0.24em] text-zinc-400">Salida visual inmediata</p>
                  <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-zinc-300">
                    {speechListening ? 'Escuchando ahora' : isActive ? 'Esperando voz' : 'Modo en pausa'}
                  </span>
                </div>

                <div className="mt-4 min-h-[15rem] rounded-[1.35rem] border border-white/8 bg-black/25 p-4 sm:min-h-[18rem] sm:p-5">
                  <VoiceToSignPreview
                    text={voiceLiveSource}
                    compact={isCompactViewport}
                    placeholder={isActive
                      ? 'Lo que diga la persona oyente aparecera aqui, deletreado en tiempo real.'
                      : 'Toca iniciar para empezar a mostrar el deletreo visual.'}
                  />
                </div>

                <p className="font-readable mt-4 text-xs text-zinc-400">
                  Texto detectado: {voiceLiveSource || 'esperando voz'}
                </p>
              </div>
            </div>

            <aside className="flex flex-col gap-4">
              <div className="rounded-[1.5rem] border border-white/10 bg-black/50 p-4 backdrop-blur-xl">
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-zinc-300">Mensaje actual</p>
                    <p className="font-readable mt-2 text-base font-semibold leading-relaxed text-white sm:text-lg">
                      {voiceLiveSource || 'Esperando voz...'}
                    </p>
                    {voiceInterim && (
                      <p className="mt-2 text-xs text-cyan-200">
                        Capturando en tiempo real...
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-zinc-300">
                    <p>{speechListening ? 'Microfono activo' : 'Microfono en pausa'}</p>
                    <p className="mt-1 text-zinc-400">La salida en señas solo aparece en el panel central.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-black/45 p-4 backdrop-blur-xl">
                <p className="text-xs uppercase tracking-[0.24em] text-zinc-300">Historial reciente</p>
                <div className="mt-3 space-y-2">
                  {voiceHistoryLines.length > 0 ? (
                    voiceHistoryLines.map((line, index) => (
                      <p key={`${line}-${index}`} className="font-readable rounded-2xl border border-white/8 bg-white/5 px-3 py-3 text-sm leading-relaxed text-zinc-300">
                        {line}
                      </p>
                    ))
                  ) : (
                    <p className="font-readable text-sm leading-relaxed text-zinc-500">
                      Las frases detectadas apareceran aqui conforme hable la persona oyente.
                    </p>
                  )}
                </div>
              </div>

              {(ttsError || speechError) && (
                <div className="space-y-2">
                  {ttsError && (
                    <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                      Audio: {ttsError}
                    </p>
                  )}
                  {speechError && (
                    <p className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
                      Voz a señas: {speechError}
                    </p>
                  )}
                </div>
              )}
            </aside>
          </div>

          <div className="sticky bottom-0 mt-4 pb-[env(safe-area-inset-bottom,0px)]">
            <div className="rounded-[1.35rem] border border-white/10 bg-black/70 p-3 shadow-2xl backdrop-blur-xl">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
                  Usa el panel central para el deletreo en señas y este lateral para leer el texto normal sin que se encimen.
                </div>

                <button
                  type="button"
                  onClick={toggleTranslationMode}
                  className="font-readable w-full rounded-full border border-emerald-400/30 bg-emerald-500/12 px-4 py-3 text-sm font-semibold text-emerald-100 shadow-lg transition active:scale-95 touch-manipulation lg:w-auto"
                >
                  {modeToggleLabel}
                </button>

                <button
                  type="button"
                  onClick={toggleTranslation}
                  className={`w-full rounded-full px-4 py-3 text-sm font-semibold shadow-lg transition active:scale-95 touch-manipulation lg:w-auto ${
                    isActive ? 'bg-red-500 text-white' : 'bg-brand-500 text-white'
                  }`}
                >
                  {startActionLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (isMobileSignToVoice) {
    return (
      <section className="relative min-h-[100dvh] overflow-hidden bg-black">
        <video
          ref={videoRef}
          className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${
            cameraReady ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ transform: shouldMirrorPreview ? 'scaleX(-1)' : 'none' }}
          muted
          playsInline
          autoPlay
          disablePictureInPicture
        />

        <canvas
          ref={debugCanvasRef}
          className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-200 ${
            showDebug ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ transform: shouldMirrorPreview ? 'scaleX(-1)' : 'none' }}
        />

        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/20 to-black/90" />

        {isActive && !cameraReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
            <div className="max-w-sm px-6 text-center">
              <div className="mx-auto mb-4 h-14 w-14 rounded-full border-2 border-brand-500/60 border-t-transparent animate-spin" />
              <h1 className="mb-2 text-2xl font-semibold tracking-tight">SignBridge Live</h1>
              <p className="text-sm text-zinc-300">
                Abriendo camara trasera y preparando la deteccion en tiempo real.
              </p>
            </div>
          </div>
        )}

        <div
          className="absolute inset-x-0 top-0 z-10 px-3"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.55rem)' }}
        >
          <div className="mx-auto max-w-xl rounded-[1.4rem] border border-white/10 bg-black/45 p-3 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-300">{detectionHeading}</p>
                <div className="mt-2 flex items-end gap-3">
                  <span className="text-4xl font-black leading-none text-white">
                    {displayIndicator}
                  </span>
                  <span className="pb-1 text-sm text-zinc-200">
                    {Math.round(displayConfidence * 100)}%
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-medium text-zinc-100">
                  {statusLabel}
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="rounded-full border border-white/15 bg-black/60 px-3 py-2 text-sm font-medium text-white shadow-xl backdrop-blur-md transition active:scale-95 touch-manipulation"
                >
                  Salir
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-zinc-300">
              <span className="rounded-full bg-white/8 px-3 py-1">
                Estable: {requiredStabilityFrames}f
              </span>
              <span className="rounded-full bg-white/8 px-3 py-1">
                Pausa: {WORD_PAUSE_MS}ms
              </span>
              {cameraReady && (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-zinc-200">
                  {shouldMirrorPreview ? 'Vista espejo' : 'Vista normal'}
                </span>
              )}
              {(audioStatus !== 'idle' || queueSize > 0) && (
                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 text-emerald-200">
                  {audioStatus === 'fetching'
                    ? 'Audio...'
                    : audioStatus === 'playing'
                      ? 'Hablando'
                      : 'En cola'}
                  {queueSize > 0 ? ` · ${queueSize}` : ''}
                </span>
              )}
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-150"
                style={{
                  width: `${Math.max(displayConfidence * 100, displayIndicator !== '—' ? 8 : 0)}%`,
                  background:
                    displayConfidence > 0.85
                      ? 'linear-gradient(90deg, #34d399 0%, #10b981 100%)'
                      : displayConfidence > 0.6
                        ? 'linear-gradient(90deg, #f59e0b 0%, #f97316 100%)'
                        : 'linear-gradient(90deg, #fb7185 0%, #ef4444 100%)',
                }}
              />
            </div>
          </div>
        </div>

        {showDebug && debugSnapshot && (
          <div
            className="absolute inset-x-3 z-10 max-h-[20dvh] overflow-y-auto rounded-[1.25rem] border border-cyan-400/20 bg-black/65 p-3 backdrop-blur-xl"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8.3rem)' }}
          >
            <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200">Debug Movil</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-zinc-200">
              <span className="rounded-xl bg-white/8 px-3 py-2">Tipo: {debugSnapshot.currentDetectionType}</span>
              <span className="rounded-xl bg-white/8 px-3 py-2">Final: {debugSnapshot.resolvedPrediction?.letter ?? '—'}</span>
              <span className="rounded-xl bg-white/8 px-3 py-2">Calidad: {debugSnapshot.handQuality?.qualityScore?.toFixed(2) ?? '—'}</span>
              <span className="rounded-xl bg-white/8 px-3 py-2">Caja: {formatQualityStatus(debugSnapshot.handQuality?.status)}</span>
            </div>
            <div className="mt-2 space-y-1 rounded-2xl bg-white/8 p-3 font-mono text-[11px] text-zinc-200">
              <p>mano:{debugSnapshot.handedness}</p>
              <p>stable:{debugSnapshot.staticPose?.stable ? '1' : '0'} usable:{debugSnapshot.handQuality?.reliable ? '1' : '0'}</p>
              <p>move:{debugSnapshot.staticPose?.travel?.toFixed(3) ?? '—'} rx:{debugSnapshot.staticPose?.rangeX?.toFixed(3) ?? '—'} ry:{debugSnapshot.staticPose?.rangeY?.toFixed(3) ?? '—'}</p>
              <p>motivo:{debugSnapshot.handQuality?.reasons?.length ? debugSnapshot.handQuality.reasons.map(formatQualityReason).join(', ') : 'ok'}</p>
              <p>estado:{debugSnapshot.fingerDebugString ?? '—'}</p>
              <p>hands:{debugSnapshot.handCount ?? 1} dtw2:{gestureDebug?.twoHandsRatio?.toFixed(2) ?? '—'}</p>
              <p>cam:{formatDirectionMap(debugSnapshot.directionState?.camera)}</p>
              <p>loc:{formatDirectionMap(debugSnapshot.directionState?.local)}</p>
              <p>camVec:{formatFingerVectors(debugSnapshot.directionState?.cameraVectors)}</p>
              <p>motor:{debugSnapshot.classifierState?.method ?? '—'}</p>
              <p>vec:{formatTopCandidates(debugSnapshot.classifierState?.staticTop)}</p>
              <p>db:{formatTopCandidates(debugSnapshot.classifierState?.knnTop)}</p>
              <p>top3:{formatTopCandidates(debugSnapshot.classification?.topCandidates)}</p>
              <p>palm:{debugSnapshot.directionState?.palmOrientation ?? '—'} 3d:{debugSnapshot.trackingState?.hasWorldLandmarks ? '1' : '0'}</p>
              <p>gap_IM:{debugSnapshot.featureState?.gapIM?.toFixed(2) ?? '—'} crossed:{debugSnapshot.featureState?.crossedIM ? '1' : '0'} thumb:{debugSnapshot.featureState?.thumbRole ?? '—'}</p>
              <p>fusion:{debugSnapshot.classifierState?.fusion?.knnScope ?? '—'} rej:{debugSnapshot.classifierState?.fusion?.knnRejectedReason ?? '—'}</p>
            </div>
          </div>
        )}

        <div
          className="absolute inset-x-0 bottom-0 z-10 px-3"
          style={{ paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${isStandaloneMode ? '0.75rem' : '4.75rem'})` }}
        >
          <div className="mx-auto max-w-xl max-h-[47dvh] overflow-y-auto rounded-[1.6rem] border border-white/10 bg-black/55 p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.24em] text-zinc-300">{mainPanelTitle}</p>
                  <p className="mt-2 text-base font-semibold tracking-[0.16em] text-white">
                    {formatSpelledWord(wordBuffer)}
                  </p>
                  {liveDecodedWord?.changed && (
                    <p className="mt-2 text-xs text-emerald-200">
                      Interpretando "{liveDecodedWord.normalized}" como "{liveDecodedWord.corrected}"
                    </p>
                  )}
                  {lastGestureWord && currentDetectionType === 'gesture' && (
                    <p className="mt-2 text-xs text-sky-200">
                      Gesto reconocido: "{lastGestureWord}"
                    </p>
                  )}
                </div>

                <div className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-zinc-300">
                  <p>{handPresent ? 'Mano visible' : 'Sin mano'}</p>
                  <p className="mt-1 text-zinc-400">Cierre automatico de palabra</p>
                </div>
              </div>

              {recentLines.length > 0 && (
                <div className="space-y-2">
                  {recentLines.slice(-2).reverse().map((line, index) => (
                    <p key={`${line}-${index}`} className="text-xs text-zinc-400">
                      {line}
                    </p>
                  ))}
                </div>
              )}

              <div className="rounded-[1.25rem] border border-white/8 bg-white/5 p-4">
                <p className="text-xl font-semibold leading-tight text-white">
                  {liveSubtitle || 'Los subtitulos apareceran aqui en cuanto detectemos la mano.'}
                </p>

                {lastDecodedWord?.changed && (
                  <p className="mt-3 text-xs text-emerald-200">
                    Ultima correccion: "{lastDecodedWord.normalized}" {'->'} "{lastDecodedWord.corrected}"
                  </p>
                )}
              </div>

              {(cameraError || detectionError || ttsError) && (
                <div className="space-y-2 text-sm">
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

              <div className="space-y-3 border-t border-white/10 pt-3">
                <button
                  type="button"
                  onClick={toggleTranslationMode}
                  className="font-readable w-full rounded-full border border-emerald-400/30 bg-emerald-500/12 px-4 py-3 text-sm font-semibold text-emerald-100 shadow-lg transition active:scale-95 touch-manipulation"
                >
                  {modeToggleLabel}
                </button>

                <div className={`grid gap-3 ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setShowDebug((prev) => !prev)}
                      className="rounded-full border border-cyan-400/30 bg-black/60 px-4 py-3 text-sm font-semibold text-cyan-100 shadow-lg transition active:scale-95 touch-manipulation"
                    >
                      {showDebug ? 'Ocultar debug' : 'Mostrar debug'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={toggleTranslation}
                    className={`rounded-full px-4 py-3 text-sm font-semibold shadow-lg transition active:scale-95 touch-manipulation ${
                      isActive ? 'bg-red-500 text-white' : 'bg-brand-500 text-white'
                    }`}
                  >
                    {startActionLabel}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="relative h-full min-h-[100dvh] overflow-hidden bg-black">
      {!isVoiceToSignMode && (
        <>
          <video
            ref={videoRef}
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${
              cameraReady ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ transform: shouldMirrorPreview ? 'scaleX(-1)' : 'none' }}
            muted
            playsInline
            autoPlay
            disablePictureInPicture
          />

          <canvas
            ref={debugCanvasRef}
            className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-200 ${
              showDebug ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ transform: shouldMirrorPreview ? 'scaleX(-1)' : 'none' }}
          />
        </>
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/10 to-black/85" />

      {!isVoiceToSignMode && isActive && !cameraReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
          <div className="max-w-sm px-6 text-center">
            <div className="mx-auto mb-4 h-14 w-14 rounded-full border-2 border-brand-500/60 border-t-transparent animate-spin" />
            <h1 className="mb-2 text-2xl font-semibold tracking-tight">SignBridge Live</h1>
            <p className="text-sm text-zinc-300">
              Abriendo camara trasera y preparando la deteccion en tiempo real.
            </p>
          </div>
        </div>
      )}

      {!isActive && (
        <div className="absolute inset-x-0 top-1/2 z-[5] px-6 -translate-y-1/2">
          <div className="mx-auto max-w-md rounded-[2rem] border border-white/10 bg-black/45 p-6 text-center backdrop-blur-xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/15 text-2xl text-brand-300">
              {isVoiceToSignMode ? '🎙️' : '🤟'}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">{heroTitle}</h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              {heroDescription}
            </p>
          </div>
        </div>
      )}

      <div
        className="absolute inset-x-0 top-0 z-10 px-4"
        style={{ paddingTop: `calc(env(safe-area-inset-top, 0px) + ${isCompactViewport ? '0.75rem' : '1rem'})` }}
      >
        <div className="mx-auto max-w-4xl rounded-[1.25rem] border border-white/10 bg-black/40 p-3 backdrop-blur-xl sm:rounded-[2rem] sm:p-4">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-300">{detectionHeading}</p>
              <div className="mt-1 flex items-end gap-3">
                <span className="text-5xl font-black leading-none text-white sm:text-7xl">
                  {displayIndicator}
                </span>
                <span className="pb-1 text-sm text-zinc-200 sm:pb-2">
                  {Math.round(displayConfidence * 100)}%
                </span>
              </div>
            </div>

            <div className="flex flex-row flex-wrap items-start gap-2 sm:flex-col sm:items-end sm:text-right">
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-zinc-100">
                {statusLabel}
              </span>

              {!isVoiceToSignMode && cameraReady && (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-200">
                  {shouldMirrorPreview ? 'Vista espejo' : 'Vista normal'}
                </span>
              )}

              {!isVoiceToSignMode && (audioStatus !== 'idle' || queueSize > 0) && (
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
                width: `${Math.max(displayConfidence * 100, displayIndicator !== '—' ? 8 : 0)}%`,
                background:
                  displayConfidence > 0.85
                    ? 'linear-gradient(90deg, #34d399 0%, #10b981 100%)'
                    : displayConfidence > 0.6
                      ? 'linear-gradient(90deg, #f59e0b 0%, #f97316 100%)'
                      : 'linear-gradient(90deg, #fb7185 0%, #ef4444 100%)',
              }}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-zinc-300 sm:text-xs">
            <span className="rounded-full bg-white/8 px-3 py-1">
              Letra estable: {requiredStabilityFrames} frames
            </span>
            <span className="rounded-full bg-white/8 px-3 py-1">
              Pausa palabra: {WORD_PAUSE_MS} ms
            </span>
            <span className="rounded-full bg-white/8 px-3 py-1">
              Pausa frase: {PHRASE_PAUSE_MS} ms
            </span>
            <span className="rounded-full bg-sky-500/12 px-3 py-1 text-sky-200">
              Perfil: {SIGN_LANGUAGE_PROFILE.code}
            </span>
            <span className="rounded-full bg-emerald-500/12 px-3 py-1 text-emerald-200">
              {displayBadgeLabel}
            </span>
            {isVoiceToSignMode && (
              <span className="rounded-full bg-cyan-500/12 px-3 py-1 text-cyan-100">
                Speech API local
              </span>
            )}
          </div>
        </div>
      </div>

      {!isVoiceToSignMode && showDebug && debugSnapshot && (
        isCompactViewport ? (
          <div
            className="absolute inset-x-3 z-10 max-h-[24dvh] overflow-y-auto rounded-[1.25rem] border border-cyan-400/20 bg-black/65 p-3 backdrop-blur-xl"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 7rem)' }}
          >
            <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200">Debug Movil</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-zinc-200">
              <span className="rounded-xl bg-white/8 px-3 py-2">Tipo: {debugSnapshot.currentDetectionType}</span>
              <span className="rounded-xl bg-white/8 px-3 py-2">Final: {debugSnapshot.resolvedPrediction?.letter ?? '—'}</span>
              <span className="rounded-xl bg-white/8 px-3 py-2">Calidad: {debugSnapshot.handQuality?.qualityScore?.toFixed(2) ?? '—'}</span>
              <span className="rounded-xl bg-white/8 px-3 py-2">Caja: {formatQualityStatus(debugSnapshot.handQuality?.status)}</span>
            </div>
            <div className="mt-2 space-y-1 rounded-2xl bg-white/8 p-3 font-mono text-[11px] text-zinc-200">
              <p>mano:{debugSnapshot.handedness}</p>
              <p>stable:{debugSnapshot.staticPose?.stable ? '1' : '0'} usable:{debugSnapshot.handQuality?.reliable ? '1' : '0'}</p>
              <p>move:{debugSnapshot.staticPose?.travel?.toFixed(3) ?? '—'} rx:{debugSnapshot.staticPose?.rangeX?.toFixed(3) ?? '—'} ry:{debugSnapshot.staticPose?.rangeY?.toFixed(3) ?? '—'}</p>
              <p>motivo:{debugSnapshot.handQuality?.reasons?.length ? debugSnapshot.handQuality.reasons.map(formatQualityReason).join(', ') : 'ok'}</p>
              <p>estado:{debugSnapshot.fingerDebugString ?? '—'}</p>
              <p>hands:{debugSnapshot.handCount ?? 1} dtw2:{gestureDebug?.twoHandsRatio?.toFixed(2) ?? '—'}</p>
              <p>cam:{formatDirectionMap(debugSnapshot.directionState?.camera)}</p>
              <p>loc:{formatDirectionMap(debugSnapshot.directionState?.local)}</p>
              <p>camVec:{formatFingerVectors(debugSnapshot.directionState?.cameraVectors)}</p>
              <p>motor:{debugSnapshot.classifierState?.method ?? '—'}</p>
              <p>vec:{formatTopCandidates(debugSnapshot.classifierState?.staticTop)}</p>
              <p>db:{formatTopCandidates(debugSnapshot.classifierState?.knnTop)}</p>
              <p>palm:{debugSnapshot.directionState?.palmOrientation ?? '—'} n:{formatVector3(debugSnapshot.directionState?.palmNormal)}</p>
              <p>top3:{formatTopCandidates(debugSnapshot.classification?.topCandidates)}</p>
              <p>margin:{debugSnapshot.controlState?.margin?.toFixed(2) ?? '—'} release:{debugSnapshot.controlState?.awaitingRelease ? '1' : '0'}</p>
              <p>gap_IM:{debugSnapshot.featureState?.gapIM?.toFixed(2) ?? '—'} crossed:{debugSnapshot.featureState?.crossedIM ? '1' : '0'} thumb:{debugSnapshot.featureState?.thumbRole ?? '—'}</p>
              <p>2o fallo:{debugSnapshot.classification?.topCandidates?.[1]?.failedRule ?? '—'}</p>
              <p>gesto head:{currentGestureFrame?.nearHead ? '1' : '0'} 2F:{currentGestureFrame?.twoFingerHandshape ? '1' : '0'} palm:{currentGestureFrame?.palmFacingCamera ? '1' : '0'}</p>
            </div>
          </div>
        ) : (
          <div
            className="absolute left-3 right-3 z-10 max-h-[40dvh] overflow-y-auto rounded-[1.5rem] border border-cyan-400/20 bg-black/55 p-3 backdrop-blur-xl md:left-4 md:right-auto md:w-[min(22rem,calc(100vw-2rem))] md:p-4"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 9.25rem)' }}
          >
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200">Debug Mapper</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-200">
              <span className="rounded-xl bg-white/8 px-3 py-2">Tipo: {debugSnapshot.currentDetectionType}</span>
              <span className="rounded-xl bg-white/8 px-3 py-2">Raw: {debugSnapshot.rawPrediction?.letter ?? '—'}</span>
              <span className="rounded-xl bg-white/8 px-3 py-2">Smooth: {debugSnapshot.smoothedPrediction?.letter ?? '—'}</span>
              <span className="rounded-xl bg-white/8 px-3 py-2">Final: {debugSnapshot.resolvedPrediction?.letter ?? '—'}</span>
            </div>

            <div className="mt-3 rounded-2xl bg-white/8 p-3 text-xs text-zinc-200">
              <p className="font-semibold text-white">Calidad mano</p>
              <div className="mt-2 space-y-1 font-mono">
                <p>reliable:{debugSnapshot.handQuality?.reliable ? '1' : '0'} status:{debugSnapshot.handQuality?.status ?? '—'} score:{debugSnapshot.handQuality?.qualityScore?.toFixed(3) ?? '—'}</p>
                <p>edges:{debugSnapshot.handQuality?.edgeTouches ?? '—'} area:{debugSnapshot.handQuality?.area?.toFixed(3) ?? '—'}</p>
                <p>stablePose:{debugSnapshot.staticPose?.stable ? '1' : '0'} frames:{debugSnapshot.staticPose?.sampleCount ?? 0}</p>
                <p>move:{debugSnapshot.staticPose?.travel?.toFixed(3) ?? '—'} rx:{debugSnapshot.staticPose?.rangeX?.toFixed(3) ?? '—'} ry:{debugSnapshot.staticPose?.rangeY?.toFixed(3) ?? '—'}</p>
                <p>hands:{debugSnapshot.handCount ?? 1}</p>
                <p>caja: verde=usable amarillo=marginal rojo=mala calidad</p>
                <p>motivo: {debugSnapshot.handQuality?.reasons?.length ? debugSnapshot.handQuality.reasons.map(formatQualityReason).join(', ') : 'ok'}</p>
              </div>
            </div>

            <div className="mt-3 rounded-2xl bg-white/8 p-3 text-xs text-zinc-200">
              <p className="font-semibold text-white">Dedos extendidos</p>
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
                motor:{debugSnapshot.classifierState?.method ?? '—'} vec:{formatTopCandidates(debugSnapshot.classifierState?.staticTop)}
              </p>
              <p className="mt-2 font-mono">
                db:{formatTopCandidates(debugSnapshot.classifierState?.knnTop)}
              </p>
              <p className="mt-2 font-mono">
                margin:{debugSnapshot.controlState?.margin?.toFixed(3) ?? '—'} release:{debugSnapshot.controlState?.awaitingRelease ? '1' : '0'} lock:{debugSnapshot.controlState?.gestureLocked ? '1' : '0'}
              </p>
              <p className="mt-2 font-mono">
                gap_IM:{debugSnapshot.featureState?.gapIM?.toFixed(3) ?? '—'} crossed_IM:{debugSnapshot.featureState?.crossedIM ? '1' : '0'} thumb_role:{debugSnapshot.featureState?.thumbRole ?? '—'} palm:{debugSnapshot.featureState?.palmOrientation ?? '—'}
              </p>
              <p className="mt-2 font-mono text-amber-200">
                2o fallo:{debugSnapshot.classification?.topCandidates?.[1]?.failedRule ?? '—'}
              </p>
            </div>

            <div className="mt-3 rounded-2xl bg-white/8 p-3 text-xs text-zinc-200">
              <p className="font-semibold text-white">Ejes / orientacion</p>
              <div className="mt-2 space-y-1 font-mono">
                <p>camDir:{formatDirectionMap(debugSnapshot.directionState?.camera)}</p>
                <p>locDir:{formatDirectionMap(debugSnapshot.directionState?.local)}</p>
                <p>camVec:{formatFingerVectors(debugSnapshot.directionState?.cameraVectors)}</p>
                <p>locVec:{formatFingerVectors(debugSnapshot.directionState?.localVectors)}</p>
                <p>axisX:{formatVector2(debugSnapshot.directionState?.screenAxes?.x)} axisY:{formatVector2(debugSnapshot.directionState?.screenAxes?.y)}</p>
                <p>normal:{formatVector3(debugSnapshot.directionState?.palmNormal)}</p>
              </div>
            </div>

            <div className="mt-3 rounded-2xl bg-white/8 p-3 text-xs text-zinc-200">
              <p className="font-semibold text-white">Gestos / lexico</p>
              <div className="mt-2 space-y-1 font-mono">
                <p>nearHead:{currentGestureFrame?.nearHead ? '1' : '0'} twoFinger:{currentGestureFrame?.twoFingerHandshape ? '1' : '0'}</p>
                <p>palmFacing:{currentGestureFrame?.palmFacingCamera ? '1' : '0'} score:{currentGestureFrame?.palmFacingScore?.toFixed(3) ?? '—'}</p>
                <p>ratioHead:{gestureDebug?.nearHeadRatio?.toFixed(2) ?? '—'} ratio2F:{gestureDebug?.twoFingerRatio?.toFixed(2) ?? '—'}</p>
                <p>ratioPalm:{gestureDebug?.palmFacingRatio?.toFixed(2) ?? '—'} ratioOk:{gestureDebug?.reliableRatio?.toFixed(2) ?? '—'}</p>
                <p>rangeX:{gestureDebug?.recentRangeX?.toFixed(3) ?? '—'} hands2:{gestureDebug?.twoHandsRatio?.toFixed(2) ?? '—'} frames:{gestureDebug?.frameCount ?? 0} suppress:{gestureDebug?.suppressStatic ? '1' : '0'}</p>
                {gestureDebug?.detectionDebug && (
                  <p className="text-emerald-200">
                    detectado metodo:{gestureDebug.detectionDebug?.method ?? 'heur'} boost:{gestureDebug.detectionDebug?.boosted ? '1' : '0'} dist:{gestureDebug.detectionDebug?.minDistance?.toFixed(3) ?? '—'} swing:{gestureDebug.detectionDebug?.maxSwingAmplitude?.toFixed(3) ?? '—'}
                  </p>
                )}
                {gestureDebug?.detectionDebug?.topModelCandidates?.length > 0 && (
                  <p className="text-sky-200">
                    model:{formatTopCandidates(
                      gestureDebug.detectionDebug.topModelCandidates.map((candidate) => ({
                        letter: candidate.gesture,
                        confidence: candidate.confidence,
                      }))
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      )}

      <div
        className="absolute inset-x-0 bottom-0 z-10 px-4"
        style={{ paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${mobileBottomOffset})` }}
      >
        <div className="mx-auto max-w-4xl rounded-[1.25rem] border border-white/10 bg-black/50 p-3 backdrop-blur-xl sm:rounded-[2rem] sm:p-4">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-zinc-300">{mainPanelTitle}</p>
              {isVoiceToSignMode ? (
                <>
                  <p className="font-readable mt-2 text-sm font-medium text-zinc-300 sm:text-base">
                    {voiceLiveSource || 'Esperando voz...'}
                  </p>
                  {voiceInterim && (
                    <p className="mt-2 text-xs text-cyan-200">
                      Capturando en tiempo real...
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="mt-1 text-base font-semibold tracking-[0.24em] text-white sm:text-lg sm:tracking-[0.28em]">
                    {formatSpelledWord(wordBuffer)}
                  </p>
                  {liveDecodedWord?.changed && (
                    <p className="mt-2 text-xs text-emerald-200">
                      Interpretando "{liveDecodedWord.normalized}" como "{liveDecodedWord.corrected}"
                    </p>
                  )}
                  {lastGestureWord && currentDetectionType === 'gesture' && (
                    <p className="mt-2 text-xs text-sky-200">
                      Gesto reconocido: "{lastGestureWord}"
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-zinc-300 sm:text-right">
              {isVoiceToSignMode ? (
                <>
                  <p>{speechListening ? 'Microfono activo' : 'Microfono en pausa'}</p>
                  <p className="mt-1 text-zinc-400">Salida visual por deletreo legible</p>
                </>
              ) : (
                <>
                  <p>{handPresent ? 'Mano visible' : 'Sin mano'}</p>
                  <p className="mt-1 text-zinc-400">Se habla automaticamente al cerrar palabra</p>
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {(isVoiceToSignMode ? recentVoiceLines : recentLines).map((line, index) => (
              <p key={`${line}-${index}`} className="text-xs text-zinc-400 sm:text-sm">
                {line}
              </p>
            ))}

            {isVoiceToSignMode ? (
              <div className="min-h-[3.5rem]">
                <VoiceToSignPreview
                  text={voiceLiveSource}
                  compact={isCompactViewport}
                  placeholder="El deletreo visual aparecera aqui cuando detectemos la voz."
                />
              </div>
            ) : (
              <>
                <p className="min-h-[2.5rem] text-xl font-semibold leading-tight text-white sm:text-3xl">
                  {liveSubtitle || 'Los subtitulos apareceran aqui en cuanto detectemos la mano.'}
                </p>

                {lastDecodedWord?.changed && (
                  <p className="text-xs text-emerald-200">
                    Ultima correccion: "{lastDecodedWord.normalized}" {'->'} "{lastDecodedWord.corrected}"
                  </p>
                )}
              </>
            )}
          </div>

          {(cameraError || (!isVoiceToSignMode && detectionError) || ttsError || speechError) && (
            <div className="mt-4 space-y-2 text-sm">
              {cameraError && (
                <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-200">
                  {cameraError}
                </p>
              )}
              {!isVoiceToSignMode && detectionError && (
                <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-200">
                  Error del modelo: {detectionError}
                </p>
              )}
              {ttsError && (
                <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-100">
                  Audio: {ttsError}
                </p>
              )}
              {speechError && (
                <p className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-cyan-100">
                  Voz a señas: {speechError}
                </p>
              )}
            </div>
          )}

          {isCompactViewport && (
            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={toggleTranslationMode}
                className="font-readable w-full rounded-full border border-emerald-400/30 bg-emerald-500/12 px-4 py-3 text-sm font-semibold text-emerald-100 shadow-lg transition active:scale-95 touch-manipulation"
              >
                {modeToggleLabel}
              </button>

              <div className={`grid gap-3 ${isAdmin && !isVoiceToSignMode ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {isAdmin && !isVoiceToSignMode && (
                  <button
                    type="button"
                    onClick={() => setShowDebug((prev) => !prev)}
                    className="rounded-full border border-cyan-400/30 bg-black/60 px-4 py-3 text-sm font-semibold text-cyan-100 shadow-lg transition active:scale-95 touch-manipulation"
                  >
                    {showDebug ? 'Ocultar debug' : 'Mostrar debug'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={toggleTranslation}
                  className={`rounded-full px-4 py-3 text-sm font-semibold shadow-lg transition active:scale-95 touch-manipulation ${
                    isActive ? 'bg-red-500 text-white' : 'bg-brand-500 text-white'
                  }`}
                >
                  {startActionLabel}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {!isCompactViewport && (
        <>
          <div
            className="absolute right-3 z-20 flex flex-col gap-3 sm:right-4"
            style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + ${mobileBottomOffset})` }}
          >
            <button
              type="button"
              onClick={toggleTranslationMode}
              className="font-readable rounded-full border border-emerald-400/30 bg-emerald-500/12 px-4 py-3 text-sm font-semibold text-emerald-100 shadow-2xl transition active:scale-95 touch-manipulation sm:px-5 sm:py-4"
            >
              {modeToggleLabel}
            </button>

            <button
              type="button"
              onClick={toggleTranslation}
              className={`rounded-full px-4 py-3 text-sm font-semibold shadow-2xl transition active:scale-95 touch-manipulation sm:px-5 sm:py-4 ${
                isActive
                  ? 'bg-red-500 text-white'
                  : 'bg-brand-500 text-white'
              }`}
            >
              {startActionLabel}
            </button>
          </div>

          {isAdmin && !isVoiceToSignMode && (
            <button
              type="button"
              onClick={() => setShowDebug((prev) => !prev)}
              className="absolute left-3 z-20 rounded-full border border-cyan-400/30 bg-black/60 px-4 py-3 text-sm font-semibold text-cyan-100 shadow-2xl transition active:scale-95 touch-manipulation sm:left-4 sm:px-5 sm:py-4"
              style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + ${mobileBottomOffset})` }}
            >
              {showDebug ? 'Ocultar debug' : 'Mostrar debug'}
            </button>
          )}
        </>
      )}

      <button
        type="button"
        onClick={() => navigate('/')}
        className="absolute right-3 top-3 z-20 rounded-full border border-white/15 bg-black/60 px-4 py-2 text-sm font-medium text-white shadow-xl backdrop-blur-md transition active:scale-95 touch-manipulation sm:right-4 sm:top-4"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        Salir
      </button>
    </section>
  )
}
