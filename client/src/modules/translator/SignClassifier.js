/**
 * SignClassifier.js
 *
 * Clasificador de señas basado en geometría de landmarks.
 * No requiere entrenamiento — usa reglas basadas en la posición
 * relativa de los 21 puntos que entrega MediaPipe.
 *
 * Estrategia (para el ML dev):
 *  1. Normalizamos los landmarks relativo a la muñeca (punto 0).
 *  2. Calculamos qué dedos están "extendidos" (tip más alto que pip).
 *  3. Comparamos con la tabla de referencia del alfabeto LSM.
 *
 * Escala de confianza: 0.0 – 1.0
 * Si la confianza es < THRESHOLD, se descarta la detección.
 *
 * NOTA: Este clasificador cubre el alfabeto dactilológico estático (A–Z sin Ñ).
 * Las señas dinámicas (J, Z, Ñ) requieren análisis de movimiento — las omitimos en MVP.
 */

// ── Índices de los landmarks (ver: ai.google.dev/edge/mediapipe) ─────────────
const LM = {
  WRIST:       0,
  THUMB_MCP:   2, THUMB_IP:    3, THUMB_TIP:   4,
  INDEX_MCP:   5, INDEX_PIP:   6, INDEX_DIP:   7, INDEX_TIP:   8,
  MIDDLE_MCP:  9, MIDDLE_PIP: 10, MIDDLE_DIP: 11, MIDDLE_TIP: 12,
  RING_MCP:   13, RING_PIP:   14, RING_DIP:   15, RING_TIP:   16,
  PINKY_MCP:  17, PINKY_PIP:  18, PINKY_DIP:  19, PINKY_TIP:  20,
}

const THRESHOLD = 0.65   // confianza mínima para reportar una seña

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Distancia euclidiana entre dos landmarks */
function dist(a, b) {
  return Math.sqrt(
    Math.pow(a.x - b.x, 2) +
    Math.pow(a.y - b.y, 2)
  )
}

/**
 * Normaliza los 21 landmarks relativo a la muñeca y escala
 * por el tamaño de la mano (distancia muñeca→dedo medio MCP).
 * Esto hace el clasificador invariante a distancia de la cámara.
 */
function normalize(landmarks) {
  const wrist  = landmarks[LM.WRIST]
  const scale  = dist(wrist, landmarks[LM.MIDDLE_MCP]) || 1

  return landmarks.map(lm => ({
    x: (lm.x - wrist.x) / scale,
    y: (lm.y - wrist.y) / scale,
    z: (lm.z - wrist.z) / scale,
  }))
}

/**
 * Retorna un objeto con el estado de extensión de cada dedo.
 * Un dedo está "extendido" si su TIP está más arriba (menor y) que su PIP.
 * El pulgar usa el eje X por su orientación diferente.
 */
function getFingerStates(lm) {
  return {
    thumb:  lm[LM.THUMB_TIP].x  < lm[LM.THUMB_IP].x,   // pulgar: TIP a la izquierda de IP
    index:  lm[LM.INDEX_TIP].y  < lm[LM.INDEX_PIP].y,
    middle: lm[LM.MIDDLE_TIP].y < lm[LM.MIDDLE_PIP].y,
    ring:   lm[LM.RING_TIP].y   < lm[LM.RING_PIP].y,
    pinky:  lm[LM.PINKY_TIP].y  < lm[LM.PINKY_PIP].y,
  }
}

