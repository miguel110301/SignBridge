/**
 * SignMap.js
 *
 * Mapa canónico de señas:
 * - STATIC_SIGN_MAP define cómo debe verse cada letra estática.
 * - DYNAMIC_GESTURE_MAP reserva el espacio para palabras/gestos completos
 *   como "hola", que requieren analizar movimiento en el tiempo.
 *
 * El objetivo es que la "verdad" de cada seña viva aquí y no dispersa
 * en reglas sueltas dentro del clasificador.
 *
 * Perfil actual:
 * - Lengua de Señas Mexicana (LSM)
 * - Referencia visual: abecedario LSM compartido por el usuario
 * - Varias letras (J, K, Ñ, Q, X, Z) son dinámicas y no deben tratarse
 *   igual que una letra estática porque dependen de trayectoria.
 */

function inRange(value, min, max) {
  return value >= min && value <= max
}

export const SIGN_LANGUAGE_PROFILE = {
  code: 'LSM',
  name: 'Lengua de Señas Mexicana',
  source: 'Referencia visual compartida en la conversación',
  dynamicLetters: ['J', 'K', 'Ñ', 'Q', 'X', 'Z'],
}

export const STATIC_SIGN_MAP = [
  {
    letter: 'A',
    summary: 'Puño cerrado con pulgar visible al costado, según LSM',
    fingerPattern: { thumb: 'side-visible', index: 'closed', middle: 'closed', ring: 'closed', pinky: 'closed' },
    score: ({ fingers, posture, relations }) => {
      if (fingers.index.extended || fingers.middle.extended || fingers.ring.extended || fingers.pinky.extended) return 0
      if (!fingers.thumb.extended) return 0.28
      return !relations.thumbUnderPalm && !posture.openPalm ? 0.95 : 0.76
    },
  },
  {
    letter: 'B',
    summary: 'Cuatro dedos extendidos hacia arriba, pulgar recogido',
    fingerPattern: { thumb: 'closed', index: 'up', middle: 'up', ring: 'up', pinky: 'up' },
    score: ({ fingers, posture, pairs, relations }) => {
      if (!posture.openPalm || fingers.thumb.extended) return 0

      const verticalPairs =
        Number(pairs.indexMiddle.vertical) +
        Number(pairs.middleRing.vertical) +
        Number(pairs.ringPinky.vertical)

      if (verticalPairs < 2) return 0.18

      const compactSpread =
        inRange(pairs.indexMiddle.gap, 0.07, 0.32) &&
        inRange(pairs.middleRing.gap, 0.06, 0.32) &&
        inRange(pairs.ringPinky.gap, 0.05, 0.3)

      if (!compactSpread) return 0.32

      const parallelAverage =
        (pairs.indexMiddle.parallel + pairs.middleRing.parallel + pairs.ringPinky.parallel) / 3

      if (parallelAverage < 0.72) return 0.4

      return relations.thumbAcrossFront || relations.thumbUnderPalm ? 0.95 : 0.68
    },
  },
  {
    letter: 'C',
    summary: 'Mano curvada formando una C abierta',
    fingerPattern: { thumb: 'curved', index: 'curved', middle: 'curved', ring: 'curved', pinky: 'curved' },
    score: ({ posture, distances }) => {
      if (posture.nonThumbExtendedCount > 1) return 0
      return inRange(distances.thumbIndex, 0.28, 0.75) ? 0.86 : 0.35
    },
  },
  {
    letter: 'D',
    summary: 'Indice arriba, resto cerrado, pulgar toca al medio',
    fingerPattern: { thumb: 'touch-middle', index: 'up', middle: 'closed', ring: 'closed', pinky: 'closed' },
    score: ({ fingers, touches }) => {
      if (!fingers.index.extended || fingers.middle.extended || fingers.ring.extended || fingers.pinky.extended) return 0
      return touches.thumbMiddle ? 0.92 : 0.4
    },
  },
  {
    letter: 'E',
    summary: 'Puño compacto sin pulgar expuesto, según LSM',
    fingerPattern: { thumb: 'hidden', index: 'closed', middle: 'closed', ring: 'closed', pinky: 'closed' },
    score: ({ posture, points, fingers, relations }) => {
      if (!posture.closedFist) return 0
      if (fingers.thumb.extended) return 0.08
      if (relations.thumbAcrossFront) return 0.42
      return posture.averageTipY > points.index.mcp.y ? 0.9 : 0.45
    },
  },
  {
    letter: 'F',
    summary: 'Indice arriba con pulgar cerrando hacia indice/medio, según LSM',
    fingerPattern: { thumb: 'touch-index-or-middle', index: 'up', middle: 'closed', ring: 'closed', pinky: 'closed' },
    score: ({ fingers, touches }) => {
      if (!fingers.index.extended || fingers.middle.extended || fingers.ring.extended || fingers.pinky.extended) return 0
      const pinch = touches.thumbIndex || touches.thumbMiddle
      if (!pinch) return 0.22
      return fingers.thumb.extended ? 0.93 : 0.74
    },
  },
  {
    letter: 'G',
    summary: 'Indice horizontal y pulgar visible, tipo pistola lateral en LSM',
    fingerPattern: { thumb: 'up-or-side', index: 'horizontal', middle: 'closed', ring: 'closed', pinky: 'closed' },
    score: ({ fingers, distances }) => {
      if (!fingers.index.extended || fingers.middle.extended || fingers.ring.extended || fingers.pinky.extended) return 0
      if (!fingers.thumb.extended) return 0.18
      if (fingers.index.horizontal <= 0.68) return 0.18
      return distances.indexThumbTip > 0.48 ? 0.92 : 0.74
    },
  },
  {
    letter: 'H',
    summary: 'Indice y medio juntos en horizontal',
    fingerPattern: { thumb: 'closed', index: 'horizontal', middle: 'horizontal', ring: 'closed', pinky: 'closed' },
    score: ({ fingers, pairs }) => {
      if (!fingers.index.extended || !fingers.middle.extended || fingers.ring.extended || fingers.pinky.extended || fingers.thumb.extended) return 0
      if (!pairs.indexMiddle.horizontal) return 0.1
      if (!pairs.indexMiddle.together) return 0.2
      return pairs.indexMiddle.parallel > 0.85 ? 0.95 : 0.82
    },
  },
  {
    letter: 'I',
    summary: 'Solo indice extendido hacia arriba, según LSM',
    fingerPattern: { thumb: 'closed', index: 'up', middle: 'closed', ring: 'closed', pinky: 'closed' },
    score: ({ fingers, touches }) => {
      if (!fingers.index.extended || fingers.middle.extended || fingers.ring.extended || fingers.pinky.extended) return 0
      if (fingers.thumb.extended) return 0.22
      if (touches.thumbIndex || touches.thumbMiddle) return 0.28
      return fingers.index.vertical > 0.72 ? 0.94 : 0.7
    },
  },
  {
    letter: 'K',
    summary: 'Indice y medio separados hacia arriba, pulgar entre ambos',
    fingerPattern: { thumb: 'between-index-middle', index: 'up', middle: 'up', ring: 'closed', pinky: 'closed' },
    score: ({ fingers, pairs, relations }) => {
      if (!fingers.index.extended || !fingers.middle.extended || fingers.ring.extended || fingers.pinky.extended) return 0
      if (!pairs.indexMiddle.vertical) return 0.15
      if (!relations.thumbBetweenIndexMiddle) return 0.22
      return pairs.indexMiddle.separated ? 0.9 : 0.45
    },
  },
  {
    letter: 'L',
    summary: 'Indice arriba y pulgar al lado formando L',
    fingerPattern: { thumb: 'side', index: 'up', middle: 'closed', ring: 'closed', pinky: 'closed' },
    score: ({ fingers, distances }) => {
      if (!fingers.index.extended || fingers.middle.extended || fingers.ring.extended || fingers.pinky.extended || !fingers.thumb.extended) return 0
      if (fingers.index.vertical <= 0.65) return 0.28
      return distances.indexThumbTip > 0.55 ? 0.94 : 0.5
    },
  },
  {
    letter: 'M',
    summary: 'Pulgar debajo de tres dedos cerrados',
    fingerPattern: { thumb: 'under-fingers', index: 'closed', middle: 'closed', ring: 'closed', pinky: 'closed' },
    score: ({ posture, relations }) => {
      if (!posture.closedFist) return 0
      return relations.thumbUnderPalm ? 0.82 : 0.35
    },
  },
  {
    letter: 'N',
    summary: 'Pulgar debajo de dos dedos cerrados',
    fingerPattern: { thumb: 'under-index-middle', index: 'closed', middle: 'closed', ring: 'closed', pinky: 'closed' },
    score: ({ posture, relations }) => {
      if (posture.nonThumbExtendedCount > 1) return 0
      return relations.thumbUnderIndex ? 0.8 : 0.3
    },
  },
  {
    letter: 'O',
    summary: 'Dedos y pulgar forman un circulo cerrado',
    fingerPattern: { thumb: 'pinch-index', index: 'curved', middle: 'curved', ring: 'curved', pinky: 'curved' },
    score: ({ posture, distances, touches }) => {
      if (posture.nonThumbExtendedCount > 1) return 0
      if (!touches.thumbIndex) return 0.3
      return distances.thumbIndex < 0.22 ? 0.92 : 0.45
    },
  },
  {
    letter: 'P',
    summary: 'Indice y medio cruzados, variante LSM de P en la referencia',
    fingerPattern: { thumb: 'closed', index: 'crossed', middle: 'crossed', ring: 'closed', pinky: 'closed' },
    score: ({ fingers, pairs }) => {
      if (!fingers.index.extended || !fingers.middle.extended || fingers.ring.extended || fingers.pinky.extended) return 0
      if (!pairs.indexMiddle.vertical) return 0.18
      return pairs.indexMiddle.crossed ? 0.9 : 0.46
    },
  },
  {
    letter: 'Q',
    summary: 'Como G pero hacia abajo',
    fingerPattern: { thumb: 'side', index: 'down', middle: 'closed', ring: 'closed', pinky: 'closed' },
    score: ({ fingers, posture }) => {
      if (!fingers.index.extended || fingers.middle.extended || fingers.ring.extended || fingers.pinky.extended || !fingers.thumb.extended) return 0
      return posture.pointingDownIndex ? 0.86 : 0.3
    },
  },
  {
    letter: 'R',
    summary: 'Indice y medio cruzados',
    fingerPattern: { thumb: 'any', index: 'crossed', middle: 'crossed', ring: 'closed', pinky: 'closed' },
    score: ({ fingers, pairs }) => {
      if (!fingers.index.extended || !fingers.middle.extended || fingers.ring.extended || fingers.pinky.extended) return 0
      return pairs.indexMiddle.crossed ? 0.92 : 0.4
    },
  },
  {
    letter: 'S',
    summary: 'Puño cerrado con pulgar sobre los dedos',
    fingerPattern: { thumb: 'over-fingers', index: 'closed', middle: 'closed', ring: 'closed', pinky: 'closed' },
    score: ({ posture, relations }) => {
      if (!posture.closedFist) return 0
      return relations.thumbAcrossFront ? 0.86 : 0.5
    },
  },
  {
    letter: 'T',
    summary: 'Pulgar entre indice y medio cerrados',
    fingerPattern: { thumb: 'between-index-middle', index: 'closed', middle: 'closed', ring: 'closed', pinky: 'closed' },
    score: ({ posture, relations }) => {
      if (!posture.closedFist) return 0
      return relations.thumbBetweenIndexMiddle ? 0.86 : 0.4
    },
  },
  {
    letter: 'U',
    summary: 'Indice y medio juntos hacia arriba',
    fingerPattern: { thumb: 'closed', index: 'up', middle: 'up', ring: 'closed', pinky: 'closed' },
    score: ({ fingers, pairs }) => {
      if (!fingers.index.extended || !fingers.middle.extended || fingers.ring.extended || fingers.pinky.extended) return 0
      if (!pairs.indexMiddle.vertical) return 0.1
      return pairs.indexMiddle.together ? 0.93 : 0.4
    },
  },
  {
    letter: 'V',
    summary: 'Indice y medio separados hacia arriba',
    fingerPattern: { thumb: 'closed', index: 'up', middle: 'up', ring: 'closed', pinky: 'closed' },
    score: ({ fingers, pairs }) => {
      if (!fingers.index.extended || !fingers.middle.extended || fingers.ring.extended || fingers.pinky.extended) return 0
      if (!pairs.indexMiddle.vertical) return 0.1
      return pairs.indexMiddle.separated ? 0.92 : 0.4
    },
  },
  {
    letter: 'W',
    summary: 'Indice, medio y anular extendidos',
    fingerPattern: { thumb: 'closed', index: 'up', middle: 'up', ring: 'up', pinky: 'closed' },
    score: ({ fingers }) => {
      if (!fingers.index.extended || !fingers.middle.extended || !fingers.ring.extended || fingers.pinky.extended) return 0
      return 0.86
    },
  },
  {
    letter: 'X',
    summary: 'En LSM la X es dinámica; la versión estática se degrada para evitar falsos positivos',
    fingerPattern: { thumb: 'dynamic', index: 'dynamic', middle: 'closed', ring: 'closed', pinky: 'closed' },
    score: () => {
      return 0.05
    },
  },
  {
    letter: 'Y',
    summary: 'Pulgar y menique extendidos',
    fingerPattern: { thumb: 'side', index: 'closed', middle: 'closed', ring: 'closed', pinky: 'up' },
    score: ({ fingers }) => {
      if (fingers.index.extended || fingers.middle.extended || fingers.ring.extended || !fingers.pinky.extended || !fingers.thumb.extended) return 0
      return 0.92
    },
  },
]

