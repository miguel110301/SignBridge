/**
 * server/routes/elevenlabs.js
 *
 * POST /api/speak
 * Body: { text: string, voiceId?: string }
 * Response: audio/mpeg stream
 *
 * Por qué está en el servidor y no en el cliente:
 * Si la API key estuviera en el cliente, cualquiera podría
 * extraerla del código y usar tu cuota gratuitamente.
 */

import express from 'express'
import axios   from 'axios'

const router = express.Router()

const ELEVEN_BASE = 'https://api.elevenlabs.io/v1'

// Configuración de la voz — ajustar según el demo
const VOICE_SETTINGS = {
  stability:         0.5,   // 0 = muy expresivo, 1 = muy estable
  similarity_boost:  0.75,  // qué tanto se parece a la voz original
  style:             0.0,
  use_speaker_boost: true
}

router.post('/', async (req, res) => {
  const { text, voiceId } = req.body

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: 'text requerido' })
  }

  const selectedVoice = voiceId || process.env.ELEVENLABS_VOICE_ID

  if (!process.env.ELEVENLABS_API_KEY) {
    return res.status(500).json({ error: 'ELEVENLABS_API_KEY no configurada' })
  }

  try {
    const response = await axios.post(
      `${ELEVEN_BASE}/text-to-speech/${selectedVoice}`,
      {
        text:           text.trim(),
        model_id:       'eleven_multilingual_v2',  // soporta español nativo
        voice_settings: VOICE_SETTINGS
      },
      {
        headers: {
          'xi-api-key':   process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept':       'audio/mpeg'
        },
        responseType: 'arraybuffer'
      }
    )

    res.set({
      'Content-Type':  'audio/mpeg',
      'Content-Length': response.data.byteLength,
      'Cache-Control':  'no-cache'
    })
    res.send(Buffer.from(response.data))

  } catch (err) {
    const status  = err.response?.status ?? 500
    const message = err.response?.data
      ? Buffer.from(err.response.data).toString()
      : err.message

    console.error('[ElevenLabs]', status, message)
    res.status(status).json({ error: message })
  }
})

export default router
