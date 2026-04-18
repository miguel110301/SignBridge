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

const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'

const FACE_DETECTION_INTERVAL_MS = 140

async function createHandLandmarkerWithFallback(vision, HandLandmarkerClass) {
  try {
    return await HandLandmarkerClass.createFromOptions(vision, {
      baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 2,
    })
  } catch (gpuError) {
    console.warn('[HandDetection] GPU no disponible para mano, usando CPU:', gpuError)

    return HandLandmarkerClass.createFromOptions(vision, {
      baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numHands: 2,
    })
  }
}

function computeHandBox(landmarks) {
  if (!landmarks?.length) return null

  const xs = landmarks.map((point) => point.x)
  const ys = landmarks.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    area: (maxX - minX) * (maxY - minY),
  }
}

function getPalmCenter(landmarks) {
  if (!landmarks?.length) return null

  return {
    x: (landmarks[0].x + landmarks[5].x + landmarks[9].x + landmarks[13].x + landmarks[17].x) / 5,
    y: (landmarks[0].y + landmarks[5].y + landmarks[9].y + landmarks[13].y + landmarks[17].y) / 5,
    z: ((landmarks[0].z ?? 0) + (landmarks[5].z ?? 0) + (landmarks[9].z ?? 0) + (landmarks[13].z ?? 0) + (landmarks[17].z ?? 0)) / 5,
  }
}

async function createFaceLandmarkerWithFallback(vision, FaceLandmarkerClass) {
  try {
    return await FaceLandmarkerClass.createFromOptions(vision, {
      baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    })
  } catch (gpuError) {
    console.warn('[HandDetection] GPU no disponible para rostro, intentando CPU:', gpuError)

    return FaceLandmarkerClass.createFromOptions(vision, {
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
  const initPromiseRef      = useRef(null)
  const [ready, setReady]   = useState(false)
  const [error, setError]   = useState(null)

  // ── 1. Inicializar modelos solo cuando realmente se necesitan ─────────────
  useEffect(() => {
    if (!enabled || handLandmarkerRef.current || initPromiseRef.current) return undefined

    let cancelled = false

    async function init() {
      try {
        setError(null)
        const {
          HandLandmarker: HandLandmarkerClass,
          FaceLandmarker: FaceLandmarkerClass,
          FilesetResolver,
        } = await import('@mediapipe/tasks-vision')
        const vision = await FilesetResolver.forVisionTasks(WASM_URL)
        handLandmarkerRef.current = await createHandLandmarkerWithFallback(vision, HandLandmarkerClass)

        try {
          faceLandmarkerRef.current = await createFaceLandmarkerWithFallback(vision, FaceLandmarkerClass)
        } catch (faceError) {
          console.warn('[HandDetection] FaceLandmarker no disponible:', faceError)
          faceLandmarkerRef.current = null
        }

        if (cancelled) {
          try {
            handLandmarkerRef.current?.close?.()
          } catch {
            // noop
          }
          try {
            faceLandmarkerRef.current?.close?.()
          } catch {
            // noop
          }
          handLandmarkerRef.current = null
          faceLandmarkerRef.current = null
          return
        }

        setReady(true)
      } catch (err) {
        console.error('[HandDetection] Error al cargar modelos:', err)
        if (!cancelled) setError(err.message)
      } finally {
        initPromiseRef.current = null
      }
    }

    initPromiseRef.current = init()
    return () => { cancelled = true }
  }, [enabled])

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
          const detectedHands = handResults.landmarks
            .map((landmarks, index) => {
              const worldLandmarks = handResults.worldLandmarks?.[index] ?? null
              const handedness =
                handResults.handedness?.[index]?.[0] ??
                handResults.handednesses?.[index]?.[0] ??
                null

              return {
                landmarks,
                worldLandmarks,
                handedness,
                bbox: computeHandBox(landmarks),
                palmCenter: getPalmCenter(landmarks),
              }
            })
            .sort((a, b) => (b.bbox?.area ?? 0) - (a.bbox?.area ?? 0))

          const primaryHand = detectedHands[0]
          const secondaryHand = detectedHands[1] ?? null

          const faceLandmarks = faceResults?.faceLandmarks?.[0] ?? null
          const faceAnchor = faceLandmarks
            ? computeFaceAnchor(faceLandmarks)
            : null

          onLandmarks(primaryHand.landmarks, {
            faceAnchor,
            faceLandmarks,
            handWorldLandmarks: primaryHand.worldLandmarks,
            handedness: primaryHand.handedness,
            hands: detectedHands,
            handsCount: detectedHands.length,
            secondaryHand,
            secondaryPalmCenter: secondaryHand?.palmCenter ?? null,
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

  useEffect(() => {
    return () => {
      stopDetection()
      try {
        handLandmarkerRef.current?.close?.()
      } catch {
        // noop
      }
      try {
        faceLandmarkerRef.current?.close?.()
      } catch {
        // noop
      }
      handLandmarkerRef.current = null
      faceLandmarkerRef.current = null
      initPromiseRef.current = null
    }
  }, [stopDetection])

  return { videoRef, ready, error }
}
