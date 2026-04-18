import { getTemplates } from './KNNStorage.js'
import { LM } from './HandNormalizer.js'
import { frameModelToSequenceVector } from './HandSequenceModel.js'

function euclideanDistance(v1, v2) {
  let sum = 0
  for (let i = 0; i < v1.length; i += 1) {
    sum += Math.pow(v1[i] - v2[i], 2)
  }
  return Math.sqrt(sum)
}

function average(values) {
  if (!values.length) return Infinity
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function dist2D(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function vectorToLandmarks(vector) {
  if (!Array.isArray(vector) || vector.length < 63) return null

  const points = []
  for (let index = 0; index < 21; index += 1) {
    points.push({
      x: Number(vector[index * 3]) || 0,
      y: Number(vector[(index * 3) + 1]) || 0,
      z: Number(vector[(index * 3) + 2]) || 0,
    })
  }
  return points
}

function buildPalmPoseDescriptor(points) {
  if (!Array.isArray(points) || points.length !== 21) return null

  const descriptor = []
  const weights = []
  const tipIndices = [
    LM.THUMB_TIP,
    LM.INDEX_TIP,
    LM.MIDDLE_TIP,
    LM.RING_TIP,
    LM.PINKY_TIP,
  ]

  for (const tipIndex of tipIndices) {
    const point = points[tipIndex]
    descriptor.push(point.x, point.y, point.z || 0)
    weights.push(1.8, 1.8, 0.55)
  }

  for (const tipIndex of tipIndices) {
    const point = points[tipIndex]
    descriptor.push(Math.hypot(point.x, point.y))
    weights.push(1.25)
  }

  descriptor.push(
    dist2D(points[LM.THUMB_TIP], points[LM.INDEX_TIP]),
    dist2D(points[LM.THUMB_TIP], points[LM.MIDDLE_TIP]),
    Math.abs(points[LM.INDEX_TIP].x - points[LM.MIDDLE_TIP].x),
    Math.abs(points[LM.MIDDLE_TIP].x - points[LM.RING_TIP].x),
  )
  weights.push(1.55, 1.1, 1.2, 1.2)

  descriptor.push(
    points[LM.THUMB_MCP].y - points[LM.THUMB_TIP].y,
    points[LM.INDEX_MCP].y - points[LM.INDEX_TIP].y,
    points[LM.MIDDLE_MCP].y - points[LM.MIDDLE_TIP].y,
    points[LM.RING_MCP].y - points[LM.RING_TIP].y,
    points[LM.PINKY_MCP].y - points[LM.PINKY_TIP].y,
  )
  weights.push(1, 1.1, 1.1, 1.1, 1.1)

  return { descriptor, weights }
}

function weightedDescriptorDistance(a, b, weights) {
  let weightedSum = 0
  let totalWeight = 0

  for (let index = 0; index < a.length; index += 1) {
    const weight = weights[index] ?? 1
    const delta = a[index] - b[index]
    weightedSum += weight * delta * delta
    totalWeight += weight
  }

  return Math.sqrt(weightedSum / (totalWeight || 1))
}

// Distancia RMS media por feature del descriptor palm-relative.
// Es mucho más estable con pocos ejemplos que los 63 landmarks crudos.
const KNN_CONFIDENCE_THRESHOLD = 0.28
const STATIC_LABEL_NEIGHBORS = 2
const KNN_MIN_CONFIDENCE = 0.42
const KNN_MIN_MARGIN = 0.08
const KNN_MIN_DISTANCE_SEPARATION = 0.02

export function classifyKNN(canonicalLandmarks) {
  if (!canonicalLandmarks || canonicalLandmarks.length !== 21) return null

  const inputPose = buildPalmPoseDescriptor(canonicalLandmarks)
  if (!inputPose) return null

  const dataset = getTemplates()
  const labels = Object.keys(dataset)
  if (!labels.length) return null

  const perLabelStats = []

  for (const label of labels) {
    const distances = []

    for (const template of dataset[label] ?? []) {
      if (template.type === 'sequence' || !template.vector) continue

      const templateLandmarks = vectorToLandmarks(template.vector)
      const templatePose = buildPalmPoseDescriptor(templateLandmarks)
      if (!templatePose) continue

      distances.push(
        weightedDescriptorDistance(
          inputPose.descriptor,
          templatePose.descriptor,
          inputPose.weights,
        )
      )
    }

    if (!distances.length) continue

    distances.sort((a, b) => a - b)
    const k = Math.min(STATIC_LABEL_NEIGHBORS, distances.length)
    const avgDistance = average(distances.slice(0, k))
    const bestDistance = distances[0]
    const sampleCount = distances.length
    const supportBonus = sampleCount >= 4 ? 0.04 : sampleCount >= 2 ? 0.02 : 0

    perLabelStats.push({
      letter: label,
      sampleCount,
      k,
      bestDistance,
      avgDistance,
      confidence: Math.min(
        0.99,
        Math.max(0, 1 - (avgDistance / KNN_CONFIDENCE_THRESHOLD)) + supportBonus
      ),
    })
  }

  if (!perLabelStats.length) return null

  const topCandidates = perLabelStats
    .filter((entry) => entry.confidence >= 0.24)
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence
      return a.avgDistance - b.avgDistance
    })
    .slice(0, 5)

  if (!topCandidates.length) return null

  const bestCandidate = topCandidates[0]
  const secondCandidate = topCandidates[1] ?? null
  const margin = secondCandidate
    ? bestCandidate.confidence - secondCandidate.confidence
    : bestCandidate.confidence
  const distanceSeparation = secondCandidate
    ? secondCandidate.avgDistance - bestCandidate.avgDistance
    : bestCandidate.avgDistance

  if (bestCandidate.confidence < KNN_MIN_CONFIDENCE) {
    return null
  }

  if (
    secondCandidate &&
    margin < KNN_MIN_MARGIN &&
    distanceSeparation < KNN_MIN_DISTANCE_SEPARATION
  ) {
    return null
  }

  return {
    bestCandidate: {
      letter: bestCandidate.letter,
      confidence: bestCandidate.confidence,
    },
    topCandidates,
    method: 'knn_palm',
    minDistance: bestCandidate.avgDistance,
    margin,
    distanceSeparation,
  }
}

