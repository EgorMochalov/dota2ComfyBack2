// controllers/invitationController.js
const { Invitation, Team, User, Notification, ChatRoom, ChatRoomMember, sequelize } = require('../models');
const cacheService = require('../services/cacheService');

class InvitationController {
  async inviteUser(req, res, next) {
    try {
      const { userId: invitedUserId } = req.params;
      const inviterId = req.user.id;
      const { teamId, message } = req.body;

      const team = await Team.findByPk(teamId);
      if (!team) {
        return res.status(404).json({
          error: 'Team not found'
        });
      }

      // Проверяем, что приглашающий - капитан команды
      if (team.captain_id !== inviterId) {
        return res.status(403).json({
          error: 'Only team captain can invite users'
        });
      }

      const invitedUser = await User.findByPk(invitedUserId);
      if (!invitedUser) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      // Проверяем, что пользователь не состоит в команде
      if (invitedUser.team_id) {
        return res.status(400).json({
          error: 'User is already in a team'
        });
      }

      // Проверяем, не было ли уже приглашения
      const existingInvitation = await Invitation.findOne({
        where: {
          team_id: teamId,
          invited_user_id: invitedUserId,
          status: 'pending'
        }
      });

      if (existingInvitation) {
        return res.status(400).json({
          error: 'User has already been invited to this team'
        });
      }

      // Создаем приглашение
      const invitation = await Invitation.create({
        team_id: teamId,
        invited_user_id: invitedUserId,
        inviter_id: inviterId,
        message: message || null
      });

      // Создаем уведомление для приглашенного пользователя
      await Notification.create({
        user_id: invitedUserId,
        type: 'invitation',
        title: 'Team Invitation',
        message: `You have been invited to join team ${team.name} by ${req.user.username}`,
        related_entity_type: 'invitation',
        related_entity_id: invitation.id
      });

      // Отправляем WebSocket уведомление
      req.app.get('io').to(`user:${invitedUserId}`).emit('notification', {
        type: 'invitation',
        title: 'Team Invitation',
        message: `You have been invited to join team ${team.name}`
      });

      res.status(201).json({
        message: 'Invitation sent successfully',
        invitation: {
          id: invitation.id,
          status: invitation.status,
          message: invitation.message,
          createdAt: invitation.createdAt
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getMyInvitations(req, res, next) {
    try {
      const userId = req.user.id;

      const invitations = await Invitation.findAll({
        where: {
          invited_user_id: userId,
          status: 'pending'
        },
        include: [
          {
            model: Team,
            include: [
              {
                model: User,
                as: 'captain',
                attributes: ['id', 'username', 'avatar_url']
              },
              {
                model: User,
                as: 'members',
                attributes: ['id', 'username', 'avatar_url']
              }
            ]
          },
          {
            model: User,
            as: 'inviter',
            attributes: ['id', 'username', 'avatar_url']
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      res.json({
        invitations
      });
    } catch (error) {
      next(error);
    }
  }

  async updateInvitation(req, res, next) {
    const transaction = await sequelize.transaction();
    try {
      const { invitationId } = req.params;
      const { status } = req.body;
      const userId = req.user.id;

      if (!['accepted', 'rejected'].includes(status)) {
        await transaction.rollback();
        return res.status(400).json({
          error: 'Invalid status. Must be "accepted" or "rejected"'
        });
      }

      const invitation = await Invitation.findByPk(invitationId, {
        include: [
          {
            model: Team
          },
          {
            model: User,
            as: 'inviter'
          }
        ],
        transaction
      });

      if (!invitation) {
        await transaction.rollback();
        return res.status(404).json({
          error: 'Invitation not found'
        });
      }

      // Проверяем, что пользователь - тот, кого пригласили
      if (invitation.invited_user_id !== userId) {
        await transaction.rollback();
        return res.status(403).json({
          error: 'You can only respond to your own invitations'
        });
      }

      if (invitation.status !== 'pending') {
        await transaction.rollback();
        return res.status(400).json({
          error: 'Invitation has already been processed'
        });
      }

      invitation.status = status;
      await invitation.save({ transaction });

      if (status === 'accepted') {
        // Проверяем, что пользователь все еще не в команде
        const user = await User.findByPk(userId);
        if (user.team_id) {
          await transaction.rollback();
          return res.status(400).json({
            error: 'You have already joined another team'
          });
        }

        // Добавляем пользователя в команду
        await user.update({ team_id: invitation.Team.id }, { transaction });

        // Добавляем пользователя в командный чат
        const teamChat = await ChatRoom.findOne({
          where: { team_id: invitation.Team.id, type: 'team' },
          transaction
        });

        if (teamChat) {
          await ChatRoomMember.create({
            room_id: teamChat.id,
            user_id: userId
          }, { transaction });
        }
      }

      // Создаем уведомление для пригласившего
      await Notification.create({
        user_id: invitation.inviter_id,
        type: 'invitation',
        title: `Invitation ${status}`,
        message: `Your invitation to ${req.user.username} has been ${status}`,
        related_entity_type: 'invitation',
        related_entity_id: invitation.id
      }, { transaction });

      // Отправляем WebSocket уведомления
      req.app.get('io').to(`user:${invitation.inviter_id}`).emit('notification', {
        type: 'invitation',
        title: `Invitation ${status}`,
        message: `Your invitation to ${req.user.username} has been ${status}`
      });

      await transaction.commit();

      await cacheService.invalidateUserCache(userId);
      await cacheService.invalidateTeamCache(invitation.Team.id);

      res.json({
        message: `Invitation ${status} successfully`,
        invitation: {
          id: invitation.id,
          status: invitation.status
        }
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }
}

module.exports = new InvitationController();