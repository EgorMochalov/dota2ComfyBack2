// jobs/onlineStatusCleanup.js
const cron = require('node-cron');
const onlineStatusService = require('../services/onlineStatusService');

class OnlineStatusCleanup {
  start() {
    // Запускаем каждые 10 минут
    cron.schedule('*/10 * * * *', async () => {
      try {
        console.log('Starting online status cleanup job...');
        await onlineStatusService.cleanupStaleStatuses();
        console.log('Online status cleanup completed');
      } catch (error) {
        console.error('Error in online status cleanup job:', error);
      }
    });
  }
}

module.exports = new OnlineStatusCleanup();