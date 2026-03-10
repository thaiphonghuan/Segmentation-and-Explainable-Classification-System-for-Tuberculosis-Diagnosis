import { Router } from 'express'
import { body } from 'express-validator'
import multer from 'multer'
import { requireAuth } from '../middlewares/authMiddleware.js'
import * as userController from '../controllers/userController.js'

const router = Router()

/**
 * @swagger
 * tags:
 *   - name: Users
 *     description: User profile endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     UpdateProfileRequest:
 *       type: object
 *       properties:
 *         fullName: { type: string }
 *         phone: { type: string }
 *         address: { type: string }
 */

const storage = multer.memoryStorage()
const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Only image files are allowed!'), false)
  },
  limits: { fileSize: 5 * 1024 * 1024 },
})

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get current user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile data
 *       401:
 *         description: Unauthorized
 */
router.get('/users/profile', requireAuth, userController.getProfile)

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update current user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileRequest'
 *     responses:
 *       200:
 *         description: Profile updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.put(
  '/users/profile',
  requireAuth,
  body('fullName').optional().isString(),
  body('phone').optional().isString(),
  body('address').optional().isString(),
  userController.updateProfile
)

/**
 * @swagger
 * /api/users/avatar:
 *   post:
 *     summary: Upload avatar image
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar uploaded
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/users/avatar', requireAuth, upload.single('avatar'), userController.uploadAvatar)

/**
 * @swagger
 * /api/users/profile:
 *   delete:
 *     summary: Delete current user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User deleted
 *       401:
 *         description: Unauthorized
 */
router.delete('/users/profile', requireAuth, userController.deleteMe)

export default router

