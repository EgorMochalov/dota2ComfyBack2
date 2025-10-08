// routes/invitations.js
const express = require('express');
const router = express.Router();
const invitationController = require('../controllers/invitationController');
const authMiddleware = require('../middleware/auth');
const { apiRateLimit } = require('../middleware/rateLimit');

router.post('/user/:userId',
  authMiddleware,
  apiRateLimit,
  invitationController.inviteUser
);

router.get('/my',
  authMiddleware,
  apiRateLimit,
  invitationController.getMyInvitations
);

router.put('/:invitationId',
  authMiddleware,
  apiRateLimit,
  invitationController.updateInvitation
);

module.exports = router;