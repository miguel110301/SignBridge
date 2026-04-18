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

const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'

const FACE_DETECTION_INTERVAL_MS = 140

async function createHandLandmarkerWithFallback(vision) {
  try {
    return await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 2,
    })
  } catch (gpuError) {
    console.warn('[HandDetection] GPU no disponible para mano, usando CPU:', gpuError)

    return HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numHands: 2,
    })
  }
}

async function createFaceLandmarkerWithFallback(vision) {
  try {
    return await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    })
  } catch (gpuError) {
    console.warn('[HandDetection] GPU no disponible para rostro, intentando CPU:', gpuError)

    return FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    })
  }
}

function computeFaceAnchor(faceLandmarks) {
  if (!faceLandmarks || faceLandmarks.length === 0) return null
  let minX = 1, maxX = 0, minY = 1, maxY = 0
  for (const point of faceLandmarks) {
    if (point.x < minX) minX = point.x
    if (point.x > maxX) maxX = point.x
    if (point.y < minY) minY = point.y
    if (point.y > maxY) maxY = point.y
  }
  const width = maxX - minX
  const height = maxY - minY
  return {
    left: minX,
    right: maxX,
    top: minY,
    bottom: maxY,
    width,
    height,
    center: {
      x: minX + width / 2,
      y: minY + height / 2,
      z: faceLandmarks.reduce((sum, point) => sum + (point.z ?? 0), 0) / faceLandmarks.length,
    },
  }
}

export function useHandDetection({ onLandmarks, enabled = true }) {
  const handLandmarkerRef   = useRef(null)
  const faceLandmarkerRef   = useRef(null)
  const animFrameRef        = useRef(null)
  const lastTimeRef         = useRef(-1)
  const lastFaceDetectAtRef = useRef(0)
  const lastFaceResultRef   = useRef(null)
  const videoRef            = useRef(null)
  const [ready, setReady]   = useState(false)
  const [error, setError]   = useState(null)

  // ── 1. Inicializar modelos (solo una vez) ────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_URL)
        handLandmarkerRef.current = await createHandLandmarkerWithFallback(vision)

        try {
          faceLandmarkerRef.current = await createFaceLandmarkerWithFallback(vision)
        } catch (faceError) {
          console.warn('[HandDetection] FaceLandmarker no disponible:', faceError)
          faceLandmarkerRef.current = null
        }

        if (!cancelled) setReady(true)
      } catch (err) {
        console.error('[HandDetection] Error al cargar modelos:', err)
        if (!cancelled) setError(err.message)
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  // ── 2. Loop de detección conjunta ──────────────────────────────────────────
  const startDetection = useCallback(() => {
    if (!handLandmarkerRef.current || !videoRef.current) return

    function detect() {
      const video = videoRef.current
      if (!video || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(detect)
        return
      }

      if (video.currentTime !== lastTimeRef.current) {
        lastTimeRef.current = video.currentTime
        const timestamp = performance.now()
        const handResults = handLandmarkerRef.current.detectForVideo(video, timestamp)
        let faceResults = lastFaceResultRef.current

        if (
          faceLandmarkerRef.current &&
          timestamp - lastFaceDetectAtRef.current >= FACE_DETECTION_INTERVAL_MS
        ) {
          lastFaceDetectAtRef.current = timestamp
          faceResults = faceLandmarkerRef.current.detectForVideo(video, timestamp)
          lastFaceResultRef.current = faceResults
        }

        if (handResults.landmarks?.length > 0) {
          const handsCount = handResults.landmarks.length
          const handLandmarks = handResults.landmarks[0]
          const handWorldLandmarks = handResults.worldLandmarks?.[0] ?? null
          const handedness =
            handResults.handedness?.[0]?.[0] ??
            handResults.handednesses?.[0]?.[0] ??
            null
          const secondaryLandmarks = handsCount > 1 ? handResults.landmarks[1] : null

          const faceLandmarks = faceResults?.faceLandmarks?.[0] ?? null
          const faceAnchor = faceLandmarks
            ? computeFaceAnchor(faceLandmarks)
            : null

          onLandmarks(handLandmarks, {
            faceAnchor,
            faceLandmarks,
            handWorldLandmarks,
            handedness,
            handsCount,
            secondaryLandmarks,
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

  useEffect(() => {
    if (ready && enabled) startDetection()
    else stopDetection()
    return stopDetection
  }, [ready, enabled, startDetection, stopDetection])

  return { videoRef, ready, error }
}
