import { Router } from 'express'
import { body } from 'express-validator'
import * as authController from '../controllers/authController.js'
import { requireAuth } from '../middlewares/authMiddleware.js'

const router = Router()

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication and account endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     RegisterRequest:
 *       type: object
 *       required: [cccd, fullName, phone, address, password]
 *       properties:
 *         cccd: { type: string }
 *         fullName: { type: string }
 *         phone: { type: string }
 *         address: { type: string }
 *         password: { type: string, minLength: 6 }
 *     LoginRequest:
 *       type: object
 *       required: [cccd, password]
 *       properties:
 *         cccd: { type: string }
 *         password: { type: string }
 *     RefreshTokenRequest:
 *       type: object
 *       properties:
 *         refreshToken: { type: string }
 *     ChangePasswordRequest:
 *       type: object
 *       required: [currentPassword, newPassword]
 *       properties:
 *         currentPassword: { type: string }
 *         newPassword: { type: string, minLength: 6 }
 *     ForgotPasswordRequest:
 *       type: object
 *       required: [cccd]
 *       properties:
 *         cccd: { type: string }
 *     ResetPasswordRequest:
 *       type: object
 *       required: [token, newPassword]
 *       properties:
 *         token: { type: string }
 *         newPassword: { type: string, minLength: 6 }
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register new account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Registered successfully
 *       400:
 *         description: Validation error
 */
router.post(
  '/register',
  body('cccd').isString().notEmpty(),
  body('fullName').isString().notEmpty(),
  body('phone').isString().notEmpty(),
  body('address').isString().notEmpty(),
  body('password').isLength({ min: 6 }),
  authController.register
)

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Logged in
 *       400:
 *         description: Validation error
 *       401:
 *         description: Invalid credentials
 */
router.post(
  '/login',
  body('cccd').isString().notEmpty(),
  body('password').isString().notEmpty(),
  authController.login
)

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout
 *     tags: [Auth]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *     responses:
 *       200:
 *         description: Logged out
 */
router.post('/logout', authController.logout)

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *     responses:
 *       200:
 *         description: Token refreshed
 *       401:
 *         description: Missing/invalid refresh token
 */
router.post('/refresh', authController.refresh)

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user
 *       401:
 *         description: Unauthorized
 */
router.get('/me', requireAuth, authController.me)

/**
 * @swagger
 * /api/auth/verify-token:
 *   get:
 *     summary: Verify access token
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token valid
 *       401:
 *         description: Unauthorized
 */
router.get('/verify-token', requireAuth, authController.verifyToken)

/**
 * @swagger
 * /api/auth/change-password:
 *   put:
 *     summary: Change password
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangePasswordRequest'
 *     responses:
 *       200:
 *         description: Password changed
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.put(
  '/change-password',
  requireAuth,
  body('currentPassword').isString().notEmpty(),
  body('newPassword').isLength({ min: 6 }),
  authController.changePassword
)

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordRequest'
 *     responses:
 *       200:
 *         description: Reset email sent
 *       400:
 *         description: Validation error
 */
router.post(
  '/forgot-password',
  body('cccd').isString().notEmpty(),
  authController.forgotPassword
)

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordRequest'
 *     responses:
 *       200:
 *         description: Password reset
 *       400:
 *         description: Validation error
 */
router.post(
  '/reset-password',
  body('token').isString().notEmpty(),
  body('newPassword').isLength({ min: 6 }),
  authController.resetPassword
)

export default router

