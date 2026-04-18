import { SIGN_LEXICON_WORDS } from './SignMap.js'
import { summarizeSequenceFrames } from './HandSequenceModel.js'

function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

function scoreLessThan(value, target, softness = 0.1) {
  if (value <= target) return 1
  return clamp01(1 - ((value - target) / softness))
}

function scoreGreaterThan(value, target, softness = 0.1) {
  if (value >= target) return 1
  return clamp01(1 - ((target - value) / softness))
}

function scoreRange(value, min, max, softness = 0.1) {
  if (value >= min && value <= max) return 1
  if (value < min) return clamp01(1 - ((min - value) / softness))
  return clamp01(1 - ((value - max) / softness))
}

function averageChecks(checks) {
  if (!checks.length) return 0
  return checks.reduce((sum, value) => sum + value, 0) / checks.length
}

function scoreHandProfile(summary, handProfile) {
  if (handProfile === 'two_hands') {
    return scoreGreaterThan(summary.handCountRatio.two, 0.45, 0.2)
  }
  if (handProfile === 'one_hand') {
    return scoreGreaterThan(summary.handCountRatio.one, 0.7, 0.25)
  }
  return 0.65
}

function scoreBodyAnchor(summary, bodyAnchor) {
  const x = summary.avgPrimary.x
  const y = summary.avgPrimary.y

  switch (bodyAnchor) {
    case 'head':
      return averageChecks([
        scoreRange(y, -0.9, -0.18, 0.2),
        scoreLessThan(Math.abs(x), 0.9, 0.3),
      ])
    case 'face':
      return averageChecks([
        scoreRange(y, -0.55, 0.15, 0.2),
        scoreLessThan(Math.abs(x), 0.8, 0.3),
      ])
    case 'mouth':
    case 'face_or_mouth':
      return averageChecks([
        scoreRange(y, -0.1, 0.35, 0.18),
        scoreLessThan(Math.abs(x), 0.8, 0.3),
      ])
    case 'upper_torso':
      return averageChecks([
        scoreRange(y, 0.15, 0.95, 0.22),
        scoreLessThan(Math.abs(x), 1.1, 0.4),
      ])
    case 'chest':
      return averageChecks([
        scoreRange(y, 0.25, 0.85, 0.18),
        scoreLessThan(Math.abs(x), 0.95, 0.35),
      ])
    case 'neutral_space':
      return averageChecks([
        scoreRange(y, -0.2, 0.95, 0.25),
        scoreLessThan(Math.abs(x), 1.3, 0.5),
      ])
    case 'body_region':
      return scoreRange(y, -0.1, 1.2, 0.3)
    default:
      return 0.6
  }
}

function scoreMotion(summary, motion) {
  const rangeX = summary.primaryRange.x
  const rangeY = summary.primaryRange.y
  const deltaY = summary.primaryDelta.y
  const deltaX = summary.primaryDelta.x
  const xChanges = summary.motion.xDirectionChanges

  switch (motion) {
    case 'lateral_wave':
      return averageChecks([
        scoreGreaterThan(rangeX, 0.18, 0.15),
        scoreLessThan(rangeY, 0.28, 0.16),
        scoreGreaterThan(xChanges, 0.8, 1.2),
      ])
    case 'symmetric_global':
      return averageChecks([
        scoreGreaterThan(summary.handCountRatio.two, 0.45, 0.2),
        scoreGreaterThan(summary.avgInterHandDistance, 0.16, 0.1),
        scoreGreaterThan(rangeX + summary.secondaryRange.x, 0.2, 0.15),
      ])
    case 'courtesy_release':
      return averageChecks([
        scoreGreaterThan(rangeY, 0.12, 0.12),
        scoreGreaterThan(deltaY, 0.06, 0.1),
      ])
    case 'consumption_template':
      return averageChecks([
        scoreLessThan(rangeX, 0.35, 0.15),
        scoreLessThan(rangeY, 0.35, 0.15),
      ])
    case 'question_template':
      return averageChecks([
        scoreLessThan(rangeX, 0.4, 0.18),
        scoreLessThan(rangeY, 0.4, 0.18),
      ])
    case 'desire_template':
    case 'need_template':
    case 'support_template':
    case 'bathroom_template':
    case 'place_template':
    case 'pain_template':
    case 'confirmation_template':
    case 'negation_template':
      return averageChecks([
        scoreLessThan(Math.abs(deltaX), 0.45, 0.2),
        scoreLessThan(Math.abs(deltaY), 0.45, 0.2),
      ])
    default:
      return 0.55
  }
}

function scoreInterHand(summary, baseModel) {
  if (!baseModel?.minInterHandDistance) return 0.8
  return scoreGreaterThan(summary.avgInterHandDistance, baseModel.minInterHandDistance, 0.08)
}

function canGeneralizeWithoutTemplate(baseModel) {
  return ['lateral_wave', 'symmetric_global', 'courtesy_release'].includes(baseModel?.motion)
}

export function classifyDynamicLexicon(framesHistory = []) {
  const summary = summarizeSequenceFrames(framesHistory)
  if (!summary || summary.frameCount < 6) return null

  const topCandidates = SIGN_LEXICON_WORDS.map((entry) => {
    const handScore = scoreHandProfile(summary, entry.baseModel?.handProfile)
    const anchorScore = scoreBodyAnchor(summary, entry.baseModel?.bodyAnchor)
    const motionScore = scoreMotion(summary, entry.baseModel?.motion)
    const interHandScore = scoreInterHand(summary, entry.baseModel)

    const confidence =
      (handScore * 0.3) +
      (anchorScore * 0.25) +
      (motionScore * 0.3) +
      (interHandScore * 0.15)

    return {
      gesture: entry.key,
      word: entry.word,
      spoken: entry.spoken,
      confidence,
      modelOnlyEligible: canGeneralizeWithoutTemplate(entry.baseModel),
      summary: {
        handScore,
        anchorScore,
        motionScore,
        interHandScore,
      },
    }
  })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)

  if (!topCandidates.length) return null

  return {
    bestCandidate: topCandidates[0],
    topCandidates,
    summary,
  }
}
