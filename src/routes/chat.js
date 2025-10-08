// routes/chat.js
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/auth');
const { apiRateLimit } = require('../middleware/rateLimit');

router.get('/rooms',
  authMiddleware,
  apiRateLimit,
  chatController.getMyChats
);

router.get('/rooms/:roomId/unread-info',
  authMiddleware,
  apiRateLimit,
  chatController.getUnreadInfo
);

router.post('/rooms/private/:otherUserId',
  authMiddleware,
  apiRateLimit,
  chatController.getOrCreatePrivateChat
);

router.get('/rooms/:roomId/messages',
  authMiddleware,
  apiRateLimit,
  chatController.getChatMessages
);

router.post('/rooms/:roomId/messages',
  authMiddleware,
  apiRateLimit,
  chatController.sendMessage
);

// Новый эндпоинт для отметки чата как прочитанного
router.put('/rooms/:roomId/read',
  authMiddleware,
  apiRateLimit,
  chatController.markChatAsRead
);

router.delete('/rooms/:roomId',
  authMiddleware,
  apiRateLimit,
  chatController.deleteChat
);

module.exports = router;