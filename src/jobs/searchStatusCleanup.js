// jobs/searchStatusCleanup.js
const cron = require('node-cron');
const { User, Team } = require('../models');
const config = require('../config/config');

class SearchStatusCleanup {
  start() {
    // Запускаем каждые 6 часов
    cron.schedule('0 */6 * * *', async () => {
      try {
        console.log('Starting search status cleanup job...');
        const now = new Date();

        // Снимаем статус поиска у пользователей (старше 2 дней)
        const inactiveUsers = await User.update(
          { is_searching: false },
          {
            where: {
              is_searching: true,
              search_status_updated_at: {
                [Op.lt]: new Date(now - config.timeouts.playerSearch)
              }
            }
          }
        );

        // Снимаем статус поиска у команд (старше 2 дней)
        const inactiveTeams = await Team.update(
          { is_searching: false },
          {
            where: {
              is_searching: true,
              search_status_updated_at: {
                [Op.lt]: new Date(now - config.timeouts.teamSearch)
              }
            }
          }
        );

        // Снимаем статус поиска кв (старше 1 дня)
        const inactiveScrims = await Team.update(
          { looking_for_scrim: false },
          {
            where: {
              looking_for_scrim: true,
              search_status_updated_at: {
                [Op.lt]: new Date(now - config.timeouts.scrimSearch)
              }
            }
          }
        );

        console.log(`Search status cleanup completed: 
          ${inactiveUsers[0]} users, 
          ${inactiveTeams[0]} teams, 
          ${inactiveScrims[0]} scrims deactivated`);
      } catch (error) {
        console.error('Error in search status cleanup job:', error);
      }
    });
  }
}

module.exports = new SearchStatusCleanup();