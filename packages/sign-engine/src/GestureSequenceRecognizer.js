import { classifyDynamicLexicon } from './DynamicLexiconClassifier.js'
import { DYNAMIC_GESTURE_MAP, SIGN_LEXICON_WORDS } from './SignMap.js'
import { buildFrameHandModel } from './HandSequenceModel.js'
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

function getDynamicLetterConfig(gestureKey) {
  return DYNAMIC_GESTURE_MAP.find((gesture) => gesture.gesture === gestureKey)?.config ?? null
}

const LEXICON_BY_KEY = new Map(SIGN_LEXICON_WORDS.map((entry) => [entry.key, entry]))
const LEXICON_KEYS = new Set(SIGN_LEXICON_WORDS.map((entry) => entry.key))

const DTW_WORD_CONFIDENCE_THRESHOLD = 0.8
const MIN_SEQUENCE_FRAMES = 10

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
  const frameModel = buildFrameHandModel(landmarks, frameMeta)
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

  const indexOnlyHandshape =
    indexOpen &&
    !middleOpen &&
    !ringOpen &&
    !pinkyOpen

  const fingertipsNearHead =
    pointInRect(indexTip, headZone) ||
    pointInRect(middleTip, headZone) ||
    pointInRect(palmCenter, headZone)

  const palmFacingScore = getPalmFacingScore(frameMeta?.handWorldLandmarks)
  const palmFacingCamera = palmFacingScore >= config.minFacingScore

  return {
    timestamp,
    palmCenter: frameModel?.primaryHand?.palmCenter ?? palmCenter,
    indexTip,
    secondaryPalmCenter: frameModel?.secondaryHand?.palmCenter ?? frameMeta?.secondaryPalmCenter ?? null,
    handCount: frameModel?.handCount ?? frameMeta?.handsCount ?? 1,
    faceAnchor,
    headZone,
    reliableHand,
    nearHead: Boolean(faceAnchor && fingertipsNearHead),
    twoFingerHandshape,
    indexOnlyHandshape,
    fingerGap,
    palmFacingScore,
    palmFacingCamera,
    twoHandsVisible: (frameModel?.handCount ?? frameMeta?.handsCount ?? 1) >= 2,
    interHandDistance: frameModel?.interHand?.distance ?? 0,
    canonical: frameModel?.primaryHand?.canonical ?? normalizeHand(frameMeta?.handWorldLandmarks || landmarks),
    frameModel,
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
  if (!config || windowFrames.length < (config.minFrames ?? 10)) return null

  const validFrames = windowFrames.filter((frame) => frame.reliableHand)
  if (validFrames.length < (config.minFrames ?? 10)) return null

<<<<<<< HEAD
  // Filtro de forma de mano: debe ser dos dedos extendidos la mayoría del tiempo
  const twoFingerRatio = validFrames.filter((f) => f.twoFingerHandshape).length / validFrames.length
  if (twoFingerRatio < config.minTwoFingerRatio) return null

  // Filtro de posición: la mano debe estar cerca de la cabeza
  const nearHeadRatio = validFrames.filter((f) => f.nearHead).length / validFrames.length
  if (nearHeadRatio < config.minNearHeadRatio) return null

  const firstFrame = validFrames[0]
  const lastFrame = validFrames[validFrames.length - 1]
=======
  const nearHeadRatio = validFrames.filter((frame) => frame.nearHead).length / validFrames.length
  const twoFingerRatio = validFrames.filter((frame) => frame.twoFingerHandshape).length / validFrames.length
  const palmFacingRatio = validFrames.filter((frame) => frame.palmFacingCamera).length / validFrames.length
>>>>>>> origin/main

  if (nearHeadRatio < (config.minNearHeadRatio ?? 0.55)) return null
  if (twoFingerRatio < (config.minTwoFingerRatio ?? 0.65)) return null
  if (palmFacingRatio < (config.minPalmFacingRatio ?? 0.55)) return null

  const activeFrames = validFrames.filter(
    (frame) => frame.nearHead && frame.twoFingerHandshape && frame.palmFacingCamera
  )

<<<<<<< HEAD
  // Filtro 2: El movimiento debe ser principalmente horizontal.
  // Si distanceY es muy alto (ej. subiendo la mano a la cabeza), esto da falso y lo ignora.
  const isHorizontal = distanceX > (distanceY * 1.5)

  // Si cumple todos los filtros, entonces sí es un "Hola"
  if (isLongEnough && isHorizontal) { 
    return {
      gesture: 'hola',
      word: 'hola',
      confidence: 0.95,
      debug: {
        distanceX,
        distanceY,
        twoFingerRatio,
        nearHeadRatio,
        frameCount: windowFrames.length,
      },
    }
=======
  if (activeFrames.length < Math.max(6, Math.ceil((config.minFrames ?? 10) * 0.65))) {
    return null
>>>>>>> origin/main
  }

  const xValues = activeFrames.map((frame) => frame.palmCenter.x)
  const yValues = activeFrames.map((frame) => frame.palmCenter.y)
  const rangeX = Math.max(...xValues) - Math.min(...xValues)
  const rangeY = Math.max(...yValues) - Math.min(...yValues)

  if (rangeX < (config.minRangeX ?? 0.075)) return null
  if (rangeX <= (rangeY * 1.25)) return null

  const oscillation = analyzeOscillation(xValues, config.minSwingAmplitude ?? 0.03)
  if (oscillation.directionChanges < (config.minDirectionChanges ?? 1)) return null

  const firstFrame = activeFrames[0]
  const lastFrame = activeFrames[activeFrames.length - 1]
  const endToStartX = Math.abs(lastFrame.palmCenter.x - firstFrame.palmCenter.x)

  const confidence = Math.min(
    0.97,
    0.72 +
      (Math.min(nearHeadRatio, 1) * 0.08) +
      (Math.min(twoFingerRatio, 1) * 0.07) +
      (Math.min(palmFacingRatio, 1) * 0.06) +
      (Math.min(rangeX / ((config.minRangeX ?? 0.075) * 2), 1) * 0.04)
  )

  return {
    gesture: 'hola',
    word: 'hola',
    confidence,
    debug: {
      method: 'hola_rule_v2',
      frameCount: windowFrames.length,
      activeFrameCount: activeFrames.length,
      nearHeadRatio,
      twoFingerRatio,
      palmFacingRatio,
      rangeX,
      rangeY,
      endToStartX,
      directionChanges: oscillation.directionChanges,
      maxSwingAmplitude: oscillation.maxSwingAmplitude,
    },
  }
}

function detectDynamicZ(windowFrames, config) {
  if (!config || windowFrames.length < (config.minFrames ?? 10)) return null

  const validFrames = windowFrames.filter((frame) => frame.reliableHand)
  if (validFrames.length < (config.minFrames ?? 10)) return null

  const oneHandRatio = validFrames.filter((frame) => frame.handCount <= 1).length / validFrames.length
  const indexOnlyRatio = validFrames.filter((frame) => frame.indexOnlyHandshape).length / validFrames.length
  if (oneHandRatio < 0.7 || indexOnlyRatio < (config.minIndexOnlyRatio ?? 0.5)) return null

  const points = validFrames.map((frame) => frame.indexTip)
  if (points.length < 6) return null

  const xValues = points.map((point) => point.x)
  const yValues = points.map((point) => point.y)
  const rangeX = Math.max(...xValues) - Math.min(...xValues)
  const rangeY = Math.max(...yValues) - Math.min(...yValues)

  if (rangeX < (config.minRangeX ?? 0.08)) return null
  if (rangeY < (config.minRangeY ?? 0.035) || rangeY > (config.maxRangeY ?? 0.3)) return null

  const firstCut = Math.floor(points.length / 3)
  const secondCut = Math.floor((points.length * 2) / 3)
  const first = points[0]
  const pivotA = points[Math.max(1, firstCut - 1)]
  const pivotB = points[Math.max(firstCut + 1, secondCut - 1)]
  const last = points[points.length - 1]

  const seg1 = vec(first, pivotA)
  const seg2 = vec(pivotA, pivotB)
  const seg3 = vec(pivotB, last)

  const sign1 = Math.sign(seg1.x)
  const sign2 = Math.sign(seg2.x)
  const sign3 = Math.sign(seg3.x)

  const firstHorizontal = Math.abs(seg1.x) >= (config.minSegmentX ?? 0.025) && Math.abs(seg1.x) > Math.abs(seg1.y) * 1.2
  const middleDiagonal =
    Math.abs(seg2.x) >= (config.minSegmentX ?? 0.025) * 0.7 &&
    Math.abs(seg2.y) >= (config.minDiagonalY ?? 0.02) &&
    sign2 !== 0 &&
    sign1 !== 0 &&
    sign2 !== sign1
  const lastHorizontal =
    Math.abs(seg3.x) >= (config.minSegmentX ?? 0.025) &&
    Math.abs(seg3.x) > Math.abs(seg3.y) * 1.2 &&
    sign3 !== 0 &&
    sign1 !== 0 &&
    sign3 === sign1
  const totalDown = (last.y - first.y) >= (config.minTotalDown ?? 0.025)

  if (!(firstHorizontal && middleDiagonal && lastHorizontal && totalDown)) {
    return null
  }

  const confidence = Math.min(
    0.96,
    0.72 +
      (Math.min(rangeX / ((config.minRangeX ?? 0.08) * 2), 1) * 0.1) +
      (Math.min(rangeY / ((config.minRangeY ?? 0.035) * 4), 1) * 0.06) +
      (Math.min(indexOnlyRatio, 1) * 0.08)
  )

  return {
    gesture: 'lsm_z',
    letter: 'Z',
    word: 'z',
    spoken: 'z',
    type: 'dynamic_letter',
    confidence,
    debug: {
      method: 'dynamic_letter_z',
      rangeX,
      rangeY,
      oneHandRatio,
      indexOnlyRatio,
      seg1,
      seg2,
      seg3,
    },
  }
}

function detectLexiconWord(windowFrames) {
  if (windowFrames.length < MIN_SEQUENCE_FRAMES) return null

  const reliableFrames = windowFrames.filter((frame) => frame.reliableHand)
  if (reliableFrames.length / windowFrames.length < 0.65) {
    return null
  }

  const dtwResult = classifyDTW(windowFrames)
  const modelResult = classifyDynamicLexicon(windowFrames)
  const modelCandidate = modelResult?.bestCandidate ?? null

  const dtwEntry = dtwResult?.gesture ? LEXICON_BY_KEY.get(dtwResult.gesture) : null
  const modelEntry = modelCandidate?.gesture ? LEXICON_BY_KEY.get(modelCandidate.gesture) : null

  const candidateKey =
    dtwEntry && modelEntry
      ? (
          dtwEntry.key === modelEntry.key
            ? dtwEntry.key
            : (
                dtwResult.confidence >= 0.86
                  ? dtwEntry.key
                  : modelCandidate.confidence > dtwResult.confidence
                    ? modelEntry.key
                    : dtwEntry.key
              )
        )
      : dtwEntry?.key ?? modelEntry?.key ?? null

  if (!candidateKey || !LEXICON_KEYS.has(candidateKey)) {
    return null
  }

  const lexiconEntry = LEXICON_BY_KEY.get(candidateKey)
  if (!lexiconEntry) return null

  const twoHandsRatio =
    windowFrames.length > 0
      ? windowFrames.filter((frame) => frame.twoHandsVisible).length / windowFrames.length
      : 0
  const interHandDistances = windowFrames
    .filter((frame) => frame.twoHandsVisible)
    .map((frame) => frame.interHandDistance)
  const averageInterHandDistance = interHandDistances.length
    ? interHandDistances.reduce((sum, value) => sum + value, 0) / interHandDistances.length
    : 0

  const minConfidence = lexiconEntry.minConfidence ?? DTW_WORD_CONFIDENCE_THRESHOLD
  const dtwConfidence = dtwEntry?.key === candidateKey ? dtwResult?.confidence ?? 0 : 0
  const modelConfidence = modelEntry?.key === candidateKey ? modelCandidate?.confidence ?? 0 : 0
  const confidenceBoost =
    lexiconEntry.requiresTwoHands && twoHandsRatio >= 0.45 ? 0.08 : 0
  const effectiveConfidence = Math.min(
    0.99,
    (dtwConfidence * 0.7) +
    (modelConfidence * 0.3) +
    confidenceBoost
  )

  if (!dtwConfidence && modelConfidence > 0 && !modelCandidate?.modelOnlyEligible) {
    return null
  }

  if (effectiveConfidence < minConfidence) {
    return null
  }

  if (lexiconEntry.requiresTwoHands && twoHandsRatio < 0.4) {
    return null
  }

  if (
    lexiconEntry.baseModel?.minInterHandDistance &&
    averageInterHandDistance < lexiconEntry.baseModel.minInterHandDistance
  ) {
    return null
  }

  return {
    gesture: lexiconEntry.key,
    word: lexiconEntry.word,
    spoken: lexiconEntry.spoken,
    confidence: effectiveConfidence,
    debug: {
      method: dtwConfidence && modelConfidence ? 'dtw+model' : dtwConfidence ? 'dtw' : 'model',
      minDistance: dtwResult?.minDistance,
      lexiconKey: lexiconEntry.key,
      twoHandsRatio,
      averageInterHandDistance,
      dtwConfidence,
      modelConfidence,
      topModelCandidates: modelResult?.topCandidates ?? [],
      boosted: confidenceBoost > 0,
    },
  }
}

export function createGestureSequenceRecognizer() {
  const history = []
  const holaConfig = getHolaConfig()
  const zConfig = getDynamicLetterConfig('lsm_z')
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
        (frame) => (
          frame.reliableHand &&
          frame.nearHead &&
          frame.twoFingerHandshape &&
          frame.palmFacingCamera
        )
      )

      const suppressStatic =
        activeGestureFrames.length >= 4 &&
        (() => {
          const xValues = activeGestureFrames.map((frame) => frame.palmCenter.x)
          const rangeX = Math.max(...xValues) - Math.min(...xValues)
          return rangeX >= holaConfig.minSuppressRangeX
        })()

      const twoHandsFrames = suppressWindow.filter((frame) => frame.twoHandsVisible)
      const twoHandsAverageDistance = twoHandsFrames.length
        ? twoHandsFrames.reduce((sum, frame) => sum + (frame.interHandDistance ?? 0), 0) / twoHandsFrames.length
        : 0
      const twoHandsSuppress =
        twoHandsFrames.length >= 4 &&
        (twoHandsFrames.length / Math.max(suppressWindow.length, 1)) >= 0.55 &&
        twoHandsAverageDistance >= 0.1

      if (timestamp - lastGestureAt < holaConfig.cooldownMs) {
        return {
          gesture: null,
          suppressStatic: suppressStatic || twoHandsSuppress,
          debug: buildDebugState(frameSummary, history, suppressStatic || twoHandsSuppress, null),
        }
      }

<<<<<<< HEAD
      const dtwResult = classifyDTW(history)
      if (dtwResult && dtwResult.confidence > 0.75) {
=======
      const dynamicLetterZ = detectDynamicZ(history, zConfig)
      if (dynamicLetterZ) {
>>>>>>> origin/main
        const historySnapshot = history.slice()
        lastGestureAt = timestamp
        history.length = 0
        return {
          gesture: dynamicLetterZ,
          suppressStatic: true,
          debug: buildDebugState(frameSummary, historySnapshot, true, dynamicLetterZ.debug),
        }
      }

      const lexiconGesture = detectLexiconWord(history)
      if (lexiconGesture && lexiconGesture.gesture !== 'hola') {
        const historySnapshot = history.slice()
        lastGestureAt = timestamp
        history.length = 0
        return {
          gesture: lexiconGesture,
          suppressStatic: true,
          debug: buildDebugState(frameSummary, historySnapshot, true, lexiconGesture.debug),
        }
      }

      const gesture = detectHola(history, holaConfig)
      if (!gesture) {
        return {
          gesture: null,
          suppressStatic: suppressStatic || twoHandsSuppress,
          debug: buildDebugState(frameSummary, history, suppressStatic || twoHandsSuppress, null),
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
  const twoHandsCount = recent.filter((frame) => frame.twoHandsVisible).length
  const interHandDistanceAverage = recent.length
    ? recent.reduce((sum, frame) => sum + (frame.interHandDistance ?? 0), 0) / recent.length
    : 0

  return {
    currentFrame,
    frameCount: history.length,
    recentRangeX: rangeX,
    nearHeadRatio: recent.length ? nearHeadCount / recent.length : 0,
    twoFingerRatio: recent.length ? twoFingerCount / recent.length : 0,
    palmFacingRatio: recent.length ? palmFacingCount / recent.length : 0,
    reliableRatio: recent.length ? reliableCount / recent.length : 0,
    twoHandsRatio: recent.length ? twoHandsCount / recent.length : 0,
    interHandDistanceAverage,
    suppressStatic,
    detectionDebug,
  }
}
