// routes/teams.js
const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const authMiddleware = require('../middleware/auth');
const { validate, teamSchemas } = require('../middleware/validation');
const uploadService = require('../services/uploadService');
const { apiRateLimit } = require('../middleware/rateLimit');

router.post('/',
  authMiddleware,
  apiRateLimit,
  validate(teamSchemas.create),
  teamController.createTeam
);

router.get('/search',
  apiRateLimit,
  teamController.searchTeams
);

router.get('/my-teams',
  authMiddleware,
  apiRateLimit,
  teamController.getMyTeams
);

router.get('/scrims',
  apiRateLimit,
  teamController.searchScrims
);

router.get('/:teamId',
  apiRateLimit,
  teamController.getTeam
);

router.put('/:teamId',
  authMiddleware,
  apiRateLimit,
  validate(teamSchemas.update),
  teamController.updateTeam
);

router.delete('/:teamId',
  authMiddleware,
  apiRateLimit,
  teamController.deleteTeam
);

router.put('/:teamId/search-status',
  authMiddleware,
  apiRateLimit,
  teamController.updateSearchStatus
);

router.put('/:teamId/scrim-status',
  authMiddleware,
  apiRateLimit,
  teamController.updateScrimStatus
);

router.post('/:teamId/avatar',
  authMiddleware,
  apiRateLimit,
  uploadService.getSingleUploadMiddleware(),
  uploadService.handleUploadError,
  teamController.uploadTeamAvatar
);

router.post('/:teamId/leave',
  authMiddleware,
  apiRateLimit,
  teamController.leaveTeam
);

router.delete('/:teamId/members/:userId',
  authMiddleware,
  apiRateLimit,
  teamController.kickMember
);

router.put('/:teamId/transfer-captain',
  authMiddleware,
  apiRateLimit,
  teamController.transferCaptaincy
);

module.exports = router;