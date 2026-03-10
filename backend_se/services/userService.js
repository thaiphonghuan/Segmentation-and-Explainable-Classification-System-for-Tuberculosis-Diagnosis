import bcrypt from 'bcryptjs'
import { User, RefreshToken } from '../models/index.js'

function createError(status, message) {
  const err = new Error(message)
  err.status = status
  return err
}

function toProfile(u) {
  const avatarBase64 = u.avatar_data && u.avatar_mimetype
    ? `data:${u.avatar_mimetype};base64,${u.avatar_data.toString('base64')}`
    : null

  return {
    id: u.id,
    cccd: u.cccd,
    fullName: u.full_name,
    phone: u.phone,
    address: u.address,
    avatar_url: avatarBase64,
    is_active: u.is_active,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
  }
}

export async function getProfile(userId) {
  const user = await User.findByPk(userId)
  if (!user) throw createError(404, 'User not found')
  return toProfile(user)
}

export async function updateProfile(userId, payload) {
  const user = await User.findByPk(userId)
  if (!user) throw createError(404, 'User not found')

  const { fullName, phone, address } = payload
  if (fullName !== undefined) user.full_name = fullName
  if (phone !== undefined) user.phone = phone
  if (address !== undefined) user.address = address

  await user.save()
  return { message: 'Profile updated successfully', user: toProfile(user) }
}

export async function updateUserAvatar(userId, avatarBuffer, mimetype) {
  const user = await User.findByPk(userId)
  if (!user) throw createError(404, 'User not found')
  user.avatar_data = avatarBuffer
  user.avatar_mimetype = mimetype
  await user.save()
  return toProfile(user)
}

export async function deleteUserById(userId) {
  const user = await User.findByPk(userId)
  if (!user) throw createError(404, 'User not found')

  await RefreshToken.update({ revoked_at: new Date() }, { where: { user_id: userId, revoked_at: null } })
  await user.destroy()
}

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await User.findByPk(userId)
  if (!user) throw createError(404, 'User not found')
  const ok = await bcrypt.compare(currentPassword, user.password_hash)
  if (!ok) throw createError(400, 'Current password incorrect')
  user.password_hash = newPassword
  await user.save()
  await RefreshToken.update({ revoked_at: new Date() }, { where: { user_id: userId, revoked_at: null } })
}

