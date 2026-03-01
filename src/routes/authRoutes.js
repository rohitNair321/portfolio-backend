// routes/authRoutes.js
const express = require('express');
const { loginUser, forgotPassword, resetPassword, updatePassword } = require('../controllers/authController');
const { verifyToken, requireAdmin } = require('../middleware/authVerify');
const router = express.Router();

// /api/auth/register
// router.post('/register', registerUser);
// /api/auth/login

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: User authentication and password management
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate user and return JWT token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 */
router.post('/login', loginUser);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Send password reset link
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reset email sent
 */
router.post('/forgot-password', forgotPassword);

/**
 * @swagger
 * /api/auth/reset-password:
 * post:
 * summary: Reset user password
 * tags: [Auth]
 * requestBody:
 *   required: true
 *   content:
 *     application/json:
 *       schema:
 *         type: object
 *         properties:
 *           token:
 *             type: string
 *           newPassword:
 *             type: string
 * responses:
 *   200:
 *     description: Password reset successful
 */
router.post('/reset-password', resetPassword);

/**
 * @swagger
 * /api/auth/update-password:
 *   put:
 *     summary: Update admin password
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       401:
 *         description: Current password incorrect
 */
router.put('/update-password', verifyToken, requireAdmin, updatePassword);

module.exports = router;
