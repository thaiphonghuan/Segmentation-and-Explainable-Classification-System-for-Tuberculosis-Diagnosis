import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { User, RefreshToken, PasswordResetToken } from '../models/index.js'
import { signAccessToken, signRefreshToken, verifyJwt } from '../config/jwt.js'
import { sendEmail } from './emailService.js'

function createError(status, message, details) {
  const err = new Error(message)
  err.status = status
  if (details) err.details = details
  return err
}

function safeUser(u) {
  return {
    id: u.id,
    cccd: u.cccd,
    fullName: u.full_name,
    phone: u.phone,
    address: u.address,
    is_active: u.is_active,
    avatar_url: u.avatar_data && u.avatar_mimetype
      ? `data:${u.avatar_mimetype};base64,${u.avatar_data.toString('base64')}`
      : null,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
  }
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex')
}

function parseJwtExpToDate(token) {
  const decoded = verifyJwt(token)
  const expMs = (decoded.exp || 0) * 1000
  if (!expMs) throw createError(500, 'Invalid refresh token exp')
  return new Date(expMs)
}

export async function register({ cccd, fullName, phone, address, password }) {
  const existing = await User.findOne({ where: { cccd } })
  if (existing) throw createError(400, 'CCCD already registered')

  const user = await User.create({
    cccd,
    full_name: fullName,
    phone,
    address,
    password_hash: password,
  })

  const accessToken = signAccessToken({ sub: user.id })
  const refreshToken = signRefreshToken({ sub: user.id, typ: 'refresh' })

  await RefreshToken.create({
    user_id: user.id,
    token_hash: sha256(refreshToken),
    expires_at: parseJwtExpToDate(refreshToken),
  })

  return { user: safeUser(user), accessToken, refreshToken }
}

export async function login({ cccd, password }) {
  const user = await User.findOne({ where: { cccd } })
  if (!user) throw createError(404, 'Account not found')
  if (!user.is_active) throw createError(403, 'Account is inactive')

  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) throw createError(400, 'Invalid credentials')

  const accessToken = signAccessToken({ sub: user.id })
  const refreshToken = signRefreshToken({ sub: user.id, typ: 'refresh' })

  await RefreshToken.create({
    user_id: user.id,
    token_hash: sha256(refreshToken),
    expires_at: parseJwtExpToDate(refreshToken),
  })

  return { user: safeUser(user), accessToken, refreshToken }
}

export async function logout({ refreshToken }) {
  if (!refreshToken) return { message: 'Logged out' }
  const tokenHash = sha256(refreshToken)
  const row = await RefreshToken.findOne({ where: { token_hash: tokenHash } })
  if (row && !row.revoked_at) {
    row.revoked_at = new Date()
    await row.save()
  }
  return { message: 'Logged out' }
}

export async function refresh({ refreshToken }) {
  if (!refreshToken) throw createError(401, 'Missing refresh token')

  let decoded
  try {
    decoded = verifyJwt(refreshToken)
  } catch {
    throw createError(401, 'Invalid refresh token')
  }
  if (decoded.typ !== 'refresh') throw createError(401, 'Invalid refresh token type')

  const tokenHash = sha256(refreshToken)
  const row = await RefreshToken.findOne({ where: { token_hash: tokenHash } })
  if (!row) throw createError(401, 'Refresh token not found')
  if (row.revoked_at) throw createError(401, 'Refresh token revoked')
  if (new Date() > row.expires_at) throw createError(401, 'Refresh token expired')

  // rotate: revoke old, issue new
  row.revoked_at = new Date()
  await row.save()

  const newAccessToken = signAccessToken({ sub: decoded.sub })
  const newRefreshToken = signRefreshToken({ sub: decoded.sub, typ: 'refresh' })
  await RefreshToken.create({
    user_id: decoded.sub,
    token_hash: sha256(newRefreshToken),
    expires_at: parseJwtExpToDate(newRefreshToken),
  })

  const user = await User.findByPk(decoded.sub)
  if (!user) throw createError(404, 'User not found')

  return { user: safeUser(user), accessToken: newAccessToken, refreshToken: newRefreshToken }
}

export async function me({ userId }) {
  const user = await User.findByPk(userId)
  if (!user) throw createError(404, 'User not found')
  return safeUser(user)
}

export async function changePassword({ userId, currentPassword, newPassword }) {
  const user = await User.findByPk(userId)
  if (!user) throw createError(404, 'User not found')

  const ok = await bcrypt.compare(currentPassword, user.password_hash)
  if (!ok) throw createError(400, 'Current password incorrect')

  user.password_hash = newPassword
  await user.save()

  // revoke all refresh tokens for this user
  await RefreshToken.update({ revoked_at: new Date() }, { where: { user_id: userId, revoked_at: null } })
  return { message: 'Password changed' }
}

export async function forgotPassword({ cccd }) {
  const user = await User.findOne({ where: { cccd } })
  if (!user) {
    // do not leak existence
    return { message: 'If the account exists, a reset link has been sent.' }
  }

  // You can switch to OTP by storing short code instead of token.
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

  await PasswordResetToken.create({
    user_id: user.id,
    token,
    expires_at: expiresAt,
    is_used: false,
  })

  const resetUrlBase = process.env.FRONTEND_RESET_URL || 'http://localhost:5173/reset-password'
  const resetUrl = `${resetUrlBase}?token=${encodeURIComponent(token)}`
  const html = `
    <h2>Reset Password</h2>
    <p>Xin chào ${user.full_name},</p>
    <p>Bạn đã yêu cầu đặt lại mật khẩu. Vui lòng bấm vào link bên dưới:</p>
    <p><a href="${resetUrl}">Reset Password</a></p>
    <p>Link sẽ hết hạn sau 15 phút.</p>
  `

  // Optional: if you don’t have email in schema yet, you can log token for dev.
  // For production, add email field in User and send to it.
  const to = process.env.SMTP_USER
  if (to) {
    try {
      await sendEmail({ to, subject: 'Reset Password', html })
    } catch (e) {
      console.error('Email sending failed:', e.message)
    }
  } else {
    console.log('[DEV] Reset token:', token)
  }

  return { message: 'If the account exists, a reset link has been sent.', expiresIn: '15 minutes' }
}

export async function resetPassword({ token, newPassword }) {
  const resetToken = await PasswordResetToken.findOne({
    where: { token },
    include: [{ model: User }],
  })

  if (!resetToken) throw createError(400, 'Invalid token')
  if (resetToken.is_used) throw createError(400, 'Token already used')
  if (new Date() > resetToken.expires_at) throw createError(400, 'Token expired')

  const user = resetToken.User
  if (!user) throw createError(404, 'User not found')

  user.password_hash = newPassword
  await user.save()
  await resetToken.update({ is_used: true })

  // revoke all refresh tokens
  await RefreshToken.update({ revoked_at: new Date() }, { where: { user_id: user.id, revoked_at: null } })

  const accessToken = signAccessToken({ sub: user.id })
  const refreshToken = signRefreshToken({ sub: user.id, typ: 'refresh' })
  await RefreshToken.create({
    user_id: user.id,
    token_hash: sha256(refreshToken),
    expires_at: parseJwtExpToDate(refreshToken),
  })

  return { message: 'Password reset successfully', user: safeUser(user), accessToken, refreshToken }
}

