import { useState, useRef, useEffect, useCallback } from 'react'
import { useHandDetection } from '../../hooks/useHandDetection.js'
import { extractHandFeatures } from '../translator/HandFeatureExtractor.js'
import { assessHandDetectionQuality } from '../translator/SignClassifier.js'
import {
  saveTemplate,
  getTemplates,
  clearTemplates,
  deleteTemplateById,
  hydrateTemplatesFromServer,
} from './KNNStorage.js'
import { requestCameraStream, stopCameraStream } from '../../utils/cameraStream.js'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const DYNAMIC_GESTURES = ['hola']

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

export default function TrainingPage() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  
  const [mode, setMode] = useState('static') // 'static' or 'dynamic'
  const [selectedLetter, setSelectedLetter] = useState('A')
  const [selectedGesture, setSelectedGesture] = useState('hola')
  
  const [templates, setTemplates] = useState({})
  
  // Real-time
  const [currentCanonical, setCurrentCanonical] = useState(null)
  const [handQuality, setHandQuality] = useState(null)
  
  // Recording
  const [isRecording, setIsRecording] = useState(false)
  const recordingBufferRef = useRef([])
  const [message, setMessage] = useState('')

  const activeLabel = mode === 'static' ? selectedLetter : selectedGesture

  const handleLandmarks = useCallback((landmarks, frameMeta = {}) => {
    const worldLandmarks = frameMeta.handWorldLandmarks
    const features = extractHandFeatures(landmarks, worldLandmarks)
    const quality = assessHandDetectionQuality(landmarks)
    setHandQuality(quality)
    
    if (features) {
      setCurrentCanonical(features.points)
      
      // Si estamos grabando secuencia dinámica
      if (isRecording) {
        recordingBufferRef.current.push({
          landmarks,
          canonical: features.points,
          palmCenter: features.palmCenter,
          faceAnchor: frameMeta.faceAnchor || null
        })
      }
      
      drawFeatures(landmarks, frameMeta.faceAnchor, quality, canvasRef.current, videoRef.current)
    } else {
      setCurrentCanonical(null)
      drawFeatures(null, frameMeta.faceAnchor, quality, canvasRef.current, videoRef.current)
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
  }, [mode, selectedLetter, selectedGesture])

  const handleCaptureStatic = async () => {
    if (!currentCanonical) {
      setMessage('No se detecta mano en cámara')
      return
    }

    try {
      const success = await saveTemplate(selectedLetter, currentCanonical, false)
      if (success) {
        setTemplates(getTemplates())
        setMessage(`¡Molde estático guardado en MongoDB para '${selectedLetter}'!`)
        setTimeout(() => setMessage(''), 2000)
      }
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
      const frames = recordingBufferRef.current
      if (frames.length > 5) {
        try {
          await saveTemplate(selectedGesture, frames, true)
          setTemplates(getTemplates())
          setMessage(`¡Secuencia guardada en MongoDB para '${selectedGesture}'! (${frames.length} frames)`)
        } catch (error) {
          console.error('[Training] Error guardando secuencia:', error)
          setMessage('No se pudo guardar la secuencia en MongoDB.')
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
      setTemplates(getTemplates())
    } catch (error) {
      console.error('[Training] Error borrando muestra:', error)
      setMessage('No se pudo borrar la muestra en MongoDB.')
      setTimeout(() => setMessage(''), 2500)
    }
  }

  const handleClearLetter = async () => {
    try {
      await clearTemplates(activeLabel)
      setTemplates(getTemplates())
    } catch (error) {
      console.error('[Training] Error limpiando dataset de la letra:', error)
      setMessage('No se pudo limpiar la letra en MongoDB.')
      setTimeout(() => setMessage(''), 2500)
    }
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-65px)] bg-zinc-950 text-white overflow-hidden">
      {/* Visualización de Cámara */}
      <div className="flex-1 relative bg-black justify-center items-center flex">
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
          <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-red-600 animate-pulse px-6 py-2 rounded-full font-bold shadow-lg z-20 text-white flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-white"></div>
            Grabando...
          </div>
        )}
        <div className="absolute left-4 top-4 z-20 max-w-xs rounded-2xl border border-white/10 bg-black/65 px-4 py-3 text-xs text-white backdrop-blur-xl">
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
      <div className="w-full md:w-96 bg-zinc-900 border-l border-zinc-800 p-6 flex flex-col gap-6 overflow-y-auto">
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
          
          {message && <div className="text-center text-emerald-400 text-sm mt-1">{message}</div>}
        </div>

        <hr className="border-zinc-800" />

        <div className="flex-1">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-medium">Archivos para '{activeLabel}'</h3>
            <button onClick={handleClearLetter} className="text-xs text-red-400 hover:underline">Borrar todos</button>
          </div>
          
          <div className="space-y-2">
            {templates[activeLabel]?.length > 0 ? (
              templates[activeLabel].map((t, idx) => (
                <div key={t.id} className="flex justify-between items-center bg-zinc-800/50 rounded p-2 text-sm">
                  <span className="text-zinc-300">
                    {t.type === 'sequence' ? `🎬 Clip DTW #${idx + 1}` : `🟢 Molde #${idx + 1}`}
                  </span>
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

function drawFeatures(landmarks, faceAnchor, handQuality, canvas, video) {
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

  // draw hand
  if (landmarks) {
      if (handQuality?.bbox) {
        const qualityStroke = getHandQualityStroke(handQuality)
        const left = proj.offsetX + (handQuality.bbox.minX * proj.renderWidth)
        const top = proj.offsetY + (handQuality.bbox.minY * proj.renderHeight)
        const boxWidth = handQuality.bbox.width * proj.renderWidth
        const boxHeight = handQuality.bbox.height * proj.renderHeight

        ctx.fillStyle = qualityStroke.fill
        ctx.strokeStyle = qualityStroke.stroke
        ctx.lineWidth = 2
        ctx.fillRect(left, top, boxWidth, boxHeight)
        ctx.strokeRect(left, top, boxWidth, boxHeight)
      }

      ctx.fillStyle = '#10b981' // emerald
      landmarks.forEach(l => {
        const x = proj.offsetX + (l.x * proj.renderWidth)
        const y = proj.offsetY + (l.y * proj.renderHeight)
        ctx.beginPath()
        ctx.arc(x, y, 4, 0, 2*Math.PI)
        ctx.fill()
      })
  }
}
