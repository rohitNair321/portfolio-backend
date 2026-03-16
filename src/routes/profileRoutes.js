const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer(); // memory storage - keeps files in buffer
const { verifyToken, requireAdmin, allowPublic, optionalAuth } = require('../middleware/authVerify');
const {
  getMyProfile,
  updateMyProfile,
  downloadResume
} = require('../controllers/profileController');

/**
 * @swagger
 * /api/profile/getMyProfile:
 *   get:
 *     summary: Retrieve public profile data
 *     tags: [Profile]
 *     responses:
 *       200:
 *         description: Profile data retrieved successfully
 */
router.get('/getMyProfile', optionalAuth, getMyProfile);          // GET current user's profile
router.put('/saveUpdateMyProfile', verifyToken, requireAdmin, upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'resume', maxCount: 1 }
]), updateMyProfile);                                   // multipart/form-data

/**
 * @swagger
 * /api/profile/me/resume:
 *   get:
 *     summary: Download resume (Admin only)
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resume download link
 */
router.get('/me/resume', verifyToken, requireAdmin, downloadResume);  // return signed URL for resume download

module.exports = router;
