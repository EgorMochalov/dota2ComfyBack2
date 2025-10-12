// controllers/teamController.js
const { Team, User, TeamApplication, Invitation, ChatRoom, ChatRoomMember, sequelize } = require('../models');
const { Op } = require('sequelize');
const onlineStatusService = require('../services/onlineStatusService');
const uploadService = require('../services/uploadService');
const redisClient = require('../config/redis');
const cacheService = require('../services/cacheService');

class TeamController {
  async createTeam(req, res, next) {
    const transaction = await sequelize.transaction();
    try {
      const captainId = req.user.id;
      const teamData = req.body;

      // Проверяем, что пользователь не состоит в команде
      const user = await User.findByPk(captainId);
      if (user.team_id) {
        await transaction.rollback();
        return res.status(400).json({
          error: 'You are already in a team'
        });
      }

      // Создаем команду
      const team = await Team.create({
        ...teamData,
        captain_id: captainId
      }, { transaction });

      // Назначаем пользователя капитаном
      await user.update({ team_id: team.id }, { transaction });

      // Создаем командный чат
      const chatRoom = await ChatRoom.create({
        type: 'team',
        name: `Team ${team.name}`,
        team_id: team.id
      }, { transaction });

      // Добавляем капитана в чат
      await ChatRoomMember.create({
        room_id: chatRoom.id,
        user_id: captainId
      }, { transaction });

      await transaction.commit();

      await cacheService.invalidateUserCache(captainId);

      res.status(201).json({
        message: 'Team created successfully',
        team: {
          id: team.id,
          name: team.name,
          description: team.description,
          avatar_url: team.avatar_url,
          captain_id: team.captain_id,
          region: team.region,
          game_modes: team.game_modes,
          mmr_range_min: team.mmr_range_min,
          mmr_range_max: team.mmr_range_max,
          required_roles: team.required_roles,
          tags: team.tags,
          is_searching: team.is_searching,
          looking_for_scrim: team.looking_for_scrim,
          createdAt: team.createdAt
        }
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  async getTeam(req, res, next) {
    try {
      const { teamId } = req.params;
      const currentUserId = req.user?.id; // Текущий пользователь (если авторизован)

      const cachedTeam = await redisClient.get(`team:${teamId}`);
      if (cachedTeam) {
        const teamData = JSON.parse(cachedTeam);
        
        // Добавляем информацию о блокировках для участников
        if (currentUserId && teamData.members) {
          const membersWithBlockStatus = await Promise.all(
            teamData.members.map(async (member) => {
              const isBlocked = await UserBlock.findOne({
                where: {
                  blocker_user_id: currentUserId,
                  blocked_user_id: member.id
                }
              });
              return {
                ...member,
                is_blocked: !!isBlocked
              };
            })
          );
          teamData.members = membersWithBlockStatus;
        }
        
        return res.json(teamData);
      }

      const team = await Team.findByPk(teamId, {
        include: [
          {
            model: User,
            as: 'captain',
            attributes: ['id', 'username', 'avatar_url', 'region']
          },
          {
            model: User,
            as: 'members',
            attributes: ['id', 'username', 'avatar_url', 'region', 'mmr_rating', 'preferred_roles', 'last_online']
          }
        ]
      });

      if (!team) {
        return res.status(404).json({
          error: 'Team not found'
        });
      }

      // Добавляем онлайн статусы для участников
      const membersWithStatus = await Promise.all(
        team.members.map(async (member) => {
          const onlineStatus = await onlineStatusService.getUserStatus(member.id);
          
          const memberData = {
            ...member.toJSON(),
            is_online: onlineStatus.isOnline
          };

          // Добавляем информацию о блокировке для авторизованных пользователей
          if (currentUserId) {
            const isBlocked = await UserBlock.findOne({
              where: {
                blocker_user_id: currentUserId,
                blocked_user_id: member.id
              }
            });
            memberData.is_blocked = !!isBlocked;
          } else {
            memberData.is_blocked = false;
          }

          return memberData;
        })
      );

      const teamData = {
        id: team.id,
        name: team.name,
        description: team.description,
        avatar_url: team.avatar_url,
        captain: team.captain,
        members: membersWithStatus,
        region: team.region,
        game_modes: team.game_modes,
        mmr_range_min: team.mmr_range_min,
        mmr_range_max: team.mmr_range_max,
        required_roles: team.required_roles,
        tags: team.tags,
        is_searching: team.is_searching,
        looking_for_scrim: team.looking_for_scrim,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt
      };

      // Кэшируем без информации о блокировках (так как она зависит от пользователя)
      const teamDataForCache = { ...teamData };
      teamDataForCache.members = teamDataForCache.members.map(member => {
        const { is_blocked, ...memberWithoutBlock } = member;
        return memberWithoutBlock;
      });
      await redisClient.set(`team:${teamId}`, JSON.stringify(teamDataForCache), 300);

      res.json(teamData);
    } catch (error) {
      next(error);
    }
  }

  async updateTeam(req, res, next) {
    try {
      const { teamId } = req.params;
      const userId = req.user.id;
      const updateData = req.body;

      const team = await Team.findByPk(teamId);
      if (!team) {
        return res.status(404).json({
          error: 'Team not found'
        });
      }

      // Проверяем права капитана
      if (team.captain_id !== userId) {
        return res.status(403).json({
          error: 'Only team captain can update team'
        });
      }

      // Обрабатываем массивы
      if (updateData.tags && typeof updateData.tags === 'string') {
        updateData.tags = updateData.tags.split(',').map(tag => tag.trim());
      }

      if (updateData.game_modes && typeof updateData.game_modes === 'string') {
        updateData.game_modes = updateData.game_modes.split(',').map(mode => mode.trim());
      }

      if (updateData.required_roles && typeof updateData.required_roles === 'string') {
        updateData.required_roles = updateData.required_roles.split(',').map(role => role.trim());
      }

      await team.update(updateData);
      await cacheService.invalidateTeamCache(teamId);

      res.json({
        message: 'Team updated successfully',
        team: {
          id: team.id,
          name: team.name,
          description: team.description,
          avatar_url: team.avatar_url,
          captain_id: team.captain_id,
          region: team.region,
          game_modes: team.game_modes,
          mmr_range_min: team.mmr_range_min,
          mmr_range_max: team.mmr_range_max,
          required_roles: team.required_roles,
          tags: team.tags,
          is_searching: team.is_searching,
          looking_for_scrim: team.looking_for_scrim
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteTeam(req, res, next) {
    const transaction = await sequelize.transaction();
    try {
      const { teamId } = req.params;
      const userId = req.user.id;

      const team = await Team.findByPk(teamId);
      if (!team) {
        await transaction.rollback();
        return res.status(404).json({
          error: 'Team not found'
        });
      }

      if (team.captain_id !== userId) {
        await transaction.rollback();
        return res.status(403).json({
          error: 'Only team captain can delete team'
        });
      }

      // Освобождаем участников
      await User.update(
        { team_id: null },
        { where: { team_id: teamId }, transaction }
      );

      // Находим и удаляем командный чат
      const teamChat = await ChatRoom.findOne({ 
        where: { team_id: teamId, type: 'team' } 
      });

      if (teamChat) {
        await ChatRoomMember.destroy({ 
          where: { room_id: teamChat.id }, 
          transaction 
        });
        await teamChat.destroy({ transaction });
      }

      // Удаляем заявки и приглашения
      await TeamApplication.destroy({ where: { team_id: teamId }, transaction });
      await Invitation.destroy({ where: { team_id: teamId }, transaction });

      await team.destroy({ transaction });
      await transaction.commit();

      await redisClient.del(`team:${teamId}`);

      res.json({
        message: 'Team deleted successfully'
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  async updateSearchStatus(req, res, next) {
    try {
      const { teamId } = req.params;
      const userId = req.user.id;
      const { is_searching } = req.body;

      const team = await Team.findByPk(teamId);
      if (!team) {
        return res.status(404).json({
          error: 'Team not found'
        });
      }

      if (team.captain_id !== userId) {
        return res.status(403).json({
          error: 'Only team captain can update search status'
        });
      }

      await team.update({ 
        is_searching,
        search_status_updated_at: new Date()
      });

      await redisClient.del(`team:${teamId}`);

      res.json({
        message: `Search status updated to ${is_searching ? 'active' : 'inactive'}`,
        is_searching: team.is_searching
      });
    } catch (error) {
      next(error);
    }
  }

  async updateScrimStatus(req, res, next) {
    try {
      const { teamId } = req.params;
      const userId = req.user.id;
      const { looking_for_scrim } = req.body;

      const team = await Team.findByPk(teamId);
      if (!team) {
        return res.status(404).json({
          error: 'Team not found'
        });
      }

      if (team.captain_id !== userId) {
        return res.status(403).json({
          error: 'Only team captain can update scrim status'
        });
      }

      await team.update({ 
        looking_for_scrim,
        search_status_updated_at: new Date()
      });

      await redisClient.del(`team:${teamId}`);

      res.json({
        message: `Scrim search status updated to ${looking_for_scrim ? 'active' : 'inactive'}`,
        looking_for_scrim: team.looking_for_scrim
      });
    } catch (error) {
      next(error);
    }
  }

  async uploadTeamAvatar(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded'
        });
      }

      const { teamId } = req.params;
      const captainId = req.user.id;

      const avatarUrl = await uploadService.uploadTeamAvatar(teamId, req.file, captainId);

      await redisClient.del(`team:${teamId}`);

      res.json({
        message: 'Team avatar uploaded successfully',
        avatar_url: avatarUrl
      });
    } catch (error) {
      next(error);
    }
  }

  async leaveTeam(req, res, next) {
    const transaction = await sequelize.transaction();
    try {
      const { teamId } = req.params;
      const userId = req.user.id;

      const team = await Team.findByPk(teamId);
      if (!team) {
        await transaction.rollback();
        return res.status(404).json({
          error: 'Team not found'
        });
      }

      const user = await User.findByPk(userId);
      if (user.team_id !== teamId) {
        await transaction.rollback();
        return res.status(400).json({
          error: 'You are not a member of this team'
        });
      }

      // Капитан не может покинуть команду
      if (team.captain_id === userId) {
        await transaction.rollback();
        return res.status(400).json({
          error: 'Team captain cannot leave the team. Transfer captaincy or delete the team.'
        });
      }

      // Убираем из команды
      await user.update({ team_id: null }, { transaction });

      // Убираем из командного чата
      const teamChat = await ChatRoom.findOne({ 
        where: { team_id: teamId, type: 'team' } 
      });

      if (teamChat) {
        await ChatRoomMember.destroy({
          where: {
            room_id: teamChat.id,
            user_id: userId
          },
          transaction
        });
      }

      await transaction.commit();

      await cacheService.invalidateTeamMembersCache(teamId, [userId]);

      res.json({
        message: 'You have left the team'
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  async kickMember(req, res, next) {
    const transaction = await sequelize.transaction();
    try {
      const { teamId, userId: memberId } = req.params;
      const captainId = req.user.id;

      const team = await Team.findByPk(teamId);
      if (!team) {
        await transaction.rollback();
        return res.status(404).json({
          error: 'Team not found'
        });
      }

      if (team.captain_id !== captainId) {
        await transaction.rollback();
        return res.status(403).json({
          error: 'Only team captain can kick members'
        });
      }

      if (captainId === memberId) {
        await transaction.rollback();
        return res.status(400).json({
          error: 'Cannot kick yourself'
        });
      }

      const member = await User.findByPk(memberId);
      if (!member || member.team_id !== teamId) {
        await transaction.rollback();
        return res.status(400).json({
          error: 'User is not a member of this team'
        });
      }

      // Кикаем пользователя
      await member.update({ team_id: null }, { transaction });

      // Убираем из чата
      const teamChat = await ChatRoom.findOne({ 
        where: { team_id: teamId, type: 'team' } 
      });

      if (teamChat) {
        await ChatRoomMember.destroy({
          where: {
            room_id: teamChat.id,
            user_id: memberId
          },
          transaction
        });
      }

      await transaction.commit();

      await cacheService.invalidateTeamMembersCache(teamId, [memberId]);

      res.json({
        message: 'Member kicked from the team'
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  async transferCaptaincy(req, res, next) {
    const transaction = await sequelize.transaction();
    try {
      const { teamId } = req.params;
      const { newCaptainId } = req.body;
      const currentCaptainId = req.user.id;

      const team = await Team.findByPk(teamId);
      if (!team) {
        await transaction.rollback();
        return res.status(404).json({
          error: 'Team not found'
        });
      }

      if (team.captain_id !== currentCaptainId) {
        await transaction.rollback();
        return res.status(403).json({
          error: 'Only team captain can transfer captaincy'
        });
      }

      const newCaptain = await User.findByPk(newCaptainId);
      if (!newCaptain || newCaptain.team_id !== teamId) {
        await transaction.rollback();
        return res.status(400).json({
          error: 'New captain must be a member of the team'
        });
      }

      await team.update({ captain_id: newCaptainId }, { transaction });
      await transaction.commit();

      await cacheService.invalidateTeamMembersCache(teamId, [currentCaptainId, newCaptainId]);

      res.json({
        message: 'Captaincy transferred successfully'
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  async getMyTeams(req, res, next) {
    try {
      const userId = req.user.id;

      const teams = await Team.findAll({
        where: { captain_id: userId },
        include: [
          {
            model: User,
            as: 'members',
            attributes: ['id', 'username', 'avatar_url', 'region', 'mmr_rating', 'preferred_roles']
          }
        ]
      });

      res.json({
        teams
      });
    } catch (error) {
      next(error);
    }
  }

  async searchTeams(req, res, next) {
    try {
      const {
        region,
        game_modes,
        tags,
        mmr_min,
        mmr_max,
        required_roles,
        page = 1,
        limit = 20
      } = req.query;

      const offset = (page - 1) * limit;
      const where = {
        is_searching: true
      };

      if (region) {
        where.region = region;
      }

      if (mmr_min) {
        where.mmr_range_min = {
          [Op.gte]: parseInt(mmr_min)
        };
      }

      if (mmr_max) {
        where.mmr_range_max = {
          [Op.lte]: parseInt(mmr_max)
        };
      }

      const options = {
        where,
        limit: parseInt(limit),
        offset: parseInt(offset),
        include: [
          {
            model: User,
            as: 'captain',
            attributes: ['id', 'username', 'avatar_url', 'region']
          },
          {
            model: User,
            as: 'members',
            attributes: ['id', 'username', 'avatar_url', 'region']
          }
        ],
        order: [['search_status_updated_at', 'DESC']]
      };

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

      if (required_roles) {
        const rolesArray = Array.isArray(required_roles) ? required_roles : required_roles.split(',');
        options.where.required_roles = {
          [Op.overlap]: rolesArray
        };
      }

      const { count, rows: teams } = await Team.findAndCountAll(options);

      res.json({
        teams,
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

  async searchScrims(req, res, next) {
    try {
      const {
        region,
        game_modes,
        mmr_min,
        mmr_max,
        page = 1,
        limit = 20
      } = req.query;

      const offset = (page - 1) * limit;
      const where = {
        is_searching: true,
        looking_for_scrim: true
      };

      if (region) {
        where.region = region;
      }

      if (mmr_min) {
        where.mmr_range_min = {
          [Op.gte]: parseInt(mmr_min)
        };
      }

      if (mmr_max) {
        where.mmr_range_max = {
          [Op.lte]: parseInt(mmr_max)
        };
      }

      const options = {
        where,
        limit: parseInt(limit),
        offset: parseInt(offset),
        include: [
          {
            model: User,
            as: 'captain',
            attributes: ['id', 'username', 'avatar_url', 'region']
          },
          {
            model: User,
            as: 'members',
            attributes: ['id', 'username', 'avatar_url', 'region']
          }
        ],
        order: [['search_status_updated_at', 'DESC']]
      };

      if (game_modes) {
        const modesArray = Array.isArray(game_modes) ? game_modes : game_modes.split(',');
        options.where.game_modes = {
          [Op.overlap]: modesArray
        };
      }

      const { count, rows: teams } = await Team.findAndCountAll(options);

      res.json({
        teams,
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
}

module.exports = new TeamController();