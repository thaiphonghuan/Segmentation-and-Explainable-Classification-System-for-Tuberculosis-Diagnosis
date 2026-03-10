import jwt from 'jsonwebtoken'

export function signAccessToken(payload, options = {}) {
  const secret = process.env.JWT_SECRET
  const expiresIn = options.expiresIn || process.env.JWT_ACCESS_EXPIRES_IN || '15m'
  return jwt.sign(payload, secret, { expiresIn })
}

export function signRefreshToken(payload, options = {}) {
  const secret = process.env.JWT_SECRET
  const expiresIn = options.expiresIn || process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  return jwt.sign(payload, secret, { expiresIn })
}

export function verifyJwt(token) {
  const secret = process.env.JWT_SECRET
  return jwt.verify(token, secret)
}

