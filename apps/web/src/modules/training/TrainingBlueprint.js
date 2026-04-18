export const STATIC_CAPTURE_SLOTS = [
  {
    key: 'center',
    label: 'Centro',
    description: 'Pose limpia al centro del encuadre. La mano completa debe verse estable.',
  },
  {
    key: 'yaw_left',
    label: 'Giro izq',
    description: 'Misma letra con un leve giro de muñeca hacia la izquierda.',
  },
  {
    key: 'yaw_right',
    label: 'Giro der',
    description: 'Misma letra con un leve giro de muñeca hacia la derecha.',
  },
  {
    key: 'high',
    label: 'Alta',
    description: 'Sube la mano sin cambiar la forma de la letra.',
  },
  {
    key: 'low',
    label: 'Baja',
    description: 'Baja la mano sin cambiar la forma de la letra.',
  },
  {
    key: 'near',
    label: 'Cerca',
    description: 'Acerca la mano a la camara sin recortarla ni deformar la seña.',
  },
  {
    key: 'far',
    label: 'Lejos',
    description: 'Aleja un poco la mano para cubrir escala menor manteniendo la seña visible.',
  },
]

const DEFAULT_LETTER_HINT =
  'Mantén la forma exacta de la letra por al menos medio segundo antes de capturar.'

const LETTER_HINTS = {
  A: 'Puño cerrado con pulgar al costado. No lo subas encima de los dedos.',
  B: 'Cuatro dedos rectos y juntos; pulgar doblado al frente.',
  C: 'Curvatura media uniforme; no cierres demasiado la mano.',
  D: 'Indice arriba y pulgar tocando medio por abajo.',
  E: 'Todos los dedos curvados hacia la palma; no hagas puño de A.',
  F: 'Pulgar e índice en pinch. Medio, anular y meñique extendidos.',
  G: 'Índice horizontal al lado; pulgar también lateral.',
  H: 'Índice y medio horizontales y juntos.',
  I: 'Solo meñique extendido.',
  K: 'Índice y medio arriba y separados; pulgar entre ellos.',
  L: 'Índice arriba y pulgar lateral formando 90 grados.',
  M: 'Pulgar bajo tres dedos.',
  N: 'Pulgar bajo dos dedos.',
  O: 'Todos curvos cerrando una O.',
  P: 'Índice y medio apuntando hacia abajo.',
  Q: 'Índice y pulgar apuntando hacia abajo.',
  R: 'Índice y medio cruzados.',
  S: 'Puño cerrado con pulgar sobre los dedos.',
  T: 'Pulgar entre índice y medio.',
  U: 'Índice y medio arriba y juntos.',
  V: 'Índice y medio arriba y separados.',
  W: 'Índice, medio y anular arriba y separados.',
  X: 'Índice en gancho; útil como referencia futura aunque no se clasifique aún.',
  Y: 'Pulgar y meñique extendidos.',
}

const LETTER_CONFUSIONS = {
  A: ['S', 'E', 'T'],
  D: ['L'],
  E: ['A', 'S', 'M', 'N'],
  G: ['H', 'Q', 'P'],
  H: ['G', 'U', 'V'],
  K: ['V', 'U'],
  L: ['D'],
  M: ['N', 'E'],
  N: ['M', 'E'],
  P: ['Q', 'G'],
  Q: ['P', 'G'],
  R: ['U', 'V'],
  S: ['A', 'E', 'T'],
  T: ['A', 'S'],
  U: ['V', 'R'],
  V: ['U', 'R', 'K'],
  Y: ['I', 'L'],
}

export function getStaticLetterPlan(letter) {
  return {
    slots: STATIC_CAPTURE_SLOTS,
    hint: LETTER_HINTS[letter] ?? DEFAULT_LETTER_HINT,
    confusions: LETTER_CONFUSIONS[letter] ?? [],
  }
}

export function getStaticTemplatesForLabel(templates, label) {
  return (templates?.[label] ?? []).filter((template) => template.type === 'static')
}

export function getCoveredSlotKeys(staticTemplates) {
  const covered = new Set()
  for (const template of staticTemplates) {
    if (template.variantKey) covered.add(template.variantKey)
  }
  return covered
}

export function getNextRecommendedSlot(slots, coveredKeys) {
  return slots.find((slot) => !coveredKeys.has(slot.key)) ?? slots[0] ?? null
}
