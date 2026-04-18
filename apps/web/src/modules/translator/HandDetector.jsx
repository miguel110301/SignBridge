/**
 * HandDetector.jsx
 *
 * Componente de cámara con overlay de landmarks en tiempo real.
 * Llama a onSignDetected cada vez que se estabiliza una seña.
 */

import { useRef, useEffect, useState, useCallback } from 'react'
import { classifySign, createSmoother } from '@signbridge/sign-engine'
import { useHandDetection } from '../../hooks/useHandDetection.js'

// Conexiones entre landmarks para dibujar el esqueleto de la mano
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],         // pulgar
  [0,5],[5,6],[6,7],[7,8],         // índice
  [0,9],[9,10],[10,11],[11,12],    // medio
  [0,13],[13,14],[14,15],[15,16],  // anular
  [0,17],[17,18],[18,19],[19,20],  // meñique
  [5,9],[9,13],[13,17]             // palma
]

export default function HandDetector({ onSignDetected, enabled = true }) {
  const canvasRef    = useRef(null)
  const smootherRef  = useRef(createSmoother(8))
  const lastSignRef  = useRef(null)

  const [currentSign, setCurrentSign] = useState(null)
  const [confidence,  setConfidence]  = useState(0)

  // Callback que recibe los 21 landmarks de MediaPipe
  const handleLandmarks = useCallback((landmarks, frameMeta = {}) => {
    // 1. Clasificar la seña
    const raw = classifySign(landmarks, frameMeta)

    // 2. Suavizar para evitar parpadeo
    const stable = smootherRef.current.push(raw)

    // 3. Actualizar estado visual
    setCurrentSign(stable?.letter ?? null)
    setConfidence(stable?.confidence ?? 0)

    // 4. Notificar al padre solo si la seña cambió
    if (stable && stable.letter !== lastSignRef.current) {
      lastSignRef.current = stable.letter
      onSignDetected?.(stable.letter, stable.confidence)
    }

    // 5. Dibujar el overlay de landmarks en el canvas
    drawLandmarks(landmarks, canvasRef.current)
  }, [onSignDetected])

  const { videoRef, ready, error } = useHandDetection({
    onLandmarks: handleLandmarks,
    enabled
  })

  // Iniciar la cámara
  useEffect(() => {
    if (!videoRef.current) return

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } })
      .then(stream => {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      })
      .catch(err => console.error('[Camera] Error:', err))

    return () => {
      const stream = videoRef.current?.srcObject
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [videoRef])

  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* Video (invisible, solo para procesar) */}
      <video
        ref={videoRef}
        className="w-full rounded-2xl"
        style={{ transform: 'scaleX(-1)' }}   // espejo para que sea más natural
        muted
        playsInline
      />

      {/* Canvas superpuesto para dibujar landmarks */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full rounded-2xl"
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* Estado del modelo */}
      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center
                        bg-zinc-900/80 rounded-2xl">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent
                            rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-zinc-400">Cargando modelo de IA...</p>
          </div>
        </div>
      )}

      {/* Seña detectada + barra de confianza */}
      {ready && (
        <div className="absolute bottom-4 left-4 right-4">
          <div className="bg-zinc-900/80 backdrop-blur rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-4xl font-bold text-white">
                {currentSign ?? '—'}
              </span>
              <span className="text-xs text-zinc-400">
                {Math.round(confidence * 100)}% confianza
              </span>
            </div>
            {/* Barra de confianza */}
            <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-150"
                style={{
                  width: `${confidence * 100}%`,
                  background: confidence > 0.8 ? '#22c55e' : confidence > 0.6 ? '#eab308' : '#ef4444'
                }}
              />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center
                        bg-red-950/80 rounded-2xl p-4">
          <p className="text-red-300 text-sm text-center">
            Error al cargar el modelo: {error}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Dibujar landmarks sobre el canvas ────────────────────────────────────────
function drawLandmarks(landmarks, canvas) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  const W   = canvas.offsetWidth
  const H   = canvas.offsetHeight
  canvas.width  = W
  canvas.height = H
  ctx.clearRect(0, 0, W, H)

  // Puntos
  ctx.fillStyle = '#7C3AED'
  for (const lm of landmarks) {
    ctx.beginPath()
    ctx.arc(lm.x * W, lm.y * H, 4, 0, Math.PI * 2)
    ctx.fill()
  }

  // Conexiones
  ctx.strokeStyle = 'rgba(124, 58, 237, 0.6)'
  ctx.lineWidth   = 2
  for (const [a, b] of HAND_CONNECTIONS) {
    ctx.beginPath()
    ctx.moveTo(landmarks[a].x * W, landmarks[a].y * H)
    ctx.lineTo(landmarks[b].x * W, landmarks[b].y * H)
    ctx.stroke()
  }
}
