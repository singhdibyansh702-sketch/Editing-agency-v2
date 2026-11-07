const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// List active conversations
router.get('/conversations', chatController.getConversations);

// Unread messages summary
router.get('/unread', chatController.getUnreadSummary);

// Get message thread with recipient (strictly verified)
router.get('/messages/:otherUserId', chatController.getMessages);

// Send message (strictly verified)
router.post('/send', chatController.sendMessage);

module.exports = router;

