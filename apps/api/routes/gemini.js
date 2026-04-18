/**
 * POST /api/practice/feedback
 * Body:
 * {
 *   imageBase64: string,
 *   targetSign: string,
 *   targetType?: 'letter' | 'word',
 *   handCount?: number,
 *   handQuality?: object,
 *   featureSummary?: object
 * }
 */

import express from 'express'
import {
  FunctionDeclarationSchemaType,
  GoogleGenerativeAI,
} from '@google/generative-ai'

const router = express.Router()
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest'

const FEEDBACK_SCHEMA = {
  type: FunctionDeclarationSchemaType.OBJECT,
  properties: {
    correct: {
      type: FunctionDeclarationSchemaType.BOOLEAN,
      description: 'Si la seña coincide razonablemente con el objetivo.',
    },
    score: {
      type: FunctionDeclarationSchemaType.NUMBER,
      description: 'Puntuacion de 0 a 100 de la calidad de la seña.',
    },
    feedback: {
      type: FunctionDeclarationSchemaType.STRING,
      description: 'Retroalimentacion breve y especifica en espanol.',
    },
    usableForTraining: {
      type: FunctionDeclarationSchemaType.BOOLEAN,
      description: 'Si la muestra deberia guardarse como ejemplo de entrenamiento.',
    },
    issues: {
      type: FunctionDeclarationSchemaType.ARRAY,
      description: 'Lista corta de problemas concretos observados.',
      items: {
        type: FunctionDeclarationSchemaType.STRING,
      },
    },
    recommendation: {
      type: FunctionDeclarationSchemaType.STRING,
      description: 'Siguiente ajuste concreto que debe intentar el usuario.',
    },
  },
  required: ['correct', 'score', 'feedback', 'usableForTraining', 'issues', 'recommendation'],
}

function parseBase64Image(input) {
  return String(input || '').replace(/^data:image\/\w+;base64,/, '')
}

const LSM_LETTER_REFERENCES = {
  A: 'Punio cerrado con el pulgar al costado de los dedos; no va arriba.',
  B: 'Cuatro dedos extendidos juntos hacia arriba y pulgar doblado al frente o sobre la palma.',
  C: 'Mano curvada en forma de C, ni completamente abierta ni completamente cerrada.',
  D: 'Solo el indice extendido hacia arriba; el pulgar se acerca o toca la base del dedo medio.',
  E: 'Todos los dedos doblados hacia la palma, compactos, con aspecto cerrado.',
  F: 'Pulgar e indice forman un circulo; medio, anular y menique extendidos.',
  G: 'Indice apuntando horizontalmente al lado; el pulgar acompana lateralmente.',
  H: 'Indice y medio extendidos juntos en horizontal; pulgar doblado, anular y menique cerrados.',
  I: 'Solo el menique extendido hacia arriba; los demas dedos cerrados.',
  J: 'Como la I pero con movimiento en forma de J; en foto fija evalua solo la configuracion inicial.',
  K: 'Indice y medio extendidos separados hacia arriba; pulgar activo entre ellos o elevado.',
  L: 'Indice hacia arriba y pulgar horizontal formando una L clara.',
  M: 'Punio con el pulgar debajo de tres dedos (indice, medio, anular).',
  N: 'Punio con el pulgar debajo de dos dedos (indice y medio).',
  'Ñ': 'Como N pero con movimiento; en foto fija evalua solo la configuracion base.',
  O: 'Dedos curvados formando una O cerrada con el pulgar.',
  P: 'Indice y medio apuntan hacia abajo; pulgar lateral.',
  Q: 'Indice y pulgar apuntan juntos hacia abajo.',
  R: 'Indice y medio extendidos pero cruzados entre si.',
  S: 'Punio cerrado con el pulgar por encima o al frente de los dedos.',
  T: 'Punio con el pulgar metido entre indice y medio.',
  U: 'Indice y medio extendidos juntos hacia arriba, muy cercanos.',
  V: 'Indice y medio extendidos separados en V.',
  W: 'Indice, medio y anular extendidos; menique cerrado.',
  X: 'Indice en gancho; en foto fija prioriza la forma del indice, no el movimiento.',
  Y: 'Pulgar y menique extendidos, dedos centrales cerrados.',
  Z: 'Indice extendido para trazar una Z; en foto fija evalua la mano base con indice activo y no castigues la falta de movimiento.',
}

const LSM_WORD_REFERENCES = {
  hola: 'Saludo en LSM con una sola mano cerca de la cabeza y movimiento lateral corto.',
  mundo: 'Sena de dos manos; requiere ambas manos visibles y coordinadas en espacio neutro.',
  gracias: 'Movimiento de cortesia cerca del rostro o boca con una mano.',
  'por favor': 'Sena de cortesia en torso o espacio neutro, fluida y relajada.',
  si: 'Gesto afirmativo claro y breve en espacio neutro.',
  no: 'Gesto negativo claro y breve en espacio neutro.',
  quiero: 'Sena asociada al pecho o espacio cercano al cuerpo.',
  necesito: 'Sena asociada a necesidad, cerca del torso.',
  ayuda: 'Sena de apoyo o asistencia, usualmente con trayectoria definida.',
  agua: 'Sena relacionada con boca o consumo.',
  comida: 'Sena relacionada con boca o acto de comer.',
  bano: 'Sena lexical de bano, en espacio neutro.',
  dolor: 'Sena que suele enfatizar molestia o dolor en el cuerpo.',
  donde: 'Sena interrogativa de localizacion.',
  hospital: 'Sena lexical de hospital, usualmente con estructura estable.',
}

