import { extractHandFeatures } from './HandFeatureExtractor.js'
import { classifyStaticLSM } from './StaticLSMClassifier.js'
import { classifyKNN } from './KNNClassifier.js'

const HAND_QUALITY_EDGE_MARGIN = 0.04
const FINAL_CLASSIFICATION_MIN_CONFIDENCE = 0.72
const FINAL_CLASSIFICATION_MIN_MARGIN = 0.06

function formatFingerBit(value) {
  return value >= 0.75 ? 1 : value >= 0.35 ? 0.5 : 0
}

function combineClassification(staticClassification, knnClassification) {
  if (!staticClassification) return knnClassification
  if (!knnClassification?.topCandidates?.length) return staticClassification

  const staticTop = staticClassification.topCandidates ?? []
  const rawKnnTop = knnClassification.topCandidates ?? []
  const staticBest = staticTop[0] ?? staticClassification.bestCandidate
  const staticMargin =
    staticTop.length > 1
      ? staticTop[0].confidence - staticTop[1].confidence
      : staticTop[0]?.confidence ?? 0
  const staticCompatibilityLetters = new Set(staticTop.slice(0, 3).map((candidate) => candidate.letter))
  const compatibleKnnTop =
    staticCompatibilityLetters.size > 0
      ? rawKnnTop.filter((candidate) => staticCompatibilityLetters.has(candidate.letter))
      : rawKnnTop
  const strongStaticSignal =
    Boolean(staticBest) &&
    (
      staticBest.confidence >= 0.8 ||
      staticMargin >= 0.14
    )

  if (strongStaticSignal && compatibleKnnTop.length === 0) {
    return {
      ...staticClassification,
      method: 'static_guarded',
      fusion: {
        staticWeight: 1,
        knnWeight: 0,
        staticMargin,
        agreement: false,
        knnRejectedReason: 'outside_static_top3',
      },
    }
  }

  const knnTop = compatibleKnnTop.length > 0 ? compatibleKnnTop : rawKnnTop
  const knnBest = knnTop[0] ?? knnClassification.bestCandidate

  let staticWeight = 0.82
  let knnWeight = 0.18

  if (knnBest && staticBest?.letter === knnBest.letter) {
    staticWeight = 0.68
    knnWeight = 0.32
  } else if (
    knnBest &&
    staticBest &&
    staticBest.confidence < 0.84 &&
    staticMargin < 0.14 &&
    knnBest.confidence >= 0.72
  ) {
    staticWeight = 0.56
    knnWeight = 0.44
  } else if (staticBest && staticBest.confidence >= 0.9 && staticMargin >= 0.18) {
    staticWeight = 0.92
    knnWeight = 0.08
  }

  const candidateMap = new Map()

  for (const candidate of staticTop.slice(0, 5)) {
    candidateMap.set(candidate.letter, {
      letter: candidate.letter,
      confidence: candidate.confidence * staticWeight,
      staticConfidence: candidate.confidence,
      knnConfidence: 0,
      failedRule: candidate.failedRule,
      sources: ['vector'],
    })
  }

  for (const candidate of knnTop.slice(0, 5)) {
    const existing = candidateMap.get(candidate.letter)
    if (existing) {
      existing.confidence += candidate.confidence * knnWeight
      existing.knnConfidence = candidate.confidence
      existing.sources.push('dataset')
      if (candidate.letter === staticBest?.letter) {
        existing.confidence += 0.05
      }
    } else {
      candidateMap.set(candidate.letter, {
        letter: candidate.letter,
        confidence: candidate.confidence * knnWeight,
        staticConfidence: 0,
        knnConfidence: candidate.confidence,
        failedRule: 'dataset_only',
        sources: ['dataset'],
      })
    }
  }

  const topCandidates = [...candidateMap.values()]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)

  const bestCandidate = topCandidates[0] ?? staticClassification.bestCandidate

  return {
    ...staticClassification,
    method: 'hybrid',
    bestCandidate: {
      letter: bestCandidate.letter,
      confidence: Math.min(bestCandidate.confidence, 0.99),
    },
    topCandidates: topCandidates.map((candidate) => ({
      ...candidate,
      confidence: Math.min(candidate.confidence, 0.99),
    })),
    staticTopCandidates: staticTop,
    knnTopCandidates: knnTop,
    fusion: {
      staticWeight,
      knnWeight,
      staticMargin,
      agreement: staticBest?.letter === knnBest?.letter,
      knnScope: compatibleKnnTop.length > 0 ? 'static_top3' : 'all',
    },
  }
}

export function extractHandMetrics(landmarks, meta = {}) {
  const worldLandmarks = meta.worldLandmarks || meta.handWorldLandmarks
  const features = extractHandFeatures(landmarks, worldLandmarks)
  if (!features) return null

  const staticClassification = classifyStaticLSM(features)
  const knnResult = classifyKNN(features.points)
  const classification = combineClassification(staticClassification, knnResult)

  return {
    features,
    classification,
    classifiers: {
      static: staticClassification,
      knn: knnResult,
    },
    fingers: {
      thumb: { state: features.fingers.T, extended: features.fingers.T >= 0.75, direction: features.camera_directions.T, localDirection: features.directions.T },
      index: { state: features.fingers.I, extended: features.fingers.I >= 0.75, direction: features.camera_directions.I, localDirection: features.directions.I },
      middle: { state: features.fingers.M, extended: features.fingers.M >= 0.75, direction: features.camera_directions.M, localDirection: features.directions.M },
      ring: { state: features.fingers.R, extended: features.fingers.R >= 0.75, direction: features.camera_directions.R, localDirection: features.directions.R },
      pinky: { state: features.fingers.P, extended: features.fingers.P >= 0.75, direction: features.camera_directions.P, localDirection: features.directions.P },
    },
    directions: {
      camera: features.camera_directions,
      local: features.directions,
      cameraVectors: features.camera_vectors,
      localVectors: features.local_vectors,
    },
    pairs: {
      indexMiddle: {
        gap: features.gap_IM,
        horizontal: features.camera_directions.I === 'horizontal' && features.camera_directions.M === 'horizontal',
        vertical: features.camera_directions.I === 'up' && features.camera_directions.M === 'up',
        crossed: features.crossed_IM,
        localHorizontal: features.directions.I === 'horizontal' && features.directions.M === 'horizontal',
        localVertical: features.directions.I === 'up' && features.directions.M === 'up',
      },
      middleRing: {
        gap: features.gap_MR,
        horizontal: features.camera_directions.M === 'horizontal' && features.camera_directions.R === 'horizontal',
        vertical: features.camera_directions.M === 'up' && features.camera_directions.R === 'up',
        localHorizontal: features.directions.M === 'horizontal' && features.directions.R === 'horizontal',
        localVertical: features.directions.M === 'up' && features.directions.R === 'up',
      },
    },
    relations: {
      thumbRole: features.thumb_role,
      crossedIM: features.crossed_IM,
      pinchTI: features.pinch_TI,
      pinchTM: features.pinch_TM,
      palmOrientation: features.palm_orientation,
    },
    posture: {
      palmCenter: features.palmCenter,
      nonThumbExtendedCount: features.meta.nonThumbExtendedCount,
      nonThumbClosedCount: features.meta.nonThumbClosedCount,
      handCount: meta.handsCount ?? 1,
    },
    orientation: {
      palmOrientation: features.palm_orientation,
      palmNormal: features.palm_normal,
      axes: features.axes,
    },
  }
}

export function debugFingers(landmarks, meta = {}) {
  const metrics = extractHandMetrics(landmarks, meta)
  if (!metrics) return 'T:- I:- M:- R:- P:- gap:-'

  const { features } = metrics
  return [
    `T:${formatFingerBit(features.fingers.T)}`,
    `I:${formatFingerBit(features.fingers.I)}`,
    `M:${formatFingerBit(features.fingers.M)}`,
    `R:${formatFingerBit(features.fingers.R)}`,
    `P:${formatFingerBit(features.fingers.P)}`,
    `gap:${features.gap_IM.toFixed(2)}`,
    `orien:${features.palm_orientation}`,
  ].join(' ')
}

export function assessHandDetectionQuality(landmarks) {
  if (!landmarks || landmarks.length !== 21) {
    return {
      reliable: false,
      qualityScore: 0,
      status: 'poor',
      reasons: ['sin_landmarks'],
      bbox: null,
      edgeTouches: 0,
      area: 0,
    }
  }

  const xs = landmarks.map((point) => point.x)
  const ys = landmarks.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const width = maxX - minX
  const height = maxY - minY
  const area = width * height

  const edgeTouches = landmarks.filter((point) => (
    point.x < HAND_QUALITY_EDGE_MARGIN ||
    point.x > 1 - HAND_QUALITY_EDGE_MARGIN ||
    point.y < HAND_QUALITY_EDGE_MARGIN ||
    point.y > 1 - HAND_QUALITY_EDGE_MARGIN
  )).length

  const sizeScore = Math.max(0, Math.min(1, (area - 0.015) / 0.085))
  const widthScore = Math.max(0, Math.min(1, (width - 0.1) / 0.22))
  const heightScore = Math.max(0, Math.min(1, (height - 0.1) / 0.28))
  const edgeScore = Math.max(0, 1 - (edgeTouches / 6))

  const qualityScore =
    (sizeScore * 0.4) +
    (widthScore * 0.2) +
    (heightScore * 0.15) +
    (edgeScore * 0.25)

  const reasons = []
  if (edgeTouches >= 5) reasons.push('mano_recortada')
  if (area < 0.02) reasons.push('mano_pequena')
  if (width < 0.11) reasons.push('poco_ancho')
  if (height < 0.11) reasons.push('poco_alto')
  if (qualityScore < 0.44) reasons.push('landmarks_inestables')

  const status =
    qualityScore >= 0.66 && edgeTouches <= 4
      ? 'good'
      : qualityScore >= 0.44 && edgeTouches <= 6
        ? 'fair'
        : 'poor'

  return {
    reliable: status !== 'poor',
    qualityScore,
    status,
    reasons,
    edgeTouches,
    area,
    bbox: {
      minX,
      maxX,
      minY,
      maxY,
      width,
      height,
    },
  }
}

export function classifySign(landmarks, meta = {}) {
  const metrics = extractHandMetrics(landmarks, meta)
  if (!metrics || !metrics.classification.bestCandidate) return null

  const topCandidates = metrics.classification.topCandidates ?? []
  const secondCandidate = topCandidates[1] ?? null
  const candidateMargin =
    secondCandidate
      ? metrics.classification.bestCandidate.confidence - secondCandidate.confidence
      : metrics.classification.bestCandidate.confidence

  if (
    metrics.classification.bestCandidate.confidence < FINAL_CLASSIFICATION_MIN_CONFIDENCE ||
    candidateMargin < FINAL_CLASSIFICATION_MIN_MARGIN
  ) {
    return null
  }

  let predictedLetter = metrics.classification.bestCandidate.letter

  // --- HACKATHON OVERRIDES ---
  // 1. Correccion W vs B
  if (
    predictedLetter === 'W' ||
    predictedLetter === 'B' ||
    predictedLetter === 'w' ||
    predictedLetter === 'b'
  ) {
    // Si el meñique (P) esta muy extendido (> 0.70), forzamos a que sea B
    if (metrics.features.fingers.P >= 0.7) {
      predictedLetter = 'B'
    } else {
      predictedLetter = 'W'
    }
  }

  // 2. Correccion S vs T (Ambas son punos, pero en la T el pulgar sube mas)
  if (
    predictedLetter === 'S' ||
    predictedLetter === 'T' ||
    predictedLetter === 's' ||
    predictedLetter === 't'
  ) {
    // En MediaPipe, Y crece hacia abajo. Si el pulgar esta mas "arriba" (menor Y), es T.
    if (landmarks?.[4]?.y < landmarks?.[5]?.y) {
      predictedLetter = 'T'
    } else {
      predictedLetter = 'S'
    }
  }
  // ---------------------------

  return {
    letter: predictedLetter,
    confidence: metrics.classification.bestCandidate.confidence,
    candidates: topCandidates,
    classifierDebug: metrics.classification,
    secondCandidateFailure: secondCandidate?.failedRule ?? null,
  }
}

export function createSmoother(windowSize = 15) {
  const buffer = []

  return {
    push(prediction) {
      if (!prediction) return null

      buffer.push(prediction.letter)
      if (buffer.length > windowSize) buffer.shift()

      const frequency = buffer.reduce((acc, letter) => {
        acc[letter] = (acc[letter] || 0) + 1
        return acc
      }, {})

      const topLetter = Object.entries(frequency).sort((a, b) => b[1] - a[1])[0]
      if (!topLetter) return null

      const ratio = topLetter[1] / buffer.length
      if (ratio >= 0.85) {
        return {
          letter: topLetter[0],
          confidence: ratio,
        }
      }

      return null
    },
    reset() {
      buffer.length = 0
    },
  }
}
