function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const GESTURE_OBJECTIVES = [
  { value: 'mi nombre es', label: 'MI NOMBRE ES', matcher: /\bmi nombre es\b/ },
  { value: 'mucho gusto', label: 'MUCHO GUSTO', matcher: /\bmucho gusto\b/ },
  { value: 'por favor', label: 'POR FAVOR', matcher: /\bpor favor\b/ },
  { value: 'gracias', label: 'GRACIAS', matcher: /\bgracias\b/ },
  { value: 'adios', label: 'ADIOS', matcher: /\badios\b/ },
  { value: 'hola', label: 'HOLA', matcher: /\bhola\b/ },
]

const AUTO_CHECK_GESTURES = new Set(['hola'])

export function resolvePracticeObjective(mission) {
  if (!mission) {
    return {
      type: 'unknown',
      value: '',
      display: 'Sin objetivo configurado.',
      title: 'Objetivo actual',
      supported: false,
    }
  }

  const rawSource = `${mission.title || ''} ${mission.description || ''}`
  const normalized = normalizeText(rawSource)
  const uppercaseLetterMatch = rawSource.match(/\b([A-ZÑ])\b/)

  if (uppercaseLetterMatch?.[1]) {
    return {
      type: 'letter',
      value: uppercaseLetterMatch[1],
      display: uppercaseLetterMatch[1],
      title: 'Letra objetivo',
      supported: true,
    }
  }

  const normalizedLetterMatch = normalized.match(/\b(?:letra|signo|sena|senia)\s+([a-z])\b/)
  if (normalizedLetterMatch?.[1]) {
    return {
      type: 'letter',
      value: normalizedLetterMatch[1].toUpperCase(),
      display: normalizedLetterMatch[1].toUpperCase(),
      title: 'Letra objetivo',
      supported: true,
    }
  }

  const gestureObjective = GESTURE_OBJECTIVES.find((entry) => entry.matcher.test(normalized))
  if (gestureObjective) {
    return {
      type: 'gesture',
      value: gestureObjective.value,
      display: gestureObjective.label,
      title: 'Seña objetivo',
      supported: AUTO_CHECK_GESTURES.has(gestureObjective.value),
    }
  }

  return {
    type: 'freeform',
    value: normalized,
    display: mission.title || 'Objetivo actual',
    title: 'Objetivo actual',
    supported: false,
  }
}

export function matchesPracticeObjective(detection, objective) {
  if (!detection || !objective?.supported) return false

  if (objective.type === 'letter') {
    return detection.type === 'letter' && detection.label === objective.value
  }

  if (objective.type === 'gesture') {
    return detection.type === 'gesture' && normalizeText(detection.label) === normalizeText(objective.value)
  }

  return false
}

export function formatPracticeDetection(detection) {
  if (!detection) return '---'

  const label = detection.display || detection.label || '---'
  const confidence = Number.isFinite(detection.confidence)
    ? ` · ${Math.round(detection.confidence * 100)}%`
    : ''

  return `${label}${confidence}`
}