function getTargetReference(targetSign, targetType) {
  const normalized = String(targetSign || '').trim()

  if (targetType === 'word') {
    const wordKey = normalized.toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
    return LSM_WORD_REFERENCES[wordKey] || null
  }

  return LSM_LETTER_REFERENCES[normalized.toUpperCase()] || null
}

function buildPrompt({
  targetSign,
  targetType = 'letter',
  handCount = 1,
  handQuality = null,
  featureSummary = null,
}) {
  const goal =
    targetType === 'word'
      ? `la palabra o seña completa "${targetSign}" de Lengua de Señas Mexicana (LSM)`
      : `la letra "${targetSign}" del alfabeto dactilologico de Lengua de Señas Mexicana (LSM)`
  const reference = getTargetReference(targetSign, targetType)

  return `
Eres un instructor experto en Lengua de Señas Mexicana (LSM).
Debes evaluar si la imagen muestra correctamente ${goal}.

Contexto adicional del sistema:
- handCount detectado por el motor local: ${handCount}
- handQuality: ${JSON.stringify(handQuality ?? {})}
- featureSummary del motor local: ${JSON.stringify(featureSummary ?? {})}
- referencia esperada para este objetivo: ${reference || 'usa criterio conservador y enfocate en la configuracion base de la mano.'}

Instrucciones:
1. Evalua solo la pose/seña visible en la imagen y comparala contra la referencia esperada.
2. Si la imagen no es suficiente o la mano esta mal encuadrada, dilo explicitamente; no inventes fallas anatomicas que no se vean con claridad.
3. Se conservador: si la pose es plausible o coincide con la referencia en lo esencial, no la marques como incorrecta por detalles menores.
4. Si la seña parece correcta o razonablemente cercana a la referencia, marca correct=true y da score alto.
5. Solo reporta issues cuando el error contradiga claramente la referencia o sea visible de forma inequívoca.
6. usableForTraining debe ser true si la muestra es razonablemente buena para entrenar, aunque no sea perfecta.
7. Si correct=true y score es 80 o mas, normalmente usableForTraining tambien debe ser true.
8. Rubrica sugerida:
   - 90-100: correcta o muy buena
   - 80-89: buena y usable para entrenamiento
   - 70-79: aceptable pero mejorable
   - 0-69: incorrecta o mala captura
9. Si targetType es "letter" y la letra suele requerir movimiento (por ejemplo Z, J, Ñ, X), evalua solo la configuracion visible de la mano en esta imagen y no castigues la falta de movimiento en una foto fija.
10. Si la muestra es buena pero hay un ajuste fino opcional, mencionalo en feedback o recommendation sin convertirlo en error grave.
11. Responde estrictamente con el JSON solicitado por el schema.
`.trim()
}

function normalizeFeedback(data) {
  const score = Number.isFinite(Number(data?.score))
    ? Math.max(0, Math.min(100, Number(data.score)))
    : 0
  const correct = Boolean(data?.correct)
  const usableForTraining = Boolean(data?.usableForTraining) || score >= 85 || (correct && score >= 80)

  return {
    correct,
    score,
    feedback: String(data?.feedback || 'No se pudo analizar la seña.'),
    usableForTraining,
    issues: Array.isArray(data?.issues)
      ? data.issues.map((value) => String(value)).slice(0, 5)
      : [],
    recommendation: String(data?.recommendation || 'Intenta con mejor encuadre e iluminacion.'),
  }
}

function extractJson(text) {
  const trimmed = String(text || '').trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Gemini no devolvio JSON parseable')
    return JSON.parse(match[0])
  }
}

router.post('/feedback', async (req, res) => {
  const {
    imageBase64,
    targetSign,
    targetType = 'letter',
    handCount = 1,
    handQuality = null,
    featureSummary = null,
  } = req.body ?? {}

  if (!imageBase64 || !targetSign) {
    return res.status(400).json({ error: 'imageBase64 y targetSign requeridos' })
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY no configurada' })
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: FEEDBACK_SCHEMA,
      },
    })

    const result = await model.generateContent([
      buildPrompt({ targetSign, targetType, handCount, handQuality, featureSummary }),
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: parseBase64Image(imageBase64),
        },
      },
    ])

    const raw = result.response.text()
    const parsed = normalizeFeedback(extractJson(raw))

    res.json(parsed)
  } catch (error) {
    console.error(`[Gemini feedback:${GEMINI_MODEL}]`, error.message)
    res.json({
      correct: false,
      score: 45,
      feedback: 'No pude analizar la seña con confianza. Intenta con mejor iluminacion, la mano centrada y sin movimiento.',
      usableForTraining: false,
      issues: ['analisis_fallido'],
      recommendation: 'Vuelve a capturar la mano completa y mas estable.',
    })
  }
})

export default router
