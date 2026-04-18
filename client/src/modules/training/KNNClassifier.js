import { getTemplates } from './KNNStorage.js'

function euclideanDistance(v1, v2) {
  let sum = 0
  for (let i = 0; i < v1.length; i++) {
    sum += Math.pow(v1[i] - v2[i], 2)
  }
  return Math.sqrt(sum)
}

// Umbral estricto para aceptar el molde (Distancia euclidiana máxima permisible)
// Valores menores = mayor rigor de similitud.
const KNN_CONFIDENCE_THRESHOLD = 0.65 

export function classifyKNN(canonicalLandmarks) {
  if (!canonicalLandmarks || canonicalLandmarks.length !== 21) return null

  const dataset = getTemplates()
  const letters = Object.keys(dataset)
  
  let totalTemplates = 0
  for(const l of letters) totalTemplates += dataset[l].length

  if (totalTemplates === 0) return null

  const inputVector = canonicalLandmarks.flatMap(p => [p.x, p.y, p.z || 0])

  let bestMatch = null
  let minDistance = Infinity

  // K-Nearest Neighbors (K = 1, buscamos el vecino idéntico más cercano absoluto)
  for (const letter of letters) {
    const templates = dataset[letter]
    for (const template of templates) {
      if (template.type === 'sequence' || !template.vector) continue

      const dist = euclideanDistance(inputVector, template.vector)
      if (dist < minDistance) {
        minDistance = dist
        bestMatch = letter
      }
    }
  }

  if (!bestMatch) return null

  // Convertir la distancia a un pseudo-porcentaje de confianza (0.0 a 1.0)
  const confidence = Math.max(0, 1 - (minDistance / KNN_CONFIDENCE_THRESHOLD))

  // Solo devolver si la confianza es suficientemente buena para ignorar la heurística base
  if (confidence < 0.4) {
    return null 
  }

  return {
    bestCandidate: {
      letter: bestMatch,
      confidence: confidence
    },
    topCandidates: [{ letter: bestMatch, confidence }],
    method: 'knn',
    minDistance
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
  let relX = 0, relY = 0
  const face = f.faceAnchor
  const palm = f.palmCenter
  
  if (face && palm) {
    relX = (palm.x - face.center.x) / face.width
    relY = (palm.y - face.center.y) / face.height
  }
  
  // Extraemos la forma base
  const shape = (f.canonical || f.features?.points)
  const canonicalVector = shape ? shape.flatMap(p => [p.x, p.y, p.z || 0]) : Array(63).fill(0)
  
  // Damos más peso al movimiento relativo a la cara (multiplicador 5)
  return [relX * 5, relY * 5, ...canonicalVector]
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
