import { validationResult } from 'express-validator'
import * as authService from '../services/authService.js'

function cookieOptions() {
  return {
    httpOnly: true,
    secure: String(process.env.COOKIE_SECURE || 'false').toLowerCase() === 'true',
    sameSite: process.env.COOKIE_SAMESITE || 'lax',
    path: '/api/auth',
  }
}

export async function register(req, res, next) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Validation error', details: errors.array() })

    const { cccd, fullName, phone, address, password } = req.body
    const result = await authService.register({ cccd, fullName, phone, address, password })

    res.cookie('refresh_token', result.refreshToken, cookieOptions())
    res.status(201).json({ user: result.user, accessToken: result.accessToken })
  } catch (e) { next(e) }
}

export async function login(req, res, next) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Validation error', details: errors.array() })

    const { cccd, password } = req.body
    const result = await authService.login({ cccd, password })

    res.cookie('refresh_token', result.refreshToken, cookieOptions())
    res.json({ user: result.user, accessToken: result.accessToken })
  } catch (e) { next(e) }
}

export async function logout(req, res, next) {
  try {
    const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken
    await authService.logout({ refreshToken })
    res.clearCookie('refresh_token', cookieOptions())
    res.json({ message: 'Logged out' })
  } catch (e) { next(e) }
}

export async function refresh(req, res, next) {
  try {
    const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken
    const result = await authService.refresh({ refreshToken })
    res.cookie('refresh_token', result.refreshToken, cookieOptions())
    res.json({ user: result.user, accessToken: result.accessToken })
  } catch (e) { next(e) }
}

export async function me(req, res, next) {
  try {
    const userId = req.user.sub
    const user = await authService.me({ userId })
    res.json(user)
  } catch (e) { next(e) }
}

export async function verifyToken(req, res) {
  res.json({ valid: true, user: req.user })
}

export async function changePassword(req, res, next) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Validation error', details: errors.array() })
    const userId = req.user.sub
    const { currentPassword, newPassword } = req.body
    const result = await authService.changePassword({ userId, currentPassword, newPassword })
    res.json(result)
  } catch (e) { next(e) }
}

export async function forgotPassword(req, res, next) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Validation error', details: errors.array() })
    const { cccd } = req.body
    const result = await authService.forgotPassword({ cccd })
    res.json(result)
  } catch (e) { next(e) }
}

export async function resetPassword(req, res, next) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Validation error', details: errors.array() })
    const { token, newPassword } = req.body
    const result = await authService.resetPassword({ token, newPassword })
    res.cookie('refresh_token', result.refreshToken, cookieOptions())
    res.json({ message: result.message, user: result.user, accessToken: result.accessToken })
  } catch (e) { next(e) }
}