// ============== DTW MATCHING (DYNAMIC SECUENCIAS) =================

function dtwDistance(seq1, seq2) {
  const m = seq1.length
  const n = seq2.length
  if (m === 0 || n === 0) return Infinity

  const dtw = Array(m + 1).fill(null).map(() => Array(n + 1).fill(Infinity))
  dtw[0][0] = 0

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = euclideanDistance(seq1[i - 1], seq2[j - 1])
      dtw[i][j] = cost + Math.min(
        dtw[i - 1][j],    // insertion
        dtw[i][j - 1],    // deletion
        dtw[i - 1][j - 1] // match
      )
    }
  }
  return dtw[m][n] / (m + n)
}

function extractSequenceVector(f) {
  return frameModelToSequenceVector(f?.frameModel ?? f)
}

const DTW_CONFIDENCE_THRESHOLD = 0.55

export function classifyDTW(framesHistory) {
  if (!framesHistory || framesHistory.length < 5) return null

  const inputSequence = framesHistory.map(extractSequenceVector)
  
  const dataset = getTemplates()
  const gestures = Object.keys(dataset)
  if (gestures.length === 0) return null

  let bestMatch = null
  let minDistance = Infinity

  for (const label of gestures) {
    const templates = dataset[label]
    for (const template of templates) {
      if (template.type !== 'sequence') continue
      
      const savedSequence = template.frames.map(extractSequenceVector)
      const dist = dtwDistance(inputSequence, savedSequence)
      
      if (dist < minDistance) {
        minDistance = dist
        bestMatch = label
      }
    }
  }

  if (!bestMatch) return null

  const confidence = Math.max(0, 1 - (minDistance / DTW_CONFIDENCE_THRESHOLD))
  
  if (confidence < 0.4) return null

  return {
    gesture: bestMatch,
    confidence,
    minDistance,
    method: 'dtw'
  }
}
