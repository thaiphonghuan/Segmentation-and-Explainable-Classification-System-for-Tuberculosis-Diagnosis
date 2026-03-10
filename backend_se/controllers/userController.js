import { validationResult } from 'express-validator'
import * as userService from '../services/userService.js'

export async function getProfile(req, res, next) {
  try {
    const profile = await userService.getProfile(req.user.sub)
    res.json(profile)
  } catch (e) { next(e) }
}

export async function updateProfile(req, res, next) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Validation error', details: errors.array() })
    const updated = await userService.updateProfile(req.user.sub, req.body)
    res.json(updated)
  } catch (e) { next(e) }
}

export async function uploadAvatar(req, res, next) {
  try {
    if (!req.file) {
      const err = new Error('No file uploaded')
      err.status = 400
      throw err
    }
    const userId = req.user.sub
    const avatarBuffer = req.file.buffer
    const mimetype = req.file.mimetype
    const updatedUser = await userService.updateUserAvatar(userId, avatarBuffer, mimetype)
    res.json({ message: 'Avatar uploaded successfully', avatar_url: updatedUser.avatar_url })
  } catch (e) { next(e) }
}

export async function deleteMe(req, res, next) {
  try {
    await userService.deleteUserById(req.user.sub)
    res.json({ message: 'User account deleted successfully' })
  } catch (e) { next(e) }
}

