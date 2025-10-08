// routes/notifications.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/auth');
const { apiRateLimit } = require('../middleware/rateLimit');

router.get('/',
  authMiddleware,
  apiRateLimit,
  notificationController.getNotifications
);

router.put('/:notificationId/read',
  authMiddleware,
  apiRateLimit,
  notificationController.markAsRead
);

router.put('/read-all',
  authMiddleware,
  apiRateLimit,
  notificationController.markAllAsRead
);

router.get('/unread-count',
  authMiddleware,
  apiRateLimit,
  notificationController.getUnreadCount
);

module.exports = router;