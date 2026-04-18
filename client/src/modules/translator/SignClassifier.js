import { extractHandFeatures } from './HandFeatureExtractor.js'
import { classifyStaticLSM } from './StaticLSMClassifier.js'
import { classifyKNN } from '../training/KNNClassifier.js'

const HAND_QUALITY_EDGE_MARGIN = 0.04
const SMOOTHER_MIN_RATIO = 0.7

function formatFingerBit(value) {
  return value >= 0.75 ? 1 : value >= 0.35 ? 0.5 : 0
}

export function extractHandMetrics(landmarks, meta = {}) {
  const worldLandmarks = meta.worldLandmarks || meta.handWorldLandmarks
  const features = extractHandFeatures(landmarks, worldLandmarks)
  if (!features) return null

  let classification = classifyStaticLSM(features)
  
  // Intervención KNN
  const knnResult = classifyKNN(features.points)
  if (knnResult && knnResult.bestCandidate.confidence >= 0.70) {
    classification = knnResult
  }

  return {
    features,
    classification,
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

  return {
    letter: metrics.classification.bestCandidate.letter,
    confidence: metrics.classification.bestCandidate.confidence,
    candidates: metrics.classification.topCandidates,
    classifierDebug: metrics.classification,
    secondCandidateFailure: metrics.classification.topCandidates[1]?.failedRule ?? null,
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
