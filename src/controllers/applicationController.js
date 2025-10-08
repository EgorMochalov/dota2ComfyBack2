// controllers/applicationController.js
const { TeamApplication, Team, User, Notification, ChatRoom, ChatRoomMember, sequelize } = require('../models');
const redisClient = require('../config/redis');

class ApplicationController {
  async applyToTeam(req, res, next) {
    try {
      const { teamId } = req.params;
      const userId = req.user.id;
      const { message } = req.body;

      const team = await Team.findByPk(teamId);
      if (!team) {
        return res.status(404).json({
          error: 'Team not found'
        });
      }

      // Проверяем, что пользователь не состоит в команде
      const user = await User.findByPk(userId);
      if (user.team_id) {
        return res.status(400).json({
          error: 'You are already in a team'
        });
      }

      // Проверяем, не подал ли уже заявку
      const existingApplication = await TeamApplication.findOne({
        where: {
          team_id: teamId,
          user_id: userId,
          status: 'pending'
        }
      });

      if (existingApplication) {
        return res.status(400).json({
          error: 'You have already applied to this team'
        });
      }

      // Создаем заявку
      const application = await TeamApplication.create({
        team_id: teamId,
        user_id: userId,
        message: message || null
      });

      // Создаем уведомление для капитана
      await Notification.create({
        user_id: team.captain_id,
        type: 'application',
        title: 'New Team Application',
        message: `${user.username} has applied to join your team ${team.name}`,
        related_entity_type: 'application',
        related_entity_id: application.id
      });

      // Отправляем уведомление через WebSocket
      req.app.get('io').to(`user:${team.captain_id}`).emit('notification', {
        type: 'application',
        title: 'New Team Application',
        message: `${user.username} has applied to join your team`
      });

      res.status(201).json({
        message: 'Application submitted successfully',
        application: {
          id: application.id,
          status: application.status,
          message: application.message,
          createdAt: application.createdAt
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async cancelApplication(req, res, next) {
    try {
      const { applicationId } = req.params;
      const userId = req.user.id;

      const application = await TeamApplication.findByPk(applicationId, {
        include: [
          {
            model: Team,
            include: ['captain']
          }
        ]
      });

      if (!application) {
        return res.status(404).json({
          error: 'Application not found'
        });
      }

      // Проверяем, что пользователь отменяет свою заявку
      if (application.user_id !== userId) {
        return res.status(403).json({
          error: 'You can only cancel your own applications'
        });
      }

      // Проверяем, что заявка еще не обработана
      if (application.status !== 'pending') {
        return res.status(400).json({
          error: 'Cannot cancel already processed application'
        });
      }

      await application.destroy();

      // Создаем уведомление для капитана команды
      await Notification.create({
        user_id: application.Team.captain_id,
        type: 'application',
        title: 'Application Cancelled',
        message: `${req.user.username} has cancelled their application to join your team ${application.Team.name}`,
        related_entity_type: 'application',
        related_entity_id: applicationId
      });

      // Отправляем WebSocket уведомление капитану
      req.app.get('io').to(`user:${application.Team.captain_id}`).emit('notification', {
        type: 'application',
        title: 'Application Cancelled',
        message: `${req.user.username} has cancelled their application`
      });

      res.json({
        message: 'Application cancelled successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async getTeamApplications(req, res, next) {
    try {
      const { teamId } = req.params;
      const userId = req.user.id;

      const team = await Team.findByPk(teamId);
      if (!team) {
        return res.status(404).json({
          error: 'Team not found'
        });
      }

      if (team.captain_id !== userId) {
        return res.status(403).json({
          error: 'Only team captain can view applications'
        });
      }

      const applications = await TeamApplication.findAll({
        where: {
          team_id: teamId,
          status: 'pending'
        },
        include: [
          {
            model: User,
            attributes: ['id', 'username', 'avatar_url', 'region', 'mmr_rating', 'preferred_roles', 'about_me', 'tags']
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      res.json({
        applications
      });
    } catch (error) {
      next(error);
    }
  }

  async updateApplication(req, res, next) {
    const transaction = await sequelize.transaction();
    try {
      const { applicationId } = req.params;
      const { status } = req.body;
      const userId = req.user.id;

      if (!['accepted', 'rejected'].includes(status)) {
        await transaction.rollback();
        return res.status(400).json({
          error: 'Invalid status. Must be "accepted" or "rejected"'
        });
      }

      const application = await TeamApplication.findByPk(applicationId, {
        include: [
          {
            model: Team,
            include: ['captain']
          },
          {
            model: User
          }
        ],
        transaction
      });

      if (!application) {
        await transaction.rollback();
        return res.status(404).json({
          error: 'Application not found'
        });
      }

      // Проверяем, что пользователь - капитан команды
      if (application.Team.captain_id !== userId) {
        await transaction.rollback();
        return res.status(403).json({
          error: 'Only team captain can update applications'
        });
      }

      if (application.status !== 'pending') {
        await transaction.rollback();
        return res.status(400).json({
          error: 'Application has already been processed'
        });
      }

      application.status = status;
      await application.save({ transaction });

      if (status === 'accepted') {
        // Проверяем, что пользователь все еще не в команде
        if (application.User.team_id) {
          await transaction.rollback();
          return res.status(400).json({
            error: 'User has already joined another team'
          });
        }

        // Добавляем пользователя в команду
        await application.User.update({ team_id: application.Team.id }, { transaction });

        // Добавляем пользователя в командный чат
        const teamChat = await ChatRoom.findOne({
          where: { team_id: application.Team.id, type: 'team' },
          transaction
        });

        if (teamChat) {
          await ChatRoomMember.create({
            room_id: teamChat.id,
            user_id: application.User.id
          }, { transaction });
        }
      }

      // Создаем уведомление для applicant
      await Notification.create({
        user_id: application.user_id,
        type: 'application',
        title: `Application ${status}`,
        message: `Your application to team ${application.Team.name} has been ${status}`,
        related_entity_type: 'application',
        related_entity_id: application.id
      }, { transaction });

      // Отправляем WebSocket уведомление
      req.app.get('io').to(`user:${application.user_id}`).emit('notification', {
        type: 'application',
        title: `Application ${status}`,
        message: `Your application to team ${application.Team.name} has been ${status}`
      });

      await transaction.commit();

      // Инвалидируем кэш
      await redisClient.del(`user:${application.user_id}`);

      res.json({
        message: `Application ${status} successfully`,
        application: {
          id: application.id,
          status: application.status
        }
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  async getMyApplications(req, res, next) {
    try {
      const userId = req.user.id;

      const applications = await TeamApplication.findAll({
        where: { user_id: userId },
        include: [
          {
            model: Team,
            include: [
              {
                model: User,
                as: 'captain',
                attributes: ['id', 'username', 'avatar_url']
              }
            ]
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      res.json({
        applications
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ApplicationController();