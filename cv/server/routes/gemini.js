/**
 * server/routes/gemini.js
 *
 * POST /api/practice/feedback
 * Body: { imageBase64: string, targetSign: string }
 * Response: { feedback: string, correct: boolean, score: number }
 *
 * Gemini Vision analiza la imagen de la mano del usuario
 * y da feedback específico sobre cómo mejorar la seña.
 */

import express                        from 'express'
import { GoogleGenerativeAI }         from '@google/generative-ai'

const router = express.Router()

router.post('/feedback', async (req, res) => {
  const { imageBase64, targetSign } = req.body

  if (!imageBase64 || !targetSign) {
    return res.status(400).json({ error: 'imageBase64 y targetSign requeridos' })
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY no configurada' })
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `
Eres un instructor experto en Lengua de Señas Mexicana (LSM).
El usuario está intentando hacer la seña de la letra "${targetSign}" del alfabeto dactilológico LSM.

Analiza la imagen de la mano del usuario y:
1. Determina si la seña es correcta o necesita ajuste.
2. Si necesita ajuste, describe EXACTAMENTE qué dedo o posición está mal, de forma empática y específica.
3. Da una puntuación del 0 al 100.

Responde SOLO con JSON, sin texto adicional ni backticks:
{
  "correct": true/false,
  "score": 0-100,
  "feedback": "mensaje corto y empático en español (máximo 2 oraciones)"
}
`

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64.replace(/^data:image\/\w+;base64,/, '')
        }
      }
    ])

    const raw  = result.response.text().trim()
    const data = JSON.parse(raw)

    res.json(data)

  } catch (err) {
    console.error('[Gemini]', err.message)

    // Fallback si Gemini falla — no rompe el hackathon
    res.json({
      correct:  false,
      score:    50,
      feedback: 'No pude analizar la imagen. Intenta con mejor iluminación y la mano centrada.'
    })
  }
})

export default router
