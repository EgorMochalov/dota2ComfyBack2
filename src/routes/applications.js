// routes/applications.js
const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/applicationController');
const authMiddleware = require('../middleware/auth');
const { apiRateLimit } = require('../middleware/rateLimit');

router.post('/team/:teamId',
  authMiddleware,
  apiRateLimit,
  applicationController.applyToTeam
);

router.get('/team/:teamId',
  authMiddleware,
  apiRateLimit,
  applicationController.getTeamApplications
);

router.put('/:applicationId',
  authMiddleware,
  apiRateLimit,
  applicationController.updateApplication
);

router.get('/my',
  authMiddleware,
  apiRateLimit,
  applicationController.getMyApplications
);

router.delete('/:applicationId',
  authMiddleware,
  apiRateLimit,
  applicationController.cancelApplication
);

module.exports = router;