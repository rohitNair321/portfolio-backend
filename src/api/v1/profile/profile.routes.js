// api/v1/profile/profile.routes.js
const express = require('express');
const router = express.Router();
const profileController = require('../../../controllers/profileController');
const { verifyToken, requireAdmin } = require('../../../middleware/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Profile
 *   description: Portfolio profile management
 */

/**
 * @swagger
 * /api/v1/profile:
 *   get:
 *     summary: Get profile data
 *     tags: [Profile]
 *     responses:
 *       200:
 *         description: Profile data retrieved
 */
router.get('/', profileController.getProfile || ((req, res) => {
  res.json({ message: 'Profile endpoint - implement in profileController' });
}));

/**
 * @swagger
 * /api/v1/profile:
 *   put:
 *     summary: Update profile (Admin only)
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.put(
  '/',
  verifyToken,
  requireAdmin,
  profileController.updateProfile || ((req, res) => {
    res.json({ message: 'Update profile endpoint - implement in profileController' });
  })
);

module.exports = router;
