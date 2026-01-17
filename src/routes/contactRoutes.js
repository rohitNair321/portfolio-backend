const express = require('express');
const router = express.Router();
const { submitContactForm, getNotifications, markAsRead, deleteContactMessage }  = require('../controllers/contactController');
const { verifyToken, allowPublic, requireAdmin } = require('../middleware/authVerify');

router.post('/send', allowPublic, submitContactForm);
router.get('/notifications', verifyToken, requireAdmin, getNotifications);
router.put('/notifications/:id/read', verifyToken, requireAdmin, markAsRead);
router.delete('/delete/:id', verifyToken, requireAdmin, deleteContactMessage);

module.exports = router;