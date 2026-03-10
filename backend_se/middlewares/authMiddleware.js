import { verifyJwt } from '../config/jwt.js'

export function requireAuth(req, res, next) {
  try {
    const auth = req.headers['authorization'] || ''
    const parts = auth.split(' ')
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ message: 'Missing or invalid Authorization header' })
    }
    const payload = verifyJwt(parts[1])
    req.user = payload
    next()
  } catch (_err) {
    return res.status(401).json({ message: 'Invalid token' })
  }
}

