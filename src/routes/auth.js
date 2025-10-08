// routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const { validate, authSchemas } = require('../middleware/validation');
const { authRateLimit } = require('../middleware/rateLimit');

router.post('/register', 
  authRateLimit,
  validate(authSchemas.register),
  authController.register
);

router.post('/login',
  authRateLimit,
  validate(authSchemas.login),
  authController.login
);

router.post('/logout',
  authMiddleware,
  authController.logout
);

router.post('/refresh-token',
  authMiddleware,
  authController.refreshToken
);

router.get('/me',
  authMiddleware,
  authController.getMe
);

module.exports = router;