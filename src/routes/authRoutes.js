// routes/authRoutes.js
const express = require('express');
const { registerUser, loginUser, forgotPassword, resetPassword } = require('../controllers/authController');

const router = express.Router();

// /api/auth/register
router.post('/register', registerUser);
// /api/auth/login
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
