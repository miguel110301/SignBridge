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
import { HandLandmarker, FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'

const FACE_DETECTION_INTERVAL_MS = 140

async function createHandLandmarkerWithFallback(vision) {
  try {
    return await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numHands: 1
    })
  } catch (gpuError) {
    console.warn('[HandDetection] GPU no disponible para mano, usando CPU:', gpuError)

    return HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: 'CPU'
      },
      runningMode: 'VIDEO',
      numHands: 1
    })
  }
}

async function createFaceLandmarkerWithFallback(vision) {
  try {
    return await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: FACE_MODEL_URL,
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false
    })
  } catch (gpuError) {
    console.warn('[HandDetection] GPU no disponible para rostro, intentando CPU:', gpuError)

    return FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: FACE_MODEL_URL,
        delegate: 'CPU'
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false
    })
  }
}

export function useHandDetection({ onLandmarks, enabled = true }) {
  const landmarkerRef   = useRef(null)
  const faceLandmarkerRef = useRef(null)
  const animFrameRef    = useRef(null)
  const lastTimeRef     = useRef(-1)
  const lastFaceDetectAtRef = useRef(0)
  const lastFaceResultRef = useRef(null)
  const videoRef        = useRef(null)   // se asigna desde el componente
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  // ── 1. Inicializar el modelo (solo una vez) ────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_URL)

        landmarkerRef.current = await createHandLandmarkerWithFallback(vision)

        try {
          faceLandmarkerRef.current = await createFaceLandmarkerWithFallback(vision)
        } catch (faceErr) {
          // Si el rostro falla, no bloqueamos las letras.
          // Solo desactivamos contexto avanzado para gestos junto a la cabeza.
          console.warn('[HandDetection] FaceLandmarker no disponible:', faceErr)
          faceLandmarkerRef.current = null
        }

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

        const timestamp = performance.now()
        const results = landmarkerRef.current.detectForVideo(video, timestamp)
        let faceResults = lastFaceResultRef.current

        if (
          faceLandmarkerRef.current &&
          timestamp - lastFaceDetectAtRef.current >= FACE_DETECTION_INTERVAL_MS
        ) {
          lastFaceDetectAtRef.current = timestamp
          faceResults = faceLandmarkerRef.current.detectForVideo(video, timestamp)
          lastFaceResultRef.current = faceResults
        }

        if (results.landmarks?.length > 0) {
          const handLandmarks = results.landmarks[0]
          const handWorldLandmarks = results.worldLandmarks?.[0] ?? null
          const handedness = results.handedness?.[0]?.[0] ?? null
          const faceLandmarks = faceResults?.faceLandmarks?.[0] ?? null

          // landmarks[0] = primera mano detectada, array de 21 puntos {x, y, z}
          onLandmarks(handLandmarks, {
            handWorldLandmarks,
            handedness,
            faceLandmarks,
            faceAnchor: faceLandmarks ? summarizeFace(faceLandmarks) : null,
          })
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

    lastFaceResultRef.current = null
    lastFaceDetectAtRef.current = 0
    lastTimeRef.current = -1
  }, [])

  // Iniciar/detener según `enabled`
  useEffect(() => {
    if (ready && enabled) startDetection()
    else stopDetection()
    return stopDetection
  }, [ready, enabled, startDetection, stopDetection])

  return { videoRef, ready, error }
}

function summarizeFace(faceLandmarks) {
  const xs = faceLandmarks.map(point => point.x)
  const ys = faceLandmarks.map(point => point.y)
  const zs = faceLandmarks.map(point => point.z)

  const left = Math.min(...xs)
  const right = Math.max(...xs)
  const top = Math.min(...ys)
  const bottom = Math.max(...ys)
  const width = right - left
  const height = bottom - top

  return {
    left,
    right,
    top,
    bottom,
    width,
    height,
    center: {
      x: (left + right) / 2,
      y: (top + bottom) / 2,
      z: zs.reduce((sum, value) => sum + value, 0) / zs.length,
    },
  }
}
