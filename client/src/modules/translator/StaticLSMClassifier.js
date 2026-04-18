import { LM } from './HandNormalizer.js'

const MIN_SCORE = 0.72

function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

function scoreState(actual, expected) {
  if (expected === 1) return clamp01(actual)
  if (expected === 0) return clamp01(1 - actual)
  return clamp01(1 - (Math.abs(actual - 0.5) / 0.5))
}

function scoreDirection(actual, expected) {
  return actual === expected ? 1 : 0
}

function scoreLessThan(value, target, softness = 0.05) {
  if (value <= target) return 1
  return clamp01(1 - ((value - target) / softness))
}

function scoreGreaterThan(value, target, softness = 0.07) {
  if (value >= target) return 1
  return clamp01(1 - ((target - value) / softness))
}

function scoreRange(value, min, max, softness = 0.08) {
  if (value >= min && value <= max) return 1
  if (value < min) return clamp01(1 - ((min - value) / softness))
  return clamp01(1 - ((value - max) / softness))
}

function scoreBoolean(value, expected = true) {
  return value === expected ? 1 : 0
}

function scoreRole(actual, expected) {
  return actual === expected ? 1 : 0
}

function scoreCurlUp(value) {
  return scoreLessThan(value, -0.12, 0.12)
}

function scoreCurlDown(value) {
  return scoreGreaterThan(value, 0.08, 0.14)
}

function scoreCurlCurled(value) {
  return scoreRange(value, -0.04, 0.18, 0.16)
}

function weightedAverage(checks) {
  let totalWeight = 0
  let total = 0

  for (const check of checks) {
    totalWeight += check.weight
    total += check.weight * check.score
  }

  return totalWeight ? total / totalWeight : 0
}

function check(label, score, weight = 1, critical = false) {
  return {
    label,
    score: clamp01(score),
    weight,
    critical,
  }
}

function finalizeCandidate(letter, shapeChecks, relationChecks, zoneChecks) {
  const shapeScore = weightedAverage(shapeChecks)
  const relationScore = weightedAverage(relationChecks)
  const zoneScore = weightedAverage(zoneChecks)

  const failedChecks = [...shapeChecks, ...relationChecks, ...zoneChecks]
    .filter((entry) => entry.score < 0.68)
    .sort((a, b) => a.score - b.score)

  const criticalFailures = failedChecks.filter((entry) => entry.critical)
  const baseConfidence =
    (shapeScore * 0.45) +
    (relationScore * 0.35) +
    (zoneScore * 0.2)

  const penalty =
    criticalFailures.length === 0
      ? 1
      : criticalFailures.length === 1
        ? 0.55
        : 0.35

  return {
    letter,
    shapeScore,
    relationScore,
    zoneScore,
    confidence: baseConfidence * penalty,
    failedRule: failedChecks[0]?.label ?? 'sin falla critica',
    failedRules: failedChecks.map((entry) => entry.label),
  }
}

function fingerChecks(features, expectedMap) {
  return Object.entries(expectedMap).map(([key, expected]) => (
    check(`dedo ${key}=${expected}`, scoreState(features.fingers[key], expected), 1.4)
  ))
}

function curlChecks(features, expectedMap) {
  return Object.entries(expectedMap).map(([key, mode]) => {
    if (mode === 'up') {
      return check(`curl ${key} arriba`, scoreCurlUp(features.curl[key]), 1)
    }
    if (mode === 'down') {
      return check(`curl ${key} abajo`, scoreCurlDown(features.curl[key]), 1)
    }

    return check(`curl ${key} curvado`, scoreCurlCurled(features.curl[key]), 1)
  })
}

