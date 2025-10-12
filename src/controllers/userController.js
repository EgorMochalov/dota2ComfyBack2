// controllers/userController.js
const { User, UserBlock, Team, sequelize } = require('../models');
const uploadService = require('../services/uploadService');
const onlineStatusService = require('../services/onlineStatusService');
const redisClient = require('../config/redis');
const { Op } = require('sequelize');
const cacheService = require('../services/cacheService');
class UserController {
  async getProfile(req, res, next) {
    try {
      const { userId } = req.params;
      const currentUserId = req.user?.id; // ID текущего пользователя (если авторизован)

      // Проверяем кэш
      const cachedUser = await redisClient.get(`user:${userId}`);
      if (cachedUser) {
        const userData = JSON.parse(cachedUser);
        
        // Добавляем поле is_blocked для авторизованных пользователей
        if (currentUserId) {
          const isBlocked = await UserBlock.findOne({
            where: {
              blocker_user_id: currentUserId,
              blocked_user_id: userId
            }
          });
          userData.is_blocked = !!isBlocked;
        } else {
          userData.is_blocked = false;
        }
        
        return res.json(userData);
      }

      const user = await User.findByPk(userId, {
        attributes: { exclude: ['password_hash', 'avatar_data'] },
        include: [
          {
            model: Team,
            as: 'team',
            attributes: ['id', 'name', 'avatar_url', 'region']
          }
        ]
      });

      if (!user) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      const userData = {
        id: user.id,
        email: user.email,
        username: user.username,
        region: user.region,
        avatar_url: user.avatar_url,
        game_modes: user.game_modes,
        mmr_rating: user.mmr_rating,
        preferred_roles: user.preferred_roles,
        about_me: user.about_me,
        tags: user.tags,
        is_searching: user.is_searching,
        team_id: user.team_id,
        last_online: user.last_online,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        team: user.team
      };

      // Добавляем поле is_blocked для авторизованных пользователей
      if (currentUserId) {
        const isBlocked = await UserBlock.findOne({
          where: {
            blocker_user_id: currentUserId,
            blocked_user_id: userId
          }
        });
        userData.is_blocked = !!isBlocked;
      } else {
        userData.is_blocked = false;
      }

      // Кэшируем на 5 минут (без поля is_blocked, так как оно зависит от текущего пользователя)
      const userDataForCache = { ...userData };
      delete userDataForCache.is_blocked;
      await redisClient.set(`user:${userId}`, JSON.stringify(userDataForCache), 300);

      res.json(userData);
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const userId = req.user.id;
      const updateData = req.body;

      // Запрещаем обновление некоторых полей
      delete updateData.email;
      delete updateData.password_hash;
      delete updateData.team_id;

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      // Обрабатываем массивы
      if (updateData.tags && typeof updateData.tags === 'string') {
        updateData.tags = updateData.tags.split(',').map(tag => tag.trim());
      }

      if (updateData.game_modes && typeof updateData.game_modes === 'string') {
        updateData.game_modes = updateData.game_modes.split(',').map(mode => mode.trim());
      }

      if (updateData.preferred_roles && typeof updateData.preferred_roles === 'string') {
        updateData.preferred_roles = updateData.preferred_roles.split(',').map(role => role.trim());
      }

      await user.update(updateData);

      await cacheService.invalidateUserCache(userId);

      res.json({
        message: 'Profile updated successfully',
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          region: user.region,
          avatar_url: user.avatar_url,
          game_modes: user.game_modes,
          mmr_rating: user.mmr_rating,
          preferred_roles: user.preferred_roles,
          about_me: user.about_me,
          tags: user.tags,
          is_searching: user.is_searching,
          team_id: user.team_id,
          last_online: user.last_online
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async updateSearchStatus(req, res, next) {
    try {
      const userId = req.user.id;
      const { is_searching } = req.body;

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      await user.update({ 
        is_searching,
        search_status_updated_at: new Date()
      });

      await cacheService.invalidateUserCache(userId);

      res.json({
        message: `Search status updated to ${is_searching ? 'active' : 'inactive'}`,
        is_searching: user.is_searching
      });
    } catch (error) {
      next(error);
    }
  }

  async uploadAvatar(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded'
        });
      }

      const avatarUrl = await uploadService.uploadUserAvatar(req.user.id, req.file);

      res.json({
        message: 'Avatar uploaded successfully',
        avatar_url: avatarUrl
      });
    } catch (error) {
      next(error);
    }
  }

