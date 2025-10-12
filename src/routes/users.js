// routes/users.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');
const { validate, userSchemas } = require('../middleware/validation');
const uploadService = require('../services/uploadService');
const { apiRateLimit } = require('../middleware/rateLimit');

router.get('/profile/:userId',
  apiRateLimit,
  userController.getProfile
);

router.put('/profile',
  authMiddleware,
  apiRateLimit,
  validate(userSchemas.updateProfile),
  userController.updateProfile
);

router.put('/search-status',
  authMiddleware,
  apiRateLimit,
  userController.updateSearchStatus
);

router.post('/avatar',
  authMiddleware,
  apiRateLimit,
  uploadService.getSingleUploadMiddleware(),
  uploadService.handleUploadError,
  userController.uploadAvatar
);

router.get('/search',
  authMiddleware,
  apiRateLimit,
  validate(userSchemas.search, 'query'),
  userController.searchUsers
);

router.post('/block/:userId',
  authMiddleware,
  apiRateLimit,
  userController.blockUser
);

router.post('/unblock/:userId',
  authMiddleware,
  apiRateLimit,
  userController.unblockUser
);

router.get('/blocked-list',
  authMiddleware,
  apiRateLimit,
  userController.getBlockedUsers
);

module.exports = router;