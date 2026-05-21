/**
 * apps/api/index.js
 * Servidor Express para SignBridge.
 *
 * Responsabilidades:
 *  - Proxy seguro a ElevenLabs (las API keys nunca van al cliente)
 *  - Proxy a Gemini para el módulo de práctica
 *  - CRUD de progreso del usuario en MongoDB Atlas
 */

import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

import express    from 'express'
import cors       from 'cors'
import mongoose   from 'mongoose'
import authRoute from './routes/auth.js'
import elevenRoute  from './routes/elevenlabs.js'
import geminiRoute  from './routes/gemini.js'
import progressRoute from './routes/progress.js'
import trainingRoute from './routes/training.js'
import learningRoute from './routes/learning.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const webDistDir = path.resolve(__dirname, '../web/dist')

// Soporta ambos escenarios:
// 1. `apps/api/.env` cuando el backend tiene su propio archivo
// 2. `../../.env` cuando el monorepo comparte variables desde la raiz
dotenv.config({ path: path.resolve(__dirname, '.env') })
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: false })

const app  = express()
const PORT = process.env.PORT || 3001

// ── Middleware ────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://localhost:3001',
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : []),
])

app.use(cors({
  origin(origin, callback) {
    // Sin origin = petición directa (Postman, curl, mismo servidor)
    if (!origin) return callback(null, true)
    // Cualquier subdominio de vercel.app (preview deployments incluidos)
    if (origin.endsWith('.vercel.app') || ALLOWED_ORIGINS.has(origin)) {
      return callback(null, true)
    }
    callback(new Error(`CORS bloqueado para: ${origin}`))
  },
  credentials: true,
}))
app.use(express.json({ limit: '5mb' }))   // imágenes en base64 para Gemini

// ── Rutas ─────────────────────────────────────────────────────────────────────
app.use('/api/speak',    elevenRoute)
app.use('/api/practice', geminiRoute)
app.use('/api/progress', progressRoute)
app.use('/api/training', trainingRoute)
app.use('/api/auth', authRoute)
app.use('/api/learning', learningRoute)

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

// ── Frontend compilado ────────────────────────────────────────────────────────
if (existsSync(webDistDir)) {
  app.use(express.static(webDistDir))

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') {
      next()
      return
    }

    res.sendFile(path.join(webDistDir, 'index.html'))
  })
}

// En Vercel el runtime llama directamente al handler; no se necesita listen()
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n🟢 SignBridge server corriendo en http://localhost:${PORT}`)
    console.log(`   ElevenLabs key: ${process.env.ELEVENLABS_API_KEY ? '✓ configurada' : '✗ FALTA'}`)
    console.log(`   Gemini key:     ${process.env.GEMINI_API_KEY     ? '✓ configurada' : '✗ FALTA'}\n`)
  })
}

export default app
