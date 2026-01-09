const express = require('express');
const router = express.Router();
const { submitContactForm, getNotifications, markAsRead, deleteContactMessage }  = require('../controllers/contactController');
const { verifyToken } = require('../middleware/authVerify');

router.post('/send', submitContactForm);
router.get('/notifications', verifyToken, getNotifications);
router.put('/notifications/:id/read', verifyToken, markAsRead);
router.delete('/delete/:id', verifyToken, deleteContactMessage);

module.exports = router;