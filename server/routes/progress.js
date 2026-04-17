/**
 * server/routes/progress.js
 *
 * Guarda el progreso del usuario en el módulo de práctica.
 *
 * GET  /api/progress/:userId      → obtener progreso
 * POST /api/progress/:userId      → actualizar seña practicada
 * DELETE /api/progress/:userId    → resetear progreso
 */

import express  from 'express'
import mongoose from 'mongoose'
import UserProgress from '../models/UserProgress.js'

const router = express.Router()

// ── Conectar a MongoDB Atlas (lazy, solo cuando se usa esta ruta) ─────────────
let connected = false
async function ensureConnection() {
  if (connected || !process.env.MONGODB_URI) return
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    connected = true
    console.log('[MongoDB] Conectado a Atlas')
  } catch (err) {
    console.error('[MongoDB] Error de conexión:', err.message)
  }
}

// ── GET /api/progress/leaderboard ─────────────────────────────────────────────
router.get('/leaderboard', async (req, res) => {
  await ensureConnection()
  try {
    const leaderboard = await UserProgress.aggregate([
      { $match: { streak: { $gt: 0 } } },
      {
        $project: {
          userId: 1,
          streak: 1,
          masteredCount: {
            $size: {
              $filter: {
                input: '$signs',
                as: 'sign',
                cond: { $eq: ['$$sign.mastered', true] }
              }
            }
          }
        }
      },
      { $sort: { streak: -1, masteredCount: -1 } },
      { $limit: 10 }
    ])
    res.json(leaderboard)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/progress/:userId ─────────────────────────────────────────────────
router.get('/:userId', async (req, res) => {
  await ensureConnection()
  try {
    const doc = await UserProgress.findOne({ userId: req.params.userId })
    if (!doc) return res.json({ userId: req.params.userId, signs: [], streak: 0 })
    res.json(doc)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/progress/:userId ────────────────────────────────────────────────
// Body: { letter: 'A', score: 87 }
router.post('/:userId', async (req, res) => {
  await ensureConnection()
  const { letter, score } = req.body

  if (!letter || score === undefined) {
    return res.status(400).json({ error: 'letter y score requeridos' })
  }

  try {
    let doc = await UserProgress.findOne({ userId: req.params.userId })

    if (!doc) {
      doc = new UserProgress({ userId: req.params.userId, signs: [] })
    }

    // Buscar o crear el registro de esta letra
    let signRecord = doc.signs.find(s => s.letter === letter)
    if (!signRecord) {
      doc.signs.push({ letter, attempts: 0, bestScore: 0, mastered: false })
      signRecord = doc.signs[doc.signs.length - 1]
    }

    signRecord.attempts++
    signRecord.lastPractice = new Date()
    if (score > signRecord.bestScore) signRecord.bestScore = score
    if (score >= 85) signRecord.mastered = true

    // Actualizar racha
    const today    = new Date().toDateString()
    const lastDate = doc.lastActive?.toDateString()
    if (lastDate !== today) {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      doc.streak = lastDate === yesterday.toDateString() ? doc.streak + 1 : 1
    }
    doc.lastActive = new Date()

    await doc.save()
    res.json({ success: true, signRecord, streak: doc.streak })

  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/progress/:userId ──────────────────────────────────────────────
router.delete('/:userId', async (req, res) => {
  await ensureConnection()
  try {
    await UserProgress.deleteOne({ userId: req.params.userId })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