// ── Tabla de referencia LSM (alfabeto dactilológico estático) ─────────────────
// Formato: { letter, check: (lm, fingers) => number (0-1) }
// Cada función retorna un score de coincidencia.
// Fuente de referencia: https://www.culturasorda.eu/lengua-de-senas-mexicana/
const SIGNS = [
  {
    letter: 'A',
    check: (lm, f) => {
      // Puño cerrado, pulgar al lado (no extendido hacia arriba)
      if (f.index || f.middle || f.ring || f.pinky) return 0
      return f.thumb ? 0.7 : 0.9
    }
  },
  {
    letter: 'B',
    check: (lm, f) => {
      // Los cuatro dedos extendidos, pulgar doblado al frente
      if (!f.index || !f.middle || !f.ring || !f.pinky) return 0
      return f.thumb ? 0.6 : 0.95
    }
  },
  {
    letter: 'C',
    check: (lm, f) => {
      // Mano curvada en forma de C — ningún dedo completamente extendido
      if (f.index || f.middle || f.ring || f.pinky) return 0
      // Verificar curvatura: los tips deben estar a ~45° sobre MCPs
      const indexCurve = Math.abs(lm[LM.INDEX_TIP].y - lm[LM.INDEX_MCP].y)
      return indexCurve > 0.1 && indexCurve < 0.4 ? 0.85 : 0.3
    }
  },
  {
    letter: 'D',
    check: (lm, f) => {
      // Solo índice extendido, los demás doblados, pulgar toca el medio
      if (!f.index || f.middle || f.ring || f.pinky) return 0
      const thumbToMiddle = dist(lm[LM.THUMB_TIP], lm[LM.MIDDLE_TIP])
      return thumbToMiddle < 0.3 ? 0.9 : 0.4
    }
  },
  {
    letter: 'E',
    check: (lm, f) => {
      // Todos los dedos doblados hacia la palma, uñas hacia abajo
      if (f.index || f.middle || f.ring || f.pinky || f.thumb) return 0
      const avgY = (
        lm[LM.INDEX_TIP].y + lm[LM.MIDDLE_TIP].y +
        lm[LM.RING_TIP].y  + lm[LM.PINKY_TIP].y
      ) / 4
      return avgY > lm[LM.INDEX_MCP].y ? 0.85 : 0.3
    }
  },
  {
    letter: 'F',
    check: (lm, f) => {
      // Índice y pulgar forman un círculo, otros tres extendidos
      if (f.index || !f.middle || !f.ring || !f.pinky) return 0
      const pinch = dist(lm[LM.THUMB_TIP], lm[LM.INDEX_TIP])
      return pinch < 0.25 ? 0.9 : 0.3
    }
  },
  {
    letter: 'G',
    check: (lm, f) => {
      // Índice y pulgar extendidos apuntando al lado
      if (!f.index || f.middle || f.ring || f.pinky) return 0
      return f.thumb ? 0.85 : 0.5
    }
  },
  {
    letter: 'H',
    check: (lm, f) => {
      // Índice y medio extendidos juntos apuntando al lado
      if (!f.index || !f.middle || f.ring || f.pinky || f.thumb) return 0
      const fingerGap = Math.abs(lm[LM.INDEX_TIP].x - lm[LM.MIDDLE_TIP].x)
      return fingerGap < 0.15 ? 0.9 : 0.5
    }
  },
  {
    letter: 'I',
    check: (lm, f) => {
      // Solo meñique extendido
      if (f.index || f.middle || f.ring || !f.pinky) return 0
      return f.thumb ? 0.7 : 0.9
    }
  },
  {
    letter: 'K',
    check: (lm, f) => {
      // Índice y medio extendidos separados, pulgar entre ellos
      if (!f.index || !f.middle || f.ring || f.pinky) return 0
      const fingerGap = Math.abs(lm[LM.INDEX_TIP].x - lm[LM.MIDDLE_TIP].x)
      return fingerGap > 0.15 ? 0.85 : 0.4
    }
  },
  {
    letter: 'L',
    check: (lm, f) => {
      // Índice hacia arriba, pulgar hacia el lado (forma L)
      if (!f.index || f.middle || f.ring || f.pinky || !f.thumb) return 0
      const angle = Math.abs(lm[LM.INDEX_TIP].y - lm[LM.THUMB_TIP].y)
      return angle > 0.3 ? 0.9 : 0.5
    }
  },
  {
    letter: 'M',
    check: (lm, f) => {
      // Tres dedos sobre el pulgar doblado
      if (f.index || f.middle || f.ring || f.pinky || f.thumb) return 0
      const thumbUnder = lm[LM.THUMB_TIP].y > lm[LM.INDEX_MCP].y
      return thumbUnder ? 0.8 : 0.3
    }
  },
  {
    letter: 'N',
    check: (lm, f) => {
      // Dos dedos sobre el pulgar doblado (similar a M pero con 2)
      if (!f.index || f.middle || f.ring || f.pinky) return 0
      const thumbUnder = lm[LM.THUMB_TIP].y > lm[LM.INDEX_PIP].y
      return thumbUnder ? 0.8 : 0.3
    }
  },
  {
    letter: 'O',
    check: (lm, f) => {
      // Todos los dedos forman un círculo con el pulgar
      if (f.index || f.middle || f.ring || f.pinky) return 0
      const pinch = dist(lm[LM.THUMB_TIP], lm[LM.INDEX_TIP])
      return pinch < 0.2 ? 0.9 : 0.4
    }
  },
  {
    letter: 'P',
    check: (lm, f) => {
      // Similar a K pero apuntando hacia abajo
      if (!f.index || !f.middle || f.ring || f.pinky) return 0
      const pointingDown = lm[LM.INDEX_TIP].y > lm[LM.INDEX_MCP].y
      return pointingDown ? 0.85 : 0.3
    }
  },
  {
    letter: 'Q',
    check: (lm, f) => {
      // Similar a G pero apuntando hacia abajo
      if (!f.index || f.middle || f.ring || f.pinky || !f.thumb) return 0
      const pointingDown = lm[LM.INDEX_TIP].y > lm[LM.INDEX_MCP].y
      return pointingDown ? 0.85 : 0.3
    }
  },
  {
    letter: 'R',
    check: (lm, f) => {
      // Índice y medio cruzados
      if (!f.index || !f.middle || f.ring || f.pinky) return 0
      const crossed = lm[LM.INDEX_TIP].x > lm[LM.MIDDLE_TIP].x
      return crossed ? 0.9 : 0.4
    }
  },
  {
    letter: 'S',
    check: (lm, f) => {
      // Puño cerrado con pulgar sobre los dedos
      if (f.index || f.middle || f.ring || f.pinky) return 0
      const thumbOver = lm[LM.THUMB_TIP].x < lm[LM.INDEX_MCP].x
      return thumbOver ? 0.85 : 0.5
    }
  },
  {
    letter: 'T',
    check: (lm, f) => {
      // Pulgar entre índice y medio doblados
      if (f.index || f.middle || f.ring || f.pinky) return 0
      const thumbBetween =
        lm[LM.THUMB_TIP].x > lm[LM.INDEX_MCP].x &&
        lm[LM.THUMB_TIP].x < lm[LM.MIDDLE_MCP].x
      return thumbBetween ? 0.85 : 0.4
    }
  },
  {
    letter: 'U',
    check: (lm, f) => {
      // Índice y medio extendidos juntos hacia arriba
      if (!f.index || !f.middle || f.ring || f.pinky) return 0
      const gap = Math.abs(lm[LM.INDEX_TIP].x - lm[LM.MIDDLE_TIP].x)
      return gap < 0.12 ? 0.9 : 0.4
    }
  },
  {
    letter: 'V',
    check: (lm, f) => {
      // Índice y medio en V (separados)
      if (!f.index || !f.middle || f.ring || f.pinky) return 0
      const gap = Math.abs(lm[LM.INDEX_TIP].x - lm[LM.MIDDLE_TIP].x)
      return gap > 0.15 ? 0.9 : 0.4
    }
  },
  {
    letter: 'W',
    check: (lm, f) => {
      // Índice, medio y anular extendidos separados
      if (!f.index || !f.middle || !f.ring || f.pinky) return 0
      return 0.85
    }
  },
  {
    letter: 'X',
    check: (lm, f) => {
      // Índice doblado en gancho
      if (f.middle || f.ring || f.pinky) return 0
      const hookY = lm[LM.INDEX_TIP].y > lm[LM.INDEX_PIP].y
      return hookY && !f.index ? 0.85 : 0.3
    }
  },
  {
    letter: 'Y',
    check: (lm, f) => {
      // Pulgar y meñique extendidos (shaka)
      if (f.index || f.middle || f.ring || !f.pinky || !f.thumb) return 0
      return 0.9
    }
  },
]

