// services/cacheService.js - НОВЫЙ ФАЙЛ
const redisClient = require('../config/redis');

class CacheService {
  // Инвалидация кэша команды
  async invalidateTeamCache(teamId) {
    try {
      await redisClient.del(`team:${teamId}`);
      console.log(`Cache invalidated for team: ${teamId}`);
    } catch (error) {
      console.error('Error invalidating team cache:', error);
    }
  }

  // Инвалидация кэша пользователя
  async invalidateUserCache(userId) {
    try {
      await redisClient.del(`user:${userId}`);
      console.log(`Cache invalidated for user: ${userId}`);
    } catch (error) {
      console.error('Error invalidating user cache:', error);
    }
  }

  // Инвалидация кэша нескольких пользователей
  async invalidateUsersCache(userIds) {
    try {
      const promises = userIds.map(userId => 
        redisClient.del(`user:${userId}`)
      );
      await Promise.all(promises);
      console.log(`Cache invalidated for users: ${userIds.join(', ')}`);
    } catch (error) {
      console.error('Error invalidating users cache:', error);
    }
  }

  // Инвалидация кэша при изменении состава команды
  async invalidateTeamMembersCache(teamId, memberIds = []) {
    try {
      // Удаляем кэш команды
      await this.invalidateTeamCache(teamId);
      
      // Удаляем кэш всех участников команды
      if (memberIds.length > 0) {
        await this.invalidateUsersCache(memberIds);
      }
      
      console.log(`Team members cache invalidated for team: ${teamId}`);
    } catch (error) {
      console.error('Error invalidating team members cache:', error);
    }
  }
}

module.exports = new CacheService();