  async searchUsers(req, res, next) {
    try {
      const {
        region,
        game_modes,
        tags,
        mmr_min,
        mmr_max,
        is_online,
        page = 1,
        limit = 20
      } = req.query;

      const currentUserId = req.user?.id;
      const offset = (page - 1) * limit;

      // Базовые условия
      const where = {
        is_searching: true
      };

      // Фильтры
      if (region) {
        where.region = region;
      }

      if (mmr_min) {
        where.mmr_rating = {
          ...where.mmr_rating,
          [Op.gte]: parseInt(mmr_min)
        };
      }

      if (mmr_max) {
        where.mmr_rating = {
          ...where.mmr_rating,
          [Op.lte]: parseInt(mmr_max)
        };
      }

      if (is_online === 'true') {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        where.last_online = {
          [Op.gte]: fiveMinutesAgo
        };
      }

      const options = {
        where,
        attributes: { exclude: ['password_hash'] },
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['last_online', 'DESC']]
      };

      // Фильтры по массивам
      if (game_modes) {
        const modesArray = Array.isArray(game_modes) ? game_modes : game_modes.split(',');
        options.where.game_modes = {
          [Op.overlap]: modesArray
        };
      }

      if (tags) {
        const tagsArray = Array.isArray(tags) ? tags : tags.split(',');
        options.where.tags = {
          [Op.contains]: tagsArray
        };
      }

      const { count, rows: users } = await User.findAndCountAll(options);

      // Добавляем онлайн статус из Redis
      const usersWithOnlineStatus = await Promise.all(
        users.map(async (user) => {
          const onlineStatus = await onlineStatusService.getUserStatus(user.id);
          
          const userData = {
            ...user.toJSON(),
            is_online: onlineStatus.isOnline
          };

          // Добавляем поле is_blocked для авторизованных пользователей
          if (currentUserId) {
            const isBlocked = await UserBlock.findOne({
              where: {
                blocker_user_id: currentUserId,
                blocked_user_id: user.id
              }
            });
            userData.is_blocked = !!isBlocked;
          } else {
            userData.is_blocked = false;
          }

          return userData;
        })
      );;

      res.json({
        users: usersWithOnlineStatus,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async blockUser(req, res, next) {
    try {
      const blockerId = req.user.id;
      const { userId: blockedUserId } = req.params;

      if (blockerId === blockedUserId) {
        return res.status(400).json({
          error: 'Cannot block yourself'
        });
      }

      const userToBlock = await User.findByPk(blockedUserId);
      if (!userToBlock) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      const existingBlock = await UserBlock.findOne({
        where: {
          blocker_user_id: blockerId,
          blocked_user_id: blockedUserId
        }
      });

      if (existingBlock) {
        return res.status(400).json({
          error: 'User already blocked'
        });
      }

      await UserBlock.create({
        blocker_user_id: blockerId,
        blocked_user_id: blockedUserId
      });

      res.json({
        message: 'User blocked successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async unblockUser(req, res, next) {
    try {
      const blockerId = req.user.id;
      const { userId: blockedUserId } = req.params;

      const block = await UserBlock.findOne({
        where: {
          blocker_user_id: blockerId,
          blocked_user_id: blockedUserId
        }
      });

      if (!block) {
        return res.status(404).json({
          error: 'User is not blocked'
        });
      }

      await block.destroy();

      res.json({
        message: 'User unblocked successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async getBlockedUsers(req, res, next) {
    try {
      const userId = req.user.id;

      const blockedUsers = await UserBlock.findAll({
        where: { blocker_user_id: userId },
        include: [
          {
            model: User,
            as: 'blocked_user',
            attributes: ['id', 'username', 'avatar_url', 'region']
          }
        ]
      });

      res.json({
        blocked_users: blockedUsers.map(block => block.blocked_user)
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();