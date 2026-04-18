import { useState, useRef, useEffect, useCallback } from 'react'
import {
  assessHandDetectionQuality,
  buildFrameHandModel,
  clearTemplates,
  deleteTemplateById,
  extractHandMetrics,
  getTemplates,
  hydrateTemplatesFromServer,
  saveTemplate,
  SIGN_LEXICON_WORDS,
} from '@signbridge/sign-engine'
import { useHandDetection } from '../../hooks/useHandDetection.js'
import { requestCameraStream, stopCameraStream } from '../../utils/cameraStream.js'
import { requestPracticeFeedback } from '../practice/practiceClient.js'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
<<<<<<< HEAD
const DYNAMIC_GESTURES = [
  'hola',
  'gracias',
  'dolor',
  'ayuda',
  'agua',
  'sí',
  'no',
  'nombre',
=======
const DYNAMIC_GESTURES = SIGN_LEXICON_WORDS.map((entry) => entry.word)
const GEMINI_AUTO_SAVE_SCORE = 85
const FINGER_TIPS = [
  { key: 'T', label: 'Pulgar', index: 4, color: '#fb923c' },
  { key: 'I', label: 'Indice', index: 8, color: '#34d399' },
  { key: 'M', label: 'Medio', index: 12, color: '#38bdf8' },
  { key: 'R', label: 'Anular', index: 16, color: '#c084fc' },
  { key: 'P', label: 'Menique', index: 20, color: '#f472b6' },
]
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
>>>>>>> origin/main
]

function formatQualityStatus(status) {
  if (status === 'good') return 'verde'
  if (status === 'fair') return 'amarillo'
  return 'rojo'
}

function formatQualityReason(reason) {
  switch (reason) {
    case 'mano_recortada':
      return 'mano recortada'
    case 'mano_pequena':
      return 'mano lejana'
    case 'poco_ancho':
      return 'mano angosta'
    case 'poco_alto':
      return 'mano baja'
    case 'landmarks_inestables':
      return 'landmarks inestables'
    case 'sin_landmarks':
      return 'sin landmarks'
    default:
      return reason
  }
}

function getHandQualityStroke(handQuality) {
  if (!handQuality || handQuality.status === 'poor') {
    return {
      stroke: 'rgba(239, 68, 68, 0.95)',
      fill: 'rgba(239, 68, 68, 0.08)',
    }
  }

  if (handQuality.status === 'fair') {
    return {
      stroke: 'rgba(245, 158, 11, 0.95)',
      fill: 'rgba(245, 158, 11, 0.08)',
    }
  }

  return {
    stroke: 'rgba(34, 197, 94, 0.95)',
    fill: 'rgba(34, 197, 94, 0.08)',
  }
}

function captureVideoFrame(video) {
  if (!video?.videoWidth || !video?.videoHeight) return null

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.92)
}

function buildCanonicalSignature(points) {
  if (!Array.isArray(points) || points.length !== 21) return ''
  return points
    .flatMap((point) => [point.x, point.y, point.z || 0])
    .map((value) => Number(value).toFixed(3))
    .join('|')
}

function formatTopCandidates(candidates = []) {
  if (!candidates.length) return '—'

  return candidates
    .slice(0, 3)
    .map((candidate) => `${candidate.letter}:${candidate.confidence.toFixed(2)}`)
    .join(' ')
}

function vectorToCanonicalPoints(vector) {
  if (!Array.isArray(vector) || vector.length < 63) return null

  const points = []
  for (let index = 0; index < 21; index += 1) {
    points.push({
      x: Number(vector[index * 3]) || 0,
      y: Number(vector[(index * 3) + 1]) || 0,
      z: Number(vector[(index * 3) + 2]) || 0,
    })
  }
  return points
}

function averageStaticTemplates(samples) {
  const staticTemplates = (samples ?? [])
    .filter((sample) => sample.type === 'static' && Array.isArray(sample.vector))
    .map((sample) => vectorToCanonicalPoints(sample.vector))
    .filter(Boolean)

  if (!staticTemplates.length) return null

  return staticTemplates[0].map((_, pointIndex) => {
    const averaged = { x: 0, y: 0, z: 0 }

    staticTemplates.forEach((template) => {
      averaged.x += template[pointIndex].x
      averaged.y += template[pointIndex].y
      averaged.z += template[pointIndex].z || 0
    })

    const total = staticTemplates.length
    return {
      x: averaged.x / total,
      y: averaged.y / total,
      z: averaged.z / total,
    }
  })
}

