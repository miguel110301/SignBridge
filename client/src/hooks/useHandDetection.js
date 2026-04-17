/**
 * useHandDetection.js
 *
 * Hook que encapsula MediaPipe HandLandmarker.
 * Retorna los 21 puntos (landmarks) de la mano en cada frame del video.
 *
 * Para el ML dev: MediaPipe detecta 21 puntos por mano.
 * Cada punto tiene { x, y, z } normalizados (0.0 – 1.0).
 *
 *  Índices clave:
 *   0  = WRIST
 *   4  = THUMB_TIP
 *   8  = INDEX_TIP
 *   12 = MIDDLE_TIP
 *   16 = RING_TIP
 *   20 = PINKY_TIP
 *   (ver: https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'

export function useHandDetection({ onLandmarks, enabled = true }) {
  const landmarkerRef   = useRef(null)
  const animFrameRef    = useRef(null)
  const lastTimeRef     = useRef(-1)
  const videoRef        = useRef(null)   // se asigna desde el componente
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  // ── 1. Inicializar el modelo (solo una vez) ────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_URL)

        landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'GPU'           // usa la GPU del dispositivo; fallback a CPU automático
          },
          runningMode: 'VIDEO',       // modo VIDEO = detecta en cada frame
          numHands: 1                 // para el MVP solo necesitamos una mano
        })

        if (!cancelled) setReady(true)
      } catch (err) {
        console.error('[HandDetection] Error al cargar modelo:', err)
        if (!cancelled) setError(err.message)
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  // ── 2. Loop de detección ───────────────────────────────────────────────────
  const startDetection = useCallback(() => {
    if (!landmarkerRef.current || !videoRef.current) return

    function detect() {
      const video = videoRef.current
      if (!video || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(detect)
        return
      }

      // Solo procesar si el frame cambió (evita trabajo innecesario)
      if (video.currentTime !== lastTimeRef.current) {
        lastTimeRef.current = video.currentTime

        const results = landmarkerRef.current.detectForVideo(video, performance.now())

        if (results.landmarks?.length > 0) {
          // landmarks[0] = primera mano detectada, array de 21 puntos {x, y, z}
          onLandmarks(results.landmarks[0])
        }
      }

      animFrameRef.current = requestAnimationFrame(detect)
    }

    animFrameRef.current = requestAnimationFrame(detect)
  }, [onLandmarks])

  const stopDetection = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
  }, [])

  // Iniciar/detener según `enabled`
  useEffect(() => {
    if (ready && enabled) startDetection()
    else stopDetection()
    return stopDetection
  }, [ready, enabled, startDetection, stopDetection])

  return { videoRef, ready, error }
}