// ── Función principal ─────────────────────────────────────────────────────────

/**
 * Clasifica los 21 landmarks de MediaPipe en una letra LSM.
 *
 * @param {Array} landmarks - Array de 21 puntos {x, y, z} de MediaPipe
 * @returns {{ letter: string, confidence: number } | null}
 */
export function classifySign(landmarks) {
  if (!landmarks || landmarks.length !== 21) return null

  const norm    = normalize(landmarks)
  const fingers = getFingerStates(norm)

  let best = { letter: null, confidence: 0 }

  for (const sign of SIGNS) {
    const score = sign.check(norm, fingers)
    if (score > best.confidence) {
      best = { letter: sign.letter, confidence: score }
    }
  }

  return best.confidence >= THRESHOLD ? best : null
}

/**
 * Suavizador de predicciones: evita el parpadeo de letras
 * acumulando las últimas N predicciones y devolviendo la más frecuente.
 *
 * Uso:
 *   const smoother = createSmoother(8)
 *   const stable = smoother.push(classifySign(landmarks))
 */
export function createSmoother(windowSize = 8) {
  const buffer = []

  return {
    push(prediction) {
      if (!prediction) return null

      buffer.push(prediction.letter)
      if (buffer.length > windowSize) buffer.shift()

      // Frecuencia de cada letra en el buffer
      const freq = buffer.reduce((acc, l) => {
        acc[l] = (acc[l] || 0) + 1
        return acc
      }, {})

      const topLetter = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]

      // Solo retorna si la letra aparece más del 60% del tiempo
      if (topLetter[1] / buffer.length >= 0.6) {
        return { letter: topLetter[0], confidence: topLetter[1] / buffer.length }
      }
      return null
    },
    reset() { buffer.length = 0 }
  }
}