export const DYNAMIC_GESTURE_MAP = [
  {
    gesture: 'lsm_j',
    summary: 'Letra J de LSM: meñique traza movimiento descendente con gancho lateral',
    type: 'dynamic_letter',
    implemented: true,
    config: {
      windowMs: 1400,
      cooldownMs: 1800,
      minFrames: 7,
      minJShapeRatio: 0.60,
      minDownwardMotion: 0.06,
      minHookMotion: 0.025,
    },
  },
  {
    gesture: 'lsm_k',
    summary: 'Letra K de LSM: cruce de dedos con pequeño giro',
    type: 'dynamic_letter',
    implemented: false,
  },
  {
    gesture: 'lsm_n_tilde',
    summary: 'Letra Ñ de LSM: movimiento corto a partir de N',
    type: 'dynamic_letter',
    implemented: false,
  },
  {
    gesture: 'lsm_q',
    summary: 'Letra Q de LSM: mano hacia abajo con trazo corto',
    type: 'dynamic_letter',
    implemented: false,
  },
  {
    gesture: 'lsm_x',
    summary: 'Letra X de LSM: movimiento lateral corto',
    type: 'dynamic_letter',
    implemented: false,
  },
  {
    gesture: 'lsm_z',
    summary: 'Letra Z de LSM: indice dibuja la forma de Z',
    type: 'dynamic_letter',
    implemented: false,
  },
  {
    gesture: 'hola',
    summary: 'Dos dedos con movimiento lateral tipo saludo — se activa cerca de la cabeza o en parte superior de pantalla',
    type: 'dynamic',
    requiredHandshape: 'two_fingers_near_head',
    requiredMotion: 'side_to_side_wave',
    notes: 'nearHead usa faceAnchor cuando esta disponible; sin cara cae a zona superior de imagen.',
    implemented: true,
    config: {
      windowMs: 1500,
      suppressWindowMs: 420,
      cooldownMs: 2000,
      minFrames: 9,
      minNearHeadRatio: 0.45,
      minTwoFingerRatio: 0.60,
      minPalmFacingRatio: 0.40,
      minRangeX: 0.065,
      minDirectionChanges: 1,
      minSwingAmplitude: 0.025,
      minSuppressRangeX: 0.030,
      minFacingScore: 0.32,
      maxFingerGap: 0.26,
      minFingerGap: 0.025,
      headZonePaddingX: 0.28,
      headZonePaddingTop: 0.25,
      headZonePaddingBottom: 0.12,
      // Fallback: when no faceAnchor, treat upper fraction of frame as "near head"
      headFallbackMaxY: 0.50,
    },
  },
]
