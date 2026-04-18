import express from 'express'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import {
  normalizeEmail,
  signAuthToken,
  toPublicUser,
  verifyAuthToken,
} from '../lib/auth.js'

const router = express.Router()

function validateRegistrationPayload(body = {}) {
  const name = String(body.name || '').trim()
  const email = normalizeEmail(body.email)
  const password = String(body.password || '')

  if (name.length < 2) return 'El nombre debe tener al menos 2 caracteres.'
  if (!email.includes('@')) return 'Email inválido.'
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.'

  return null
}

function validateLoginPayload(body = {}) {
  const email = normalizeEmail(body.email)
  const password = String(body.password || '')

  if (!email.includes('@')) return 'Email inválido.'
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.'

  return null
}

function readBearerToken(req) {
  const authorization = req.headers.authorization || ''
  if (!authorization.startsWith('Bearer ')) return null
  return authorization.slice('Bearer '.length).trim()
}

router.post('/register', async (req, res) => {
  const error = validateRegistrationPayload(req.body)
  if (error) return res.status(400).json({ error })

  const name = String(req.body.name).trim()
  const email = normalizeEmail(req.body.email)
  const password = String(req.body.password)

  try {
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(409).json({ error: 'Ese email ya está registrado.' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await User.create({
      name,
      email,
      passwordHash,
    })

    res.status(201).json({
      token: signAuthToken(user),
      user: toPublicUser(user),
    })
  } catch (routeError) {
    res.status(500).json({ error: routeError.message })
  }
})

router.post('/login', async (req, res) => {
  const error = validateLoginPayload(req.body)
  if (error) return res.status(400).json({ error })

  const email = normalizeEmail(req.body.email)
  const password = String(req.body.password)

  try {
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(401).json({ error: 'Email o contraseña inválidos.' })
    }

    const passwordIsValid = await bcrypt.compare(password, user.passwordHash)
    if (!passwordIsValid) {
      return res.status(401).json({ error: 'Email o contraseña inválidos.' })
    }

    res.json({
      token: signAuthToken(user),
      user: toPublicUser(user),
    })
  } catch (routeError) {
    res.status(500).json({ error: routeError.message })
  }
})

router.get('/profile', async (req, res) => {
  const token = readBearerToken(req)
  if (!token) {
    return res.status(401).json({ error: 'Falta token de autenticación.' })
  }

  try {
    const payload = verifyAuthToken(token)
    const user = await User.findById(payload.sub)

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' })
    }

    res.json({ user: toPublicUser(user) })
  } catch (routeError) {
    res.status(401).json({ error: 'Token inválido o expirado.' })
  }
})

export default router
