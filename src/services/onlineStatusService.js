// services/onlineStatusService.js
const redisClient = require('../config/redis');
const config = require('../config/config');

class OnlineStatusService {
  constructor() {
    this.onlineKey = 'online_users';
    this.userStatusPrefix = 'user_status:';
  }

  // Отметить пользователя онлайн
  async setUserOnline(userId, userData = {}) {
    const statusData = {
      userId,
      isOnline: true,
      lastSeen: new Date().toISOString(),
      ...userData
    };

    // Сохраняем детальную информацию о статусе
    await redisClient.set(
      `${this.userStatusPrefix}${userId}`,
      JSON.stringify(statusData),
      config.timeouts.onlineStatus / 1000
    );

    // Добавляем в множество онлайн пользователей
    await redisClient.sadd(this.onlineKey, userId.toString());
  }

  // Отметить пользователя оффлайн
  async setUserOffline(userId) {
    await redisClient.srem(this.onlineKey, userId.toString());
    await redisClient.del(`${this.userStatusPrefix}${userId}`);
  }

  // Получить статус пользователя
  async getUserStatus(userId) {
    const statusData = await redisClient.get(`${this.userStatusPrefix}${userId}`);
    
    if (!statusData) {
      return {
        isOnline: false,
        lastSeen: null
      };
    }

    const parsedData = JSON.parse(statusData);
    return {
      isOnline: parsedData.isOnline,
      lastSeen: parsedData.lastSeen,
      ...parsedData
    };
  }

  // Получить список онлайн пользователей
  async getOnlineUsers() {
    const userIds = await redisClient.smembers(this.onlineKey);
    
    const onlineUsers = [];
    for (const userId of userIds) {
      const status = await this.getUserStatus(userId);
      if (status.isOnline) {
        onlineUsers.push({
          userId,
          ...status
        });
      }
    }

    return onlineUsers;
  }

  // Проверить является ли пользователь онлайн
  async isUserOnline(userId) {
    const status = await this.getUserStatus(userId);
    return status.isOnline;
  }

  // Обновить время последней активности
  async updateUserActivity(userId, userData = {}) {
    const existingStatus = await this.getUserStatus(userId);
    
    if (existingStatus.isOnline) {
      await this.setUserOnline(userId, {
        ...existingStatus,
        ...userData,
        lastSeen: new Date().toISOString()
      });
    }
  }

  // Очистить устаревшие онлайн статусы
  async cleanupStaleStatuses() {
    // Redis автоматически удалит ключи с истекшим TTL
    // Дополнительная логика очистки если нужна
  }
}

module.exports = new OnlineStatusService();