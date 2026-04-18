/**
 * server/index.js
 * Servidor Express para SignBridge.
 *
 * Responsabilidades:
 *  - Proxy seguro a ElevenLabs (las API keys nunca van al cliente)
 *  - Proxy a Gemini para el módulo de práctica
 *  - CRUD de progreso del usuario en MongoDB Atlas
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

import express    from 'express'
import cors       from 'cors'
import mongoose   from 'mongoose'
import elevenRoute  from './routes/elevenlabs.js'
import geminiRoute  from './routes/gemini.js'
import progressRoute from './routes/progress.js'
import trainingRoute from './routes/training.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Soporta ambos escenarios:
// 1. `server/.env` cuando el backend tiene su propio archivo
// 2. `../.env` cuando el monorepo comparte variables desde la raiz
dotenv.config({ path: path.resolve(__dirname, '.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: false })

const app  = express()
const PORT = process.env.PORT || 3001

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'http://localhost:5173',      // Vite dev
    'https://signbridge.vercel.app', // Producción (actualizar con tu dominio)
  ],
  credentials: true
}))
app.use(express.json({ limit: '5mb' }))   // imágenes en base64 para Gemini

// ── Rutas ─────────────────────────────────────────────────────────────────────
app.use('/api/speak',    elevenRoute)
app.use('/api/practice', geminiRoute)
app.use('/api/progress', progressRoute)
app.use('/api/training', trainingRoute)

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', ts: Date.now() }))

// ── Conexión a MongoDB ──────────────────────────────────────────────────────────
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('   MongoDB:        ✓ conectado'))
    .catch((err) => console.log('   MongoDB:        ✗ ERROR:', err.message))
} else {
  console.log('   MongoDB:        ✗ FALTA (URI no definida)')
}

// ── Arrancar ──────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send('La API de SignBridge esta funcionando correctamente en el servidor.');
});

app.listen(PORT, () => {
  console.log(`\n🟢 SignBridge server corriendo en http://localhost:${PORT}`)
  console.log(`   ElevenLabs key: ${process.env.ELEVENLABS_API_KEY ? '✓ configurada' : '✗ FALTA'}`)
  console.log(`   Gemini key:     ${process.env.GEMINI_API_KEY     ? '✓ configurada' : '✗ FALTA'}\n`)
})