function summarizeCanonicalPose(points) {
  if (!Array.isArray(points) || points.length !== 21) return null

  return {
    tips: FINGER_TIPS.map((finger) => {
      const point = points[finger.index]
      return {
        ...finger,
        x: point.x,
        y: point.y,
        z: point.z || 0,
        radius: Math.hypot(point.x, point.y),
      }
    }),
    pinchTI: Math.hypot(points[4].x - points[8].x, points[4].y - points[8].y),
    pinchTM: Math.hypot(points[4].x - points[12].x, points[4].y - points[12].y),
    gapIM: Math.abs(points[8].x - points[12].x),
    gapMR: Math.abs(points[12].x - points[16].x),
    curls: {
      T: points[2].y - points[4].y,
      I: points[5].y - points[8].y,
      M: points[9].y - points[12].y,
      R: points[13].y - points[16].y,
      P: points[17].y - points[20].y,
    },
  }
}

function toPoseChartPoint(point, size, domain, padding = 18) {
  const half = size / 2
  const renderRadius = half - padding

  return {
    x: half + ((point.x / domain) * renderRadius),
    y: half - ((point.y / domain) * renderRadius),
  }
}

function PalmPoseChart({ currentPoints, referencePoints }) {
  const size = 260
  const allPoints = [...(referencePoints ?? []), ...(currentPoints ?? [])]

  if (!allPoints.length) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/60 text-sm text-zinc-500">
        Sin landmarks normalizados todavía.
      </div>
    )
  }

  const maxAbs = allPoints.reduce((acc, point) => (
    Math.max(acc, Math.abs(point.x), Math.abs(point.y))
  ), 0.6)
  const domain = Math.max(0.7, maxAbs * 1.2)

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="h-[260px] w-full rounded-2xl border border-white/10 bg-zinc-950/80"
      role="img"
      aria-label="Mapa normalizado de la mano"
    >
      <rect x="0" y="0" width={size} height={size} rx="18" fill="rgba(9, 9, 11, 0.95)" />

      {[0.25, 0.5, 0.75].map((ratio) => (
        <g key={ratio} opacity="0.2">
          <line x1={size * ratio} y1="16" x2={size * ratio} y2={size - 16} stroke="#52525b" strokeWidth="1" />
          <line x1="16" y1={size * ratio} x2={size - 16} y2={size * ratio} stroke="#52525b" strokeWidth="1" />
        </g>
      ))}

      <line x1={size / 2} y1="14" x2={size / 2} y2={size - 14} stroke="#0ea5e9" strokeWidth="1.5" strokeDasharray="5 5" opacity="0.8" />
      <line x1="14" y1={size / 2} x2={size - 14} y2={size / 2} stroke="#0ea5e9" strokeWidth="1.5" strokeDasharray="5 5" opacity="0.8" />
      <circle cx={size / 2} cy={size / 2} r="4" fill="#f8fafc" />
      <text x={size / 2 + 8} y={size / 2 - 8} fill="#f8fafc" fontSize="11" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
        palm (0,0)
      </text>

      {referencePoints && HAND_CONNECTIONS.map(([from, to]) => {
        const start = toPoseChartPoint(referencePoints[from], size, domain)
        const end = toPoseChartPoint(referencePoints[to], size, domain)

        return (
          <line
            key={`ref-${from}-${to}`}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke="#22d3ee"
            strokeWidth="2"
            opacity="0.5"
          />
        )
      })}

      {currentPoints && HAND_CONNECTIONS.map(([from, to]) => {
        const start = toPoseChartPoint(currentPoints[from], size, domain)
        const end = toPoseChartPoint(currentPoints[to], size, domain)

        return (
          <line
            key={`cur-${from}-${to}`}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke="#4ade80"
            strokeWidth="2.4"
            opacity="0.88"
          />
        )
      })}

      {referencePoints && FINGER_TIPS.map((finger) => {
        const point = toPoseChartPoint(referencePoints[finger.index], size, domain)
        return (
          <circle
            key={`ref-tip-${finger.key}`}
            cx={point.x}
            cy={point.y}
            r="5.5"
            fill="none"
            stroke={finger.color}
            strokeWidth="2"
            opacity="0.95"
          />
        )
      })}

      {currentPoints && FINGER_TIPS.map((finger) => {
        const point = toPoseChartPoint(currentPoints[finger.index], size, domain)
        return (
          <g key={`cur-tip-${finger.key}`}>
            <circle cx={point.x} cy={point.y} r="5" fill={finger.color} opacity="0.98" />
            <text
              x={point.x + 7}
              y={point.y - 7}
              fill={finger.color}
              fontSize="11"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            >
              {finger.key}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function TrainingPage() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const lastAutoSavedSignatureRef = useRef('')
  
  const [mode, setMode] = useState('static') // 'static' or 'dynamic'
  const [selectedLetter, setSelectedLetter] = useState('A')
  const [selectedGesture, setSelectedGesture] = useState('hola')
  
  const [templates, setTemplates] = useState({})
  
  // Real-time
  const [currentCanonical, setCurrentCanonical] = useState(null)
  const [handQuality, setHandQuality] = useState(null)
  const [featureSummary, setFeatureSummary] = useState(null)
  const [liveMetrics, setLiveMetrics] = useState(null)
  
  // Recording
  const [isRecording, setIsRecording] = useState(false)
  const recordingBufferRef = useRef([])
  const [message, setMessage] = useState('')
  const [geminiFeedback, setGeminiFeedback] = useState(null)
  const [isReviewing, setIsReviewing] = useState(false)

  const activeLabel = mode === 'static' ? selectedLetter : selectedGesture

  const handleLandmarks = useCallback((landmarks, frameMeta = {}) => {
    const worldLandmarks = frameMeta.handWorldLandmarks
    const handMetrics = extractHandMetrics(landmarks, {
      handWorldLandmarks: worldLandmarks,
      handsCount: frameMeta.handsCount ?? 1,
    })
    const features = handMetrics?.features
    const quality = assessHandDetectionQuality(landmarks)
    setHandQuality(quality)
    
    if (features) {
      setCurrentCanonical(features.points)
      setLiveMetrics(handMetrics)
      setFeatureSummary({
        thumbRole: features.thumb_role,
        gapIM: Number(features.gap_IM.toFixed(3)),
        crossedIM: features.crossed_IM,
        palmOrientation: features.palm_orientation,
        cameraDirections: features.camera_directions,
      })
      
      // Si estamos grabando secuencia dinámica
      if (isRecording) {
<<<<<<< HEAD
        // Solo guardamos lo que necesita el clasificador DTW (canonical, palmCenter, faceAnchor).
        // No se almacenan los landmarks crudos de MediaPipe para evitar valores NaN/Infinity
        // en la coordenada z que rompen la serialización JSON.
        recordingBufferRef.current.push({
          canonical: features.points.map(p => ({ x: p.x, y: p.y, z: p.z ?? 0 })),
          palmCenter: { x: features.palmCenter.x, y: features.palmCenter.y, z: features.palmCenter.z ?? 0 },
          faceAnchor: frameMeta.faceAnchor || null,
=======
        const frameModel = buildFrameHandModel(landmarks, frameMeta)
        recordingBufferRef.current.push({
          landmarks,
          canonical: features.points,
          palmCenter: features.palmCenter,
          faceAnchor: frameMeta.faceAnchor || null,
          handCount: frameMeta.handsCount ?? 1,
          secondaryPalmCenter: frameMeta.secondaryPalmCenter ?? null,
          frameModel,
>>>>>>> origin/main
        })
      }
      
      drawFeatures(frameMeta.hands ?? null, frameMeta.faceAnchor, quality, canvasRef.current, videoRef.current)
    } else {
      setCurrentCanonical(null)
      setFeatureSummary(null)
      setLiveMetrics(null)
      drawFeatures(frameMeta.hands ?? null, frameMeta.faceAnchor, quality, canvasRef.current, videoRef.current)
    }
  }, [isRecording])

  const { videoRef: hookVideoRef, ready } = useHandDetection({
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
        .catch(console.error)
    }

    return () => {
      mounted = false
      stopCameraStream(streamRef)
    }
  }, [hookVideoRef])

  useEffect(() => {
    let active = true

    hydrateTemplatesFromServer()
      .then((dataset) => {
        if (active) setTemplates(dataset)
      })
      .catch((error) => {
        console.error('[Training] No se pudo hidratar dataset desde MongoDB:', error)
        if (active) {
          setTemplates(getTemplates())
          setMessage('Usando cache local; no se pudo sincronizar con MongoDB.')
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    setTemplates(getTemplates())
  }, [mode])

  // Cambiar modo limpia la UI
  useEffect(() => {
    setMessage('')
    setGeminiFeedback(null)
  }, [mode, selectedLetter, selectedGesture])

  const saveStaticSampleWithMetadata = useCallback(async (metadata = {}, successMessage = null) => {
    if (!currentCanonical) {
      setMessage('No se detecta mano en cámara')
      return null
    }

    const savedSample = await saveTemplate(selectedLetter, currentCanonical, false, metadata)
    if (savedSample) {
      setTemplates(getTemplates())
      if (successMessage) {
        setMessage(successMessage)
        setTimeout(() => setMessage(''), 2400)
      }
    }

    return savedSample
  }, [currentCanonical, selectedLetter])

  const handleReviewWithGemini = async () => {
    if (mode !== 'static') {
      setMessage('Gemini por ahora solo revisa letras estaticas.')
      setTimeout(() => setMessage(''), 2200)
      return
    }

    const imageBase64 = captureVideoFrame(videoRef.current)
    if (!imageBase64) {
      setMessage('No pude capturar la imagen actual.')
      setTimeout(() => setMessage(''), 2200)
      return
    }

    setIsReviewing(true)
    setGeminiFeedback(null)

    try {
      const result = await requestPracticeFeedback({
        imageBase64,
        targetSign: selectedLetter,
        targetType: 'letter',
        handCount: 1,
        handQuality,
        featureSummary,
      })

      setGeminiFeedback(result)
      const geminiMetadata = {
        validationSource: 'gemini',
        validated: Boolean(result.usableForTraining),
        gemini: {
          correct: Boolean(result.correct),
          score: Number(result.score) || 0,
          feedback: result.feedback,
          usableForTraining: Boolean(result.usableForTraining),
          issues: Array.isArray(result.issues) ? result.issues : [],
          recommendation: result.recommendation,
        },
      }

      const currentSignature = buildCanonicalSignature(currentCanonical)
      const shouldAutoSave =
        result.usableForTraining &&
        Number(result.score) >= GEMINI_AUTO_SAVE_SCORE &&
        currentSignature &&
        currentSignature !== lastAutoSavedSignatureRef.current

      if (shouldAutoSave) {
        await saveStaticSampleWithMetadata(
          geminiMetadata,
          `Gemini validó la muestra (${result.score}/100) y se guardó automáticamente.`
        )
        lastAutoSavedSignatureRef.current = currentSignature
      } else {
        setMessage(
          result.usableForTraining
            ? `Gemini la considera útil (${result.score}/100), pero no alcanzó el auto-guardado.`
            : 'Gemini recomienda ajustar la pose antes de guardar.'
        )
        setTimeout(() => setMessage(''), 2600)
      }
    } catch (error) {
      console.error('[Training] Gemini review error:', error)
      setMessage('No se pudo revisar con Gemini.')
      setTimeout(() => setMessage(''), 2200)
    } finally {
      setIsReviewing(false)
    }
  }

  const handleCaptureStatic = async () => {
    try {
      await saveStaticSampleWithMetadata(
        geminiFeedback
          ? {
              validationSource: 'gemini',
              validated: Boolean(geminiFeedback.usableForTraining),
              gemini: {
                correct: Boolean(geminiFeedback.correct),
                score: Number(geminiFeedback.score) || 0,
                feedback: geminiFeedback.feedback,
                usableForTraining: Boolean(geminiFeedback.usableForTraining),
                issues: Array.isArray(geminiFeedback.issues) ? geminiFeedback.issues : [],
                recommendation: geminiFeedback.recommendation,
              },
            }
          : {},
        `¡Molde estático guardado en MongoDB para '${selectedLetter}'!`
      )
    } catch (error) {
      console.error('[Training] Error guardando molde estático:', error)
      setMessage('No se pudo guardar en MongoDB.')
      setTimeout(() => setMessage(''), 2500)
    }
  }

  const handleCaptureDynamic = async () => {
    setMessage('GRABANDO... (2 seg)')
    setIsRecording(true)
    recordingBufferRef.current = []
    
    // Graba por 2 segundos
    setTimeout(async () => {
      setIsRecording(false)
      const rawFrames = recordingBufferRef.current
      if (rawFrames.length > 5) {
        // Submuestrear a máximo 20 frames para reducir payload (DTW no necesita más)
        const MAX_FRAMES = 20
        const frames = rawFrames.length <= MAX_FRAMES
          ? rawFrames
          : Array.from({ length: MAX_FRAMES }, (_, i) =>
              rawFrames[Math.round(i * (rawFrames.length - 1) / (MAX_FRAMES - 1))]
            )
        try {
          await saveTemplate(selectedGesture, frames, true)
          setTemplates(getTemplates())
          setMessage(`¡Secuencia guardada en MongoDB para '${selectedGesture}'! (${frames.length} frames)`)
        } catch (error) {
          console.error('[Training] Error guardando secuencia:', error)
          setMessage(`Error al guardar: ${error?.message ?? 'fallo de red o servidor no disponible'}`)
        }
      } else {
        setMessage('Error: no se detectó suficiente movimiento de mano.')
      }
      setTimeout(() => setMessage(''), 2500)
    }, 2000)
  }

  const handleCapture = mode === 'static' ? handleCaptureStatic : handleCaptureDynamic

  const handleDelete = async (id) => {
    try {
      await deleteTemplateById(activeLabel, id)
      const fresh = await hydrateTemplatesFromServer()
      setTemplates(fresh)
    } catch (error) {
      console.error('[Training] Error borrando muestra:', error)
      setMessage('No se pudo borrar la muestra en MongoDB.')
      setTimeout(() => setMessage(''), 2500)
    }
  }

  const handleClearLetter = async () => {
    try {
      await clearTemplates(activeLabel)
      const fresh = await hydrateTemplatesFromServer()
      setTemplates(fresh)
    } catch (error) {
      console.error('[Training] Error limpiando dataset de la letra:', error)
      setMessage('No se pudo limpiar la letra en MongoDB.')
      setTimeout(() => setMessage(''), 2500)
    }
  }

  const referenceCanonical = mode === 'static'
    ? averageStaticTemplates(templates[selectedLetter])
    : null
  const livePoseSummary = mode === 'static'
    ? summarizeCanonicalPose(currentCanonical)
    : null
  const referencePoseSummary = mode === 'static'
    ? summarizeCanonicalPose(referenceCanonical)
    : null
  const selectedStaticTemplateCount = mode === 'static'
    ? (templates[selectedLetter] ?? []).filter((sample) => sample.type === 'static').length
    : 0

  return (
    <div className="min-h-[calc(100dvh-65px)] bg-zinc-950 text-white lg:flex lg:overflow-hidden">
      {/* Visualización de Cámara */}
      <div className="relative flex min-h-[42dvh] items-center justify-center bg-black lg:min-h-[calc(100dvh-65px)] lg:flex-1">
        <video 
          ref={videoRef} 
          className="absolute inset-0 w-full h-full object-contain transform scale-x-[-1]" 
          playsInline muted 
        />
        <canvas 
          ref={canvasRef} 
          className="absolute inset-0 w-full h-full object-contain pointer-events-none transform scale-x-[-1]"
        />
        {(!ready) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
            <span className="text-zinc-400">Cargando MediaPipe...</span>
          </div>
        )}
        {isRecording && (
          <div className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-lg animate-pulse sm:px-6">
            <div className="w-3 h-3 rounded-full bg-white"></div>
            Grabando...
          </div>
        )}
        <div className="absolute left-3 right-3 top-3 z-20 rounded-2xl border border-white/10 bg-black/65 px-4 py-3 text-[11px] text-white backdrop-blur-xl sm:left-4 sm:right-auto sm:max-w-xs sm:text-xs">
          <p className="font-semibold uppercase tracking-[0.2em] text-cyan-200">Calidad mano</p>
          <p className="mt-2 font-mono">
            caja:{formatQualityStatus(handQuality?.status)} usable:{handQuality?.reliable ? '1' : '0'} score:{handQuality?.qualityScore?.toFixed(2) ?? '—'}
          </p>
          <p className="mt-1 text-zinc-300">
            {handQuality?.reasons?.length
              ? handQuality.reasons.map(formatQualityReason).join(', ')
              : 'mano estable y lista para capturar'}
          </p>
        </div>
      </div>

      {/* Controles de Entrenamiento */}
      <div className="flex w-full flex-col gap-6 border-t border-zinc-800 bg-zinc-900 p-4 sm:p-6 lg:w-[26rem] lg:max-h-[calc(100dvh-65px)] lg:border-l lg:border-t-0 lg:overflow-y-auto">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Entrenamiento Mapeo</h2>
          <p className="text-zinc-400 text-sm">
            Toma fotos de tu gesto para crear un molde anatómico (KNN / DTW).
          </p>
        </div>
        
        {/* Switcher de Modalidad */}
        <div className="flex bg-zinc-800 rounded p-1">
          <button 
            onClick={() => setMode('static')} 
            className={`flex-1 text-sm font-bold py-2 rounded transition-colors ${mode === 'static' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            Letras (Estático)
          </button>
          <button 
            onClick={() => setMode('dynamic')} 
            className={`flex-1 text-sm font-bold py-2 rounded transition-colors ${mode === 'dynamic' ? 'bg-brand-600 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            Palabras (Movimiento)
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Selecciona {mode === 'static' ? 'Letra' : 'Gesto'} a Entrenar
          </label>
          <div className="flex flex-wrap gap-2">
            {mode === 'static' ? (
              ALPHABET.map((l) => (
                <button
                  key={l}
                  onClick={() => setSelectedLetter(l)}
                  className={`w-10 h-10 rounded font-bold flex items-center justify-center transition-colors
                    ${selectedLetter === l ? 'bg-brand-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                >
                  {l}
                </button>
              ))
            ) : (
              DYNAMIC_GESTURES.map((g) => (
                <button
                  key={g}
                  onClick={() => setSelectedGesture(g)}
                  className={`px-4 h-10 rounded font-bold flex items-center justify-center transition-colors
                    ${selectedGesture === g ? 'bg-brand-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                >
                  {g.toUpperCase()}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleCapture}
            disabled={((!currentCanonical || !handQuality?.reliable) && mode === 'static') || isRecording}
            className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2
              ${(((currentCanonical && handQuality?.reliable) || mode === 'dynamic') && !isRecording)
                ? (mode === 'static' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-brand-600 hover:bg-brand-500 text-white')
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
          >
            {mode === 'static' ? '📸 Capturar Molde (Foto)' : '🎥 Grabar 2s de Señal'}
          </button>

          <button
            onClick={handleReviewWithGemini}
            disabled={mode !== 'static' || !currentCanonical || !handQuality?.reliable || isRecording || isReviewing}
            className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 ${
              mode === 'static' && currentCanonical && handQuality?.reliable && !isRecording && !isReviewing
                ? 'border border-cyan-400/20 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/15'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            }`}
          >
            {isReviewing ? '✨ Analizando con Gemini...' : '✨ Revisar con Gemini'}
          </button>
          
          {message && <div className="text-center text-emerald-400 text-sm mt-1">{message}</div>}
        </div>

        {geminiFeedback && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-200">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Feedback Gemini</h3>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                geminiFeedback.correct
                  ? 'bg-emerald-500/20 text-emerald-200'
                  : 'bg-rose-500/20 text-rose-200'
              }`}>
                {geminiFeedback.score}/100
              </span>
            </div>
            <p className="mt-3">{geminiFeedback.feedback}</p>
            <p className="mt-2 text-xs text-zinc-400">
              usableForTraining: {geminiFeedback.usableForTraining ? 'si' : 'no'}
            </p>
            {geminiFeedback.issues?.length > 0 && (
              <p className="mt-2 text-xs text-zinc-400">
                issues: {geminiFeedback.issues.join(', ')}
              </p>
            )}
            <p className="mt-2 text-xs text-cyan-200">
              siguiente ajuste: {geminiFeedback.recommendation}
            </p>
          </div>
        )}

        {mode === 'static' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-200">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-white">Mapa Normalizado</h3>
                <span className="rounded-full bg-sky-500/15 px-3 py-1 text-[11px] font-semibold text-sky-200">
                  {selectedStaticTemplateCount} moldes estaticos
                </span>
              </div>
              <p className="mt-2 text-xs text-zinc-400">
                La palma es el origen fijo. Verde = pose actual. Cian = promedio guardado para {selectedLetter}.
              </p>
              <div className="mt-4">
                <PalmPoseChart currentPoints={currentCanonical} referencePoints={referenceCanonical} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-zinc-300">
                <span className="rounded-xl bg-emerald-500/10 px-3 py-2">Actual: landmarks en vivo</span>
                <span className="rounded-xl bg-cyan-500/10 px-3 py-2">Referencia: promedio de tu dataset</span>
              </div>
              {livePoseSummary && (
                <div className="mt-3 space-y-1 font-mono text-xs text-zinc-300">
                  <p>pinchTI:{livePoseSummary.pinchTI.toFixed(3)} pinchTM:{livePoseSummary.pinchTM.toFixed(3)}</p>
                  <p>gapIM:{livePoseSummary.gapIM.toFixed(3)} gapMR:{livePoseSummary.gapMR.toFixed(3)}</p>
                  <p>curl T:{livePoseSummary.curls.T.toFixed(2)} I:{livePoseSummary.curls.I.toFixed(2)} M:{livePoseSummary.curls.M.toFixed(2)} R:{livePoseSummary.curls.R.toFixed(2)} P:{livePoseSummary.curls.P.toFixed(2)}</p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-200">
              <h3 className="font-semibold text-white">Coordenadas Palma = (0,0)</h3>
              <p className="mt-2 text-xs text-zinc-400">
                Esto es la version practica de tu idea: cada dedo vive en un punto relativo a la palma, no en pixeles absolutos.
              </p>
              {livePoseSummary ? (
                <div className="mt-3 space-y-2 font-mono text-xs">
                  {livePoseSummary.tips.map((finger) => {
                    const referenceFinger = referencePoseSummary?.tips.find((entry) => entry.key === finger.key) ?? null

                    return (
                      <div key={finger.key} className="rounded-xl bg-zinc-950/70 px-3 py-2">
                        <p style={{ color: finger.color }}>
                          {finger.key} {finger.label}: x:{finger.x.toFixed(2)} y:{finger.y.toFixed(2)} z:{finger.z.toFixed(2)} r:{finger.radius.toFixed(2)}
                        </p>
                        <p className="mt-1 text-zinc-400">
                          ref:{referenceFinger ? ` x:${referenceFinger.x.toFixed(2)} y:${referenceFinger.y.toFixed(2)} z:${referenceFinger.z.toFixed(2)}` : ' sin promedio aun'}
                        </p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="mt-3 text-xs text-zinc-500">Pon la mano frente a la camara para ver coordenadas.</p>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-200">
              <h3 className="font-semibold text-white">Lectura del Clasificador</h3>
              {liveMetrics ? (
                <div className="mt-3 space-y-2 font-mono text-xs text-zinc-300">
                  <p>fusion:{formatTopCandidates(liveMetrics.classification?.topCandidates)}</p>
                  <p>reglas:{formatTopCandidates(liveMetrics.classifiers?.static?.topCandidates)}</p>
                  <p>dataset:{formatTopCandidates(liveMetrics.classifiers?.knn?.topCandidates)}</p>
                  <p>motor:{liveMetrics.classification?.method ?? '—'} palm:{liveMetrics.relations?.palmOrientation ?? '—'} thumb:{liveMetrics.relations?.thumbRole ?? '—'}</p>
                  <p>gapIM:{liveMetrics.pairs?.indexMiddle?.gap?.toFixed(3) ?? '—'} crossed:{liveMetrics.relations?.crossedIM ? '1' : '0'} pinchTI:{liveMetrics.relations?.pinchTI?.toFixed(3) ?? '—'}</p>
                  <p className="text-amber-200">falla principal:{liveMetrics.classification?.topCandidates?.[0]?.failedRule ?? '—'}</p>
                </div>
              ) : (
                <p className="mt-3 text-xs text-zinc-500">Sin clasificacion local todavia.</p>
              )}
            </div>
          </div>
        )}

        <hr className="border-zinc-800" />

        <div className="flex-1">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-medium">Archivos para '{activeLabel}'</h3>
            <button onClick={handleClearLetter} className="text-xs text-red-400 hover:underline">Borrar todos</button>
          </div>
          
          <div className="space-y-2">
            {templates[activeLabel]?.length > 0 ? (
              templates[activeLabel].map((t, idx) => (
                <div key={t.id} className="flex items-center justify-between rounded bg-zinc-800/50 p-2 text-sm">
                  <div className="min-w-0">
                    <span className="text-zinc-300">
                      {t.type === 'sequence' ? `🎬 Clip DTW #${idx + 1}` : `🟢 Molde #${idx + 1}`}
                    </span>
                    {typeof t.metadata?.gemini?.score === 'number' && (
                      <p className="mt-1 text-xs text-zinc-400">
                        Gemini: {t.metadata.gemini.score}/100 {t.metadata?.validated ? 'valido' : 'sin validar'}
                      </p>
                    )}
                  </div>
                  <button onClick={() => handleDelete(t.id)} className="text-red-400 hover:text-red-300">🗑️</button>
                </div>
              ))
            ) : (
              <div className="text-zinc-500 text-sm text-center py-4 border border-dashed border-zinc-800 rounded">
                Aún no tienes registros para {activeLabel}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function updateCanvasProjection(canvas, video) {
  const width = canvas.offsetWidth
  const height = canvas.offsetHeight
  canvas.width = width
  canvas.height = height

  const sourceWidth = video?.videoWidth || width
  const sourceHeight = video?.videoHeight || height

  // object-contain means math.min
  const scale = Math.min(width / sourceWidth, height / sourceHeight)
  const renderWidth = sourceWidth * scale
  const renderHeight = sourceHeight * scale
  const offsetX = (width - renderWidth) / 2
  const offsetY = (height - renderHeight) / 2

  return { renderWidth, renderHeight, offsetX, offsetY }
}

function drawFeatures(hands, faceAnchor, handQuality, canvas, video) {
  if (!canvas || !video) return
  const ctx = canvas.getContext('2d')
  const proj = updateCanvasProjection(canvas, video)
  
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  
  // draw face
  if (faceAnchor) {
     const fx = proj.offsetX + (faceAnchor.left * proj.renderWidth)
     const fy = proj.offsetY + (faceAnchor.top * proj.renderHeight)
     const fw = faceAnchor.width * proj.renderWidth
     const fh = faceAnchor.height * proj.renderHeight

     ctx.strokeStyle = '#38bdf8' // sky blue
     ctx.setLineDash([5, 5])
     ctx.lineWidth = 2
     ctx.strokeRect(fx, fy, fw, fh)
     ctx.setLineDash([])
  }

  // draw hands
  if (hands?.length) {
      hands.forEach((hand, handIndex) => {
        const landmarks = hand.landmarks
        if (!landmarks) return

        const box = handIndex === 0 ? handQuality?.bbox : hand.bbox
        if (box) {
          const qualityStroke = handIndex === 0
            ? getHandQualityStroke(handQuality)
            : {
                stroke: 'rgba(96, 165, 250, 0.95)',
                fill: 'rgba(96, 165, 250, 0.08)',
              }

          const left = proj.offsetX + (box.minX * proj.renderWidth)
          const top = proj.offsetY + (box.minY * proj.renderHeight)
          const boxWidth = box.width * proj.renderWidth
          const boxHeight = box.height * proj.renderHeight

          ctx.fillStyle = qualityStroke.fill
          ctx.strokeStyle = qualityStroke.stroke
          ctx.lineWidth = 2
          ctx.fillRect(left, top, boxWidth, boxHeight)
          ctx.strokeRect(left, top, boxWidth, boxHeight)
        }

        ctx.fillStyle = handIndex === 0 ? '#10b981' : '#60a5fa'
        landmarks.forEach(l => {
          const x = proj.offsetX + (l.x * proj.renderWidth)
          const y = proj.offsetY + (l.y * proj.renderHeight)
          ctx.beginPath()
          ctx.arc(x, y, 4, 0, 2*Math.PI)
          ctx.fill()
        })
      })
  }
}
