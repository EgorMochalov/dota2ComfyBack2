// routes/index.js
const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const userRoutes = require('./users');
const teamRoutes = require('./teams');
const applicationRoutes = require('./applications');
const invitationRoutes = require('./invitations');
const chatRoutes = require('./chat');
const notificationRoutes = require('./notifications');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/teams', teamRoutes);
router.use('/applications', applicationRoutes);
router.use('/invitations', invitationRoutes);
router.use('/chat', chatRoutes);
router.use('/notifications', notificationRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router;