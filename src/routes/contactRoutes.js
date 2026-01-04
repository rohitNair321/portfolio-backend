const express = require('express');
const router = express.Router();
const { submitContactForm, getNotifications, markAsRead }  = require('../controllers/contactController');

router.post('/send', submitContactForm);
router.get('/notifications', getNotifications);
router.put('/notifications/:id/read', markAsRead);

module.exports = router;