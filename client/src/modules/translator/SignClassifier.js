import { extractHandFeatures } from './HandFeatureExtractor.js'
import { classifyStaticLSM } from './StaticLSMClassifier.js'

const HAND_QUALITY_EDGE_MARGIN = 0.04
const SMOOTHER_MIN_RATIO = 0.7

function formatFingerBit(value) {
  return value >= 0.75 ? 1 : value >= 0.35 ? 0.5 : 0
}

export function extractHandMetrics(landmarks) {
  const features = extractHandFeatures(landmarks)
  if (!features) return null

  const classification = classifyStaticLSM(features)

  return {
    features,
    classification,
    fingers: {
      thumb: { state: features.fingers.T, extended: features.fingers.T >= 0.75, direction: features.directions.T },
      index: { state: features.fingers.I, extended: features.fingers.I >= 0.75, direction: features.directions.I },
      middle: { state: features.fingers.M, extended: features.fingers.M >= 0.75, direction: features.directions.M },
      ring: { state: features.fingers.R, extended: features.fingers.R >= 0.75, direction: features.directions.R },
      pinky: { state: features.fingers.P, extended: features.fingers.P >= 0.75, direction: features.directions.P },
    },
    directions: features.directions,
    worldDirections: features.worldDirections,
    handOrientation: features.handOrientation,
    pairs: {
      indexMiddle: {
        gap: features.gap_IM,
        horizontal: features.directions.I === 'horizontal' && features.directions.M === 'horizontal',
        vertical: features.directions.I === 'up' && features.directions.M === 'up',
        crossed: features.crossed_IM,
      },
      middleRing: {
        gap: features.gap_MR,
        horizontal: features.directions.M === 'horizontal' && features.directions.R === 'horizontal',
        vertical: features.directions.M === 'up' && features.directions.R === 'up',
        crossed: features.crossed_MR,
      },
      ringPinky: {
        gap: features.gap_RP,
      },
    },
    relations: {
      thumbRole: features.thumb_role,
      crossedIM: features.crossed_IM,
      crossedMR: features.crossed_MR,
      pinchTI: features.pinch_TI,
      pinchTM: features.pinch_TM,
    },
    posture: {
      palmCenter: features.palmCenter,
      nonThumbExtendedCount: features.meta.nonThumbExtendedCount,
      nonThumbClosedCount: features.meta.nonThumbClosedCount,
    },
  }
}

export function debugFingers(landmarks) {
  const metrics = extractHandMetrics(landmarks)
  if (!metrics) return 'T:- I:- M:- R:- P:- gap:-'

  const { features } = metrics
  return [
    `T:${formatFingerBit(features.fingers.T)}`,
    `I:${formatFingerBit(features.fingers.I)}`,
    `M:${formatFingerBit(features.fingers.M)}`,
    `R:${formatFingerBit(features.fingers.R)}`,
    `P:${formatFingerBit(features.fingers.P)}`,
    `gap:${features.gap_IM.toFixed(2)}`,
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

  // Thresholds lowered to support hands farther from the camera
  const sizeScore = Math.max(0, Math.min(1, (area - 0.007) / 0.093))
  const widthScore = Math.max(0, Math.min(1, (width - 0.07) / 0.25))
  const heightScore = Math.max(0, Math.min(1, (height - 0.06) / 0.32))
  const edgeScore = Math.max(0, 1 - (edgeTouches / 6))

  const qualityScore =
    (sizeScore * 0.4) +
    (widthScore * 0.2) +
    (heightScore * 0.15) +
    (edgeScore * 0.25)

  const reasons = []
  if (edgeTouches >= 5) reasons.push('mano_recortada')
  if (area < 0.01) reasons.push('mano_pequena')
  if (width < 0.08) reasons.push('poco_ancho')
  if (height < 0.07) reasons.push('poco_alto')
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

export function classifySign(landmarks) {
  const features = extractHandFeatures(landmarks)
  if (!features) return null

  const classification = classifyStaticLSM(features)
  if (!classification.bestCandidate) return null

  return {
    letter: classification.bestCandidate.letter,
    confidence: classification.bestCandidate.confidence,
    candidates: classification.topCandidates,
    classifierDebug: classification,
    secondCandidateFailure: classification.topCandidates[1]?.failedRule ?? null,
  }
}

export function createSmoother(windowSize = 8) {
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
      if (ratio >= SMOOTHER_MIN_RATIO) {
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