function getCoreCandidates(features) {
  const points = features.points
  const thumbTip = points[LM.THUMB_TIP]
  const indexMcp = points[LM.INDEX_MCP]
  const middleMcp = points[LM.MIDDLE_MCP]

  return [
    finalizeCandidate(
      'A',
      fingerChecks(features, { T: 1, I: 0, M: 0, R: 0, P: 0 }),
      [
        check('thumb_role side o over', ['side', 'over'].includes(features.thumb_role) ? 1 : 0, 3, true),
        check('sin pinch TI', 1 - scoreLessThan(features.pinch_TI, 0.16), 1.2),
      ],
      curlChecks(features, { I: 'curled', M: 'curled', R: 'curled', P: 'curled' })
    ),
    finalizeCandidate(
      'B',
      fingerChecks(features, { T: 0, I: 1, M: 1, R: 1, P: 1 }),
      [
        check('gap_IM compacto', scoreLessThan(features.gap_IM, 0.1), 1.6),
        check('gap_MR compacto', scoreLessThan(features.gap_MR, 0.1), 1.2),
      ],
      curlChecks(features, { I: 'up', M: 'up', R: 'up', P: 'up' })
    ),
    finalizeCandidate(
      'C',
      fingerChecks(features, { T: 0.5, I: 0.5, M: 0.5, R: 0.5, P: 0.5 }),
      [
        check('pinch TI medio', scoreRange(features.pinch_TI, 0.22, 0.48, 0.16), 1.6),
        check('gap_IM medio', scoreRange(features.gap_IM, 0.08, 0.22, 0.1), 1.2),
      ],
      [
        check('curl I curvado', scoreCurlCurled(features.curl.I), 1),
        check('curl M curvado', scoreCurlCurled(features.curl.M), 1),
        check('curl R curvado', scoreCurlCurled(features.curl.R), 1),
      ]
    ),
    finalizeCandidate(
      'D',
      fingerChecks(features, { I: 1, M: 0, R: 0, P: 0 }),
      [
        check('pinch_TM < 0.15', scoreLessThan(features.pinch_TM, 0.15), 3, true),
        check('direccion I up', scoreDirection(features.directions.I, 'up'), 2, true),
      ],
      curlChecks(features, { I: 'up', M: 'curled', R: 'curled', P: 'curled' })
    ),
    finalizeCandidate(
      'E',
      fingerChecks(features, { T: 0, I: 0, M: 0, R: 0, P: 0 }),
      [
        check('pulgar no extendido', scoreLessThan(features.fingers.T, 0.4), 2.5, true),
        check('thumb_role no under', features.thumb_role === 'under' ? 0 : 1, 2.6, true),
        check('sin pinch TI', 1 - scoreLessThan(features.pinch_TI, 0.16), 1),
      ],
      curlChecks(features, { I: 'curled', M: 'curled', R: 'curled', P: 'curled' })
    ),
    finalizeCandidate(
      'F',
      fingerChecks(features, { I: 0, M: 1, R: 1, P: 1 }),
      [
        check('pinch_TI < 0.15', scoreLessThan(features.pinch_TI, 0.15), 3, true),
        check('thumb_role pinch', scoreRole(features.thumb_role, 'pinch'), 2.2, true),
      ],
      curlChecks(features, { M: 'up', R: 'up', P: 'up' })
    ),
    finalizeCandidate(
      'G',
      fingerChecks(features, { T: 1, I: 1, M: 0, R: 0, P: 0 }),
      [
        check('direccion I horizontal', scoreDirection(features.directions.I, 'horizontal'), 2.2, true),
        check('direccion T horizontal', scoreDirection(features.directions.T, 'horizontal'), 2, true),
        check('thumb_role side', scoreRole(features.thumb_role, 'side'), 2, true),
      ],
      [
        check('curl I horizontal', scoreRange(features.curl.I, -0.08, 0.08, 0.12), 1),
        check('curl M curvado', scoreCurlCurled(features.curl.M), 1),
      ]
    ),
    finalizeCandidate(
      'H',
      fingerChecks(features, { T: 0, I: 1, M: 1, R: 0, P: 0 }),
      [
        check('direccion I horizontal', scoreDirection(features.directions.I, 'horizontal'), 2.2, true),
        check('direccion M horizontal', scoreDirection(features.directions.M, 'horizontal'), 2.2, true),
        check('gap_IM < 0.10', scoreLessThan(features.gap_IM, 0.1), 2.2, true),
      ],
      [
        check('curl I horizontal', scoreRange(features.curl.I, -0.08, 0.08, 0.12), 1),
        check('curl M horizontal', scoreRange(features.curl.M, -0.08, 0.08, 0.12), 1),
      ]
    ),
    finalizeCandidate(
      'I',
      fingerChecks(features, { T: 0, I: 0, M: 0, R: 0, P: 1 }),
      [
        check('direccion P up', scoreDirection(features.directions.P, 'up'), 2, true),
      ],
      curlChecks(features, { P: 'up', I: 'curled', M: 'curled', R: 'curled' })
    ),
    finalizeCandidate(
      'K',
      fingerChecks(features, { T: 1, I: 1, M: 1, R: 0, P: 0 }),
      [
        check('crossed_IM false', scoreBoolean(features.crossed_IM, false), 2.6, true),
        check('gap_IM > 0.14', scoreGreaterThan(features.gap_IM, 0.14), 2.2, true),
        check('thumb arriba de index_mcp', scoreGreaterThan(thumbTip.y - indexMcp.y, 0.03), 2.6, true),
        check('thumb_role between', scoreRole(features.thumb_role, 'between'), 2, true),
      ],
      curlChecks(features, { I: 'up', M: 'up', R: 'curled', P: 'curled' })
    ),
    finalizeCandidate(
      'L',
      fingerChecks(features, { T: 1, I: 1, M: 0, R: 0, P: 0 }),
      [
        check('direccion I up', scoreDirection(features.directions.I, 'up'), 2.2, true),
        check('direccion T horizontal', scoreDirection(features.directions.T, 'horizontal'), 2.2, true),
        check('thumb_role side', scoreRole(features.thumb_role, 'side'), 2.6, true),
        check('pinch_TM no', 1 - scoreLessThan(features.pinch_TM, 0.16), 1.2),
      ],
      [
        check('curl I up', scoreCurlUp(features.curl.I), 1),
        check('curl M curvado', scoreCurlCurled(features.curl.M), 1),
      ]
    ),
    finalizeCandidate(
      'M',
      fingerChecks(features, { T: 0, I: 0, M: 0, R: 0, P: 0 }),
      [
        check('thumb_role under', scoreRole(features.thumb_role, 'under'), 3, true),
        check('3 dedos sobre pulgar', scoreGreaterThan(features.meta.thumb_cover_count, 2.5, 0.6), 3, true),
      ],
      curlChecks(features, { I: 'curled', M: 'curled', R: 'curled', P: 'curled' })
    ),
    finalizeCandidate(
      'N',
      fingerChecks(features, { T: 0, I: 0, M: 0, R: 0, P: 0 }),
      [
        check('thumb_role under', scoreRole(features.thumb_role, 'under'), 3, true),
        check('2 dedos sobre pulgar', scoreRange(features.meta.thumb_cover_count, 1.7, 2.4, 0.4), 3, true),
      ],
      curlChecks(features, { I: 'curled', M: 'curled', R: 'curled', P: 'curled' })
    ),
    finalizeCandidate(
      'O',
      fingerChecks(features, { T: 0.5, I: 0.5, M: 0.5, R: 0.5, P: 0.5 }),
      [
        check('pinch_TI corto', scoreLessThan(features.pinch_TI, 0.14), 2.2, true),
        check('pinch_TM corto', scoreLessThan(features.pinch_TM, 0.2), 1.4),
        check('thumb_role pinch', scoreRole(features.thumb_role, 'pinch'), 1.8, true),
      ],
      [
        check('curl I curvado', scoreCurlCurled(features.curl.I), 1),
        check('curl M curvado', scoreCurlCurled(features.curl.M), 1),
        check('curl R curvado', scoreCurlCurled(features.curl.R), 1),
      ]
    ),
    finalizeCandidate(
      'P',
      fingerChecks(features, { T: 1, I: 1, M: 1, R: 0, P: 0 }),
      [
        check('direccion I down', scoreDirection(features.directions.I, 'down'), 2.2, true),
        check('direccion M down', scoreDirection(features.directions.M, 'down'), 2.2, true),
        check('thumb_role side', scoreRole(features.thumb_role, 'side'), 1.8),
        check('palma hacia abajo', ['down', 'back'].includes(features.palm_orientation) ? 1 : 0, 1.5),
      ],
      curlChecks(features, { I: 'down', M: 'down', R: 'curled', P: 'curled' })
    ),
    finalizeCandidate(
      'Q',
      fingerChecks(features, { T: 1, I: 1, M: 0, R: 0, P: 0 }),
      [
        check('direccion I down', scoreDirection(features.directions.I, 'down'), 2.2, true),
        check('direccion T down', scoreDirection(features.directions.T, 'down'), 2, true),
        check('pinch_TI medio', scoreRange(features.pinch_TI, 0.15, 0.35, 0.12), 1.2),
        check('palma hacia abajo', ['down', 'back'].includes(features.palm_orientation) ? 1 : 0, 1.5),
      ],
      curlChecks(features, { I: 'down', M: 'curled', R: 'curled', P: 'curled' })
    ),
    finalizeCandidate(
      'R',
      fingerChecks(features, { T: 0, I: 1, M: 1, R: 0, P: 0 }),
      [
        check('crossed_IM true', scoreBoolean(features.crossed_IM, true), 3.4, true),
        check('gap_IM < 0.14', scoreLessThan(features.gap_IM, 0.14), 1.4),
      ],
      curlChecks(features, { I: 'up', M: 'up', R: 'curled', P: 'curled' })
    ),
    finalizeCandidate(
      'S',
      fingerChecks(features, { T: 0, I: 0, M: 0, R: 0, P: 0 }),
      [
        check('thumb_role over', scoreRole(features.thumb_role, 'over'), 3, true),
      ],
      curlChecks(features, { I: 'curled', M: 'curled', R: 'curled', P: 'curled' })
    ),
    finalizeCandidate(
      'T',
      fingerChecks(features, { T: 0, I: 0, M: 0, R: 0, P: 0 }),
      [
        check('thumb_role between', scoreRole(features.thumb_role, 'between'), 3, true),
        check('thumb encima de mcp medio', scoreGreaterThan(thumbTip.y - middleMcp.y, 0), 1.4),
      ],
      curlChecks(features, { I: 'curled', M: 'curled', R: 'curled', P: 'curled' })
    ),
    finalizeCandidate(
      'U',
      fingerChecks(features, { T: 0, I: 1, M: 1, R: 0, P: 0 }),
      [
        check('crossed_IM false', scoreBoolean(features.crossed_IM, false), 3.2, true),
        check('gap_IM < 0.10', scoreLessThan(features.gap_IM, 0.1), 3.2, true),
      ],
      curlChecks(features, { I: 'up', M: 'up', R: 'curled', P: 'curled' })
    ),
    finalizeCandidate(
      'V',
      fingerChecks(features, { T: 0, I: 1, M: 1, R: 0, P: 0 }),
      [
        check('crossed_IM false', scoreBoolean(features.crossed_IM, false), 3.2, true),
        check('gap_IM > 0.18', scoreGreaterThan(features.gap_IM, 0.18), 3.2, true),
      ],
      curlChecks(features, { I: 'up', M: 'up', R: 'curled', P: 'curled' })
    ),
    finalizeCandidate(
      'W',
      fingerChecks(features, { T: 0, I: 1, M: 1, R: 1, P: 0 }),
      [
        check('gap_IM > 0.12', scoreGreaterThan(features.gap_IM, 0.12), 1.6),
        check('gap_MR > 0.10', scoreGreaterThan(features.gap_MR, 0.1), 1.6),
      ],
      curlChecks(features, { I: 'up', M: 'up', R: 'up', P: 'curled' })
    ),
    finalizeCandidate(
      'Y',
      fingerChecks(features, { T: 1, I: 0, M: 0, R: 0, P: 1 }),
      [
        check('direccion T horizontal', scoreDirection(features.directions.T, 'horizontal'), 1.8),
        check('direccion P up', scoreDirection(features.directions.P, 'up'), 1.6),
        check('thumb_role side', scoreRole(features.thumb_role, 'side'), 1.6),
      ],
      curlChecks(features, { P: 'up', I: 'curled', M: 'curled', R: 'curled' })
    ),
  ]
}

export function rankStaticLSMCandidates(features) {
  const candidates = getCoreCandidates(features)
    .sort((a, b) => b.confidence - a.confidence)

  return {
    candidates,
    topCandidates: candidates.slice(0, 3),
    bestCandidate: candidates[0] ?? null,
  }
}

export function classifyStaticLSM(features) {
  const ranking = rankStaticLSMCandidates(features)
  const bestCandidate =
    ranking.bestCandidate && ranking.bestCandidate.confidence >= MIN_SCORE
      ? ranking.bestCandidate
      : null

  return {
    ...ranking,
    bestCandidate,
    threshold: MIN_SCORE,
  }
}
