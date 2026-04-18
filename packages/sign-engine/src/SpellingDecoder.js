/**
 * SpellingDecoder.js
 *
 * Capa ligera de decodificacion para finger spelling.
 * El clasificador sigue entregando letras crudas, pero aqui intentamos
 * reconstruir la palabra que el usuario quiso deletrear.
 *
 * Objetivo del hackathon:
 * - Mapear confusiones visuales frecuentes entre letras.
 * - Priorizar palabras utiles para el demo (por ejemplo "hola").
 * - Mantener todo configurable en un solo archivo.
 */

const LETTER_CONFUSIONS = {
  a: ['s', 'e'],
  b: ['w', 'd'],
  c: ['o', 'e'],
  d: ['l', 'b'],
  e: ['a', 'c', 'o', 's'],
  f: ['o', 'p'],
  g: ['q', 'l'],
  h: ['u', 'v', 'k'],
  i: ['y'],
  k: ['h', 'u', 'v', 'p'],
  l: ['d', 'g'],
  m: ['n', 't'],
  n: ['m', 't'],
  o: ['c', 'e', 'f'],
  p: ['k', 'f', 'q'],
  q: ['g', 'p'],
  r: ['u', 'v'],
  s: ['a', 'e'],
  t: ['m', 'n'],
  u: ['v', 'r', 'h', 'k'],
  v: ['u', 'r', 'h', 'k'],
  w: ['b'],
  y: ['i'],
}

// Palabras frecuentes para el demo y contextos de accesibilidad.
// Puedes ampliar esta lista segun el flujo que quieran presentar.
const SPELLING_LEXICON = [
  { word: 'hola', priority: 1.0 },
  { word: 'adios', priority: 0.9 },
  { word: 'gracias', priority: 0.9 },
  { word: 'favor', priority: 0.8 },
  { word: 'ayuda', priority: 1.0 },
  { word: 'doctor', priority: 0.9 },
  { word: 'hospital', priority: 0.9 },
  { word: 'agua', priority: 0.8 },
  { word: 'bano', priority: 0.8 },
  { word: 'comida', priority: 0.7 },
  { word: 'dolor', priority: 0.9 },
  { word: 'medicina', priority: 0.8 },
  { word: 'nombre', priority: 0.8 },
  { word: 'amigo', priority: 0.7 },
  { word: 'amiga', priority: 0.7 },
  { word: 'familia', priority: 0.7 },
  { word: 'mama', priority: 0.7 },
  { word: 'papa', priority: 0.7 },
  { word: 'si', priority: 0.8 },
  { word: 'no', priority: 0.8 },
  { word: 'bien', priority: 0.7 },
  { word: 'mal', priority: 0.7 },
  { word: 'trabajo', priority: 0.6 },
  { word: 'escuela', priority: 0.6 },
  { word: 'telefono', priority: 0.6 },
  { word: 'mensaje', priority: 0.6 },
  { word: 'interprete', priority: 0.9 },
  { word: 'sordo', priority: 0.7 },
  { word: 'sorda', priority: 0.7 },
  { word: 'hablar', priority: 0.6 },
  { word: 'escuchar', priority: 0.6 },
  { word: 'practica', priority: 0.5 },
  { word: 'aprender', priority: 0.5 },
  { word: 'senas', priority: 0.7 },
  { word: 'holaa', priority: 0.2 },
]

function sanitizeWord(word) {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '')
}

function collapseRuns(word, maxRun = 1) {
  if (!word) return ''

  let result = ''
  let currentChar = ''
  let currentRun = 0

  for (const char of word) {
    if (char === currentChar) {
      currentRun += 1
    } else {
      currentChar = char
      currentRun = 1
    }

    if (currentRun <= maxRun) {
      result += char
    }
  }

  return result
}

function areConfusable(a, b) {
  return LETTER_CONFUSIONS[a]?.includes(b) || LETTER_CONFUSIONS[b]?.includes(a)
}

function substitutionCost(a, b) {
  if (a === b) return 0
  if (areConfusable(a, b)) return 0.35
  return 1
}

function deletionCost(word, index) {
  // Penaliza menos las repeticiones accidentales: "hoola" -> "hola"
  if (index > 0 && word[index] === word[index - 1]) return 0.25
  return 1
}

function insertionCost(candidate, index) {
  if (index > 0 && candidate[index] === candidate[index - 1]) return 0.25
  return 1
}

function weightedDistance(source, target) {
  const rows = source.length + 1
  const cols = target.length + 1
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0))

  for (let i = 1; i < rows; i += 1) {
    dp[i][0] = dp[i - 1][0] + deletionCost(source, i - 1)
  }

  for (let j = 1; j < cols; j += 1) {
    dp[0][j] = dp[0][j - 1] + insertionCost(target, j - 1)
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const del = dp[i - 1][j] + deletionCost(source, i - 1)
      const ins = dp[i][j - 1] + insertionCost(target, j - 1)
      const sub = dp[i - 1][j - 1] + substitutionCost(source[i - 1], target[j - 1])

      dp[i][j] = Math.min(del, ins, sub)
    }
  }

  return dp[source.length][target.length]
}

function getAcceptanceThreshold(length) {
  if (length <= 2) return 0.45
  if (length <= 4) return 1.1
  if (length <= 7) return 1.8
  return 2.4
}

function scoreCandidate(input, candidate) {
  const distance = weightedDistance(input, candidate.word)
  const priorityBonus = candidate.priority * 0.2

  return {
    word: candidate.word,
    distance,
    score: distance - priorityBonus,
    priority: candidate.priority,
  }
}

function pickBestCandidate(input) {
  let best = null

  for (const candidate of SPELLING_LEXICON) {
    const scored = scoreCandidate(input, candidate)

    if (
      !best ||
      scored.score < best.score ||
      (scored.score === best.score && scored.priority > best.priority)
    ) {
      best = scored
    }
  }

  return best
}

export function decodeFingerSpelling(rawWord) {
  const normalized = sanitizeWord(rawWord)

  if (!normalized) {
    return {
      raw: rawWord,
      normalized: '',
      corrected: '',
      changed: false,
      confidence: 0,
      reason: 'empty',
    }
  }

  const compact = collapseRuns(normalized, 1)
  const semiCompact = collapseRuns(normalized, 2)
  const variants = Array.from(new Set([normalized, compact, semiCompact]))

  let best = null

  for (const variant of variants) {
    const candidate = pickBestCandidate(variant)
    if (!candidate) continue

    if (
      !best ||
      candidate.score < best.score ||
      (candidate.score === best.score && candidate.priority > best.priority)
    ) {
      best = {
        ...candidate,
        sourceVariant: variant,
      }
    }
  }

  if (!best) {
    return {
      raw: rawWord,
      normalized,
      corrected: normalized,
      changed: false,
      confidence: 0.2,
      reason: 'no_candidate',
    }
  }

  const threshold = getAcceptanceThreshold(best.sourceVariant.length)
  const accepted = best.distance <= threshold
  const confidence = Math.max(0, 1 - best.distance / Math.max(best.word.length, 1))

  return {
    raw: rawWord,
    normalized,
    corrected: accepted ? best.word : normalized,
    changed: accepted && best.word !== normalized,
    confidence,
    reason: accepted ? 'lexicon_match' : 'raw_kept',
    distance: best.distance,
    matchedWord: best.word,
    sourceVariant: best.sourceVariant,
  }
}

export const SPELLING_DEBUG_CONFIG = {
  letterConfusions: LETTER_CONFUSIONS,
  lexicon: SPELLING_LEXICON,
}
