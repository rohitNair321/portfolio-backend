const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer(); // memory storage - keeps files in buffer
const { verifyToken, requireUser, allowPublic } = require('../middleware/authVerify');
const {
  getMyProfile,
  updateMyProfile,
  downloadResume,
  token
} = require('../controllers/profileController');

router.get('/token', token);
router.get('/getMyProfile', verifyToken, allowPublic, getMyProfile);          // GET current user's profile
router.put('/saveUpdateMyProfile', verifyToken, requireUser, upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'resume', maxCount: 1 }
]), updateMyProfile);                                   // multipart/form-data
router.get('/me/resume', verifyToken, downloadResume);  // return signed URL for resume download

module.exports = router;
