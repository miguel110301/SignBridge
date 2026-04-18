import jwt from 'jsonwebtoken'

const TOKEN_EXPIRATION = '30d'

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

export function requireJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET no está configurado')
  }
  return secret
}

export function signAuthToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      email: user.email,
      name: user.name,
    },
    requireJwtSecret(),
    { expiresIn: TOKEN_EXPIRATION }
  )
}

export function verifyAuthToken(token) {
  return jwt.verify(token, requireJwtSecret())
}

export function toPublicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    xp: user.xp ?? 0,
    level: user.level ?? 1,
    createdAt: user.createdAt,
  }
}
