import { DYNAMIC_GESTURE_MAP } from './SignMap.js'
import { classifyDTW } from './KNNClassifier.js'
import { normalizeHand } from './HandNormalizer.js'

const LM = {
  WRIST: 0,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_TIP: 12,
  RING_PIP: 14,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_TIP: 20,
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function vec(a, b) {
  return {
    x: b.x - a.x,
    y: b.y - a.y,
    z: (b.z || 0) - (a.z || 0),
  }
}

function cross(v1, v2) {
  return {
    x: (v1.y * v2.z) - (v1.z * v2.y),
    y: (v1.z * v2.x) - (v1.x * v2.z),
    z: (v1.x * v2.y) - (v1.y * v2.x),
  }
}

function magnitude(v) {
  return Math.hypot(v.x, v.y, v.z || 0)
}

function getHolaConfig() {
  return DYNAMIC_GESTURE_MAP.find((gesture) => gesture.gesture === 'hola')?.config
}

function isFingerOpen(landmarks, tipIndex, pipIndex) {
  return landmarks[tipIndex].y < landmarks[pipIndex].y
}

function getPalmFacingScore(worldLandmarks) {
  if (!worldLandmarks?.length) return 0

  const wrist = worldLandmarks[LM.WRIST]
  const indexMcp = worldLandmarks[LM.INDEX_MCP]
  const pinkyMcp = worldLandmarks[LM.PINKY_MCP]
  const normal = cross(vec(wrist, indexMcp), vec(wrist, pinkyMcp))
  const normalMagnitude = magnitude(normal) || 1

  return Math.abs(normal.z) / normalMagnitude
}

function computeHeadZone(faceAnchor, config) {
  if (!faceAnchor) return null

  return {
    left: faceAnchor.left - (faceAnchor.width * config.headZonePaddingX),
    right: faceAnchor.right + (faceAnchor.width * config.headZonePaddingX),
    top: faceAnchor.top - (faceAnchor.height * config.headZonePaddingTop),
    bottom: faceAnchor.center.y + (faceAnchor.height * config.headZonePaddingBottom),
  }
}

function pointInRect(point, rect) {
  if (!rect) return false

  return (
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom
  )
}

function summarizeFrame(landmarks, frameMeta, timestamp, config) {
  const faceAnchor = frameMeta?.faceAnchor ?? null
  const headZone = computeHeadZone(faceAnchor, config)
  const reliableHand = frameMeta?.handQuality?.reliable !== false

  const wrist = landmarks[LM.WRIST]
  const indexMcp = landmarks[LM.INDEX_MCP]
  const middleMcp = landmarks[LM.MIDDLE_MCP]
  const pinkyMcp = landmarks[LM.PINKY_MCP]
  const indexTip = landmarks[LM.INDEX_TIP]
  const middleTip = landmarks[LM.MIDDLE_TIP]
  const ringTip = landmarks[LM.RING_TIP]
  const pinkyTip = landmarks[LM.PINKY_TIP]

  const palmCenter = {
    x: (wrist.x + indexMcp.x + middleMcp.x + pinkyMcp.x) / 4,
    y: (wrist.y + indexMcp.y + middleMcp.y + pinkyMcp.y) / 4,
    z: (wrist.z + indexMcp.z + middleMcp.z + pinkyMcp.z) / 4,
  }

  const indexOpen = isFingerOpen(landmarks, LM.INDEX_TIP, LM.INDEX_PIP)
  const middleOpen = isFingerOpen(landmarks, LM.MIDDLE_TIP, LM.MIDDLE_PIP)
  const ringOpen = isFingerOpen(landmarks, LM.RING_TIP, LM.RING_PIP)
  const pinkyOpen = isFingerOpen(landmarks, LM.PINKY_TIP, LM.PINKY_PIP)
  const fingerGap = dist(indexTip, middleTip)
  const twoFingerHandshape =
    indexOpen &&
    middleOpen &&
    !ringOpen &&
    !pinkyOpen &&
    fingerGap >= config.minFingerGap &&
    fingerGap <= config.maxFingerGap

  const fingertipsNearHead =
    pointInRect(indexTip, headZone) ||
    pointInRect(middleTip, headZone) ||
    pointInRect(palmCenter, headZone)

  const palmFacingScore = getPalmFacingScore(frameMeta?.handWorldLandmarks)
  const palmFacingCamera = palmFacingScore >= config.minFacingScore

  return {
    timestamp,
    palmCenter,
    faceAnchor,
    headZone,
    reliableHand,
    nearHead: Boolean(faceAnchor && fingertipsNearHead),
    twoFingerHandshape,
    fingerGap,
    palmFacingScore,
    palmFacingCamera,
    canonical: normalizeHand(frameMeta?.handWorldLandmarks || landmarks)
  }
}

function movingAverage(values, windowSize = 3) {
  return values.map((_, index) => {
    const start = Math.max(0, index - windowSize + 1)
    const slice = values.slice(start, index + 1)
    return slice.reduce((sum, value) => sum + value, 0) / slice.length
  })
}

function analyzeOscillation(values, minSwingAmplitude) {
  if (values.length < 4) {
    return { directionChanges: 0, maxSwingAmplitude: 0 }
  }

  const smooth = movingAverage(values, 3)

  let directionChanges = 0
  let maxSwingAmplitude = 0
  let previousSign = 0
  let lastExtreme = smooth[0]

  for (let index = 1; index < smooth.length; index += 1) {
    const delta = smooth[index] - smooth[index - 1]
    if (Math.abs(delta) < 0.0025) continue

    const sign = Math.sign(delta)
    if (previousSign && sign !== previousSign) {
      const pivot = smooth[index - 1]
      const amplitude = Math.abs(pivot - lastExtreme)

      if (amplitude >= minSwingAmplitude) {
        directionChanges += 1
        maxSwingAmplitude = Math.max(maxSwingAmplitude, amplitude)
        lastExtreme = pivot
      }
    }

    previousSign = sign
  }

  return { directionChanges, maxSwingAmplitude }
}

function detectHola(windowFrames, config) {
  if (windowFrames.length < config.minFrames) return null

  const validFrames = windowFrames.filter((frame) => frame.reliableHand && frame.nearHead)
  if (validFrames.length < config.minFrames * config.minNearHeadRatio) return null

  const nearHeadRatio = validFrames.length / windowFrames.length
  const twoFingerRatio =
    validFrames.filter((frame) => frame.twoFingerHandshape).length / validFrames.length
  if (twoFingerRatio < config.minTwoFingerRatio) return null

  const palmFacingRatio =
    validFrames.filter((frame) => frame.palmFacingCamera).length / validFrames.length
  if (palmFacingRatio < config.minPalmFacingRatio) return null

  const xValues = validFrames.map((frame) => frame.palmCenter.x)
  const rangeX = Math.max(...xValues) - Math.min(...xValues)
  if (rangeX < config.minRangeX) return null

  const oscillation = analyzeOscillation(xValues, config.minSwingAmplitude)
  if (oscillation.directionChanges < config.minDirectionChanges) return null

  const confidence = Math.min(
    0.99,
    0.5 +
      (nearHeadRatio * 0.18) +
      (twoFingerRatio * 0.14) +
      (palmFacingRatio * 0.12) +
      Math.min(rangeX / config.minRangeX, 1) * 0.12 +
      Math.min(oscillation.directionChanges / 2, 1) * 0.08
  )

  return {
    gesture: 'hola',
    word: 'hola',
    confidence,
    debug: {
      nearHeadRatio,
      twoFingerRatio,
      palmFacingRatio,
      rangeX,
      directionChanges: oscillation.directionChanges,
      maxSwingAmplitude: oscillation.maxSwingAmplitude,
      frameCount: windowFrames.length,
    },
  }
}

export function createGestureSequenceRecognizer() {
  const history = []
  const holaConfig = getHolaConfig()
  let lastGestureAt = 0

  return {
    push(landmarks, frameMeta = {}, timestamp = Date.now()) {
      if (!holaConfig) {
        return { gesture: null, suppressStatic: false, debug: null }
      }

      const frameSummary = summarizeFrame(landmarks, frameMeta, timestamp, holaConfig)
      history.push(frameSummary)

      const oldestAllowed = timestamp - holaConfig.windowMs
      while (history.length > 0 && history[0].timestamp < oldestAllowed) {
        history.shift()
      }

      const suppressWindow = history.filter(
        (frame) => timestamp - frame.timestamp <= holaConfig.suppressWindowMs
      )

      const activeGestureFrames = suppressWindow.filter(
        (frame) => frame.reliableHand && frame.nearHead && frame.twoFingerHandshape
      )

      const suppressStatic =
        activeGestureFrames.length >= 4 &&
        (() => {
          const xValues = activeGestureFrames.map((frame) => frame.palmCenter.x)
          const rangeX = Math.max(...xValues) - Math.min(...xValues)
          return rangeX >= holaConfig.minSuppressRangeX
        })()

      if (timestamp - lastGestureAt < holaConfig.cooldownMs) {
        return {
          gesture: null,
          suppressStatic,
          debug: buildDebugState(frameSummary, history, suppressStatic, null),
        }
      }

      const dtwResult = classifyDTW(history)
      if (dtwResult && dtwResult.confidence > 0.6) {
        const historySnapshot = history.slice()
        lastGestureAt = timestamp
        history.length = 0
        return {
          gesture: {
            gesture: dtwResult.gesture,
            word: dtwResult.gesture,
            confidence: dtwResult.confidence,
            debug: { method: 'dtw', minDistance: dtwResult.minDistance }
          },
          suppressStatic: true,
          debug: buildDebugState(frameSummary, historySnapshot, true, dtwResult),
        }
      }

      const gesture = detectHola(history, holaConfig)
      if (!gesture) {
        return {
          gesture: null,
          suppressStatic,
          debug: buildDebugState(frameSummary, history, suppressStatic, null),
        }
      }

      const historySnapshot = history.slice()
      lastGestureAt = timestamp
      history.length = 0

      return {
        gesture,
        suppressStatic: true,
        debug: buildDebugState(frameSummary, historySnapshot, true, gesture.debug),
      }
    },
    reset() {
      history.length = 0
      lastGestureAt = 0
    },
  }
}

function buildDebugState(currentFrame, history, suppressStatic, detectionDebug) {
  const recent = history.slice(-12)
  const xValues = recent.map((frame) => frame.palmCenter.x)
  const rangeX = xValues.length > 0 ? Math.max(...xValues) - Math.min(...xValues) : 0
  const nearHeadCount = recent.filter((frame) => frame.nearHead).length
  const twoFingerCount = recent.filter((frame) => frame.twoFingerHandshape).length
  const palmFacingCount = recent.filter((frame) => frame.palmFacingCamera).length
  const reliableCount = recent.filter((frame) => frame.reliableHand).length

  return {
    currentFrame,
    frameCount: history.length,
    recentRangeX: rangeX,
    nearHeadRatio: recent.length ? nearHeadCount / recent.length : 0,
    twoFingerRatio: recent.length ? twoFingerCount / recent.length : 0,
    palmFacingRatio: recent.length ? palmFacingCount / recent.length : 0,
    reliableRatio: recent.length ? reliableCount / recent.length : 0,
    suppressStatic,
    detectionDebug,
  }
}
