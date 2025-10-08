// controllers/chatController.js - ОБНОВЛЕННЫЙ
const { ChatRoom, ChatMessage, ChatRoomMember, User, UserBlock, Team, sequelize } = require('../models');
const onlineStatusService = require('../services/onlineStatusService');
const chatService = require('../services/chatService');
const redisClient = require('../config/redis');
const { Op } = require('sequelize');

class ChatController {
  async getMyChats(req, res, next) {
    try {
      const userId = req.user.id;

      const chatRooms = await ChatRoom.findAll({
        include: [
          {
            model: ChatRoomMember,
            as: 'members',
            where: { user_id: userId },
            attributes: ['last_read_at'],
            required: true
          },
          {
            model: ChatMessage,
            as: 'messages',
            separate: true,
            limit: 1,
            order: [['createdAt', 'DESC']],
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'username']
              }
            ]
          },
          {
            model: Team,
            as: 'team',
            attributes: ['id', 'name', 'avatar_url'],
            include: [
              {
                model: User,
                as: 'members',
                attributes: ['id', 'username', 'avatar_url', 'region', 'mmr_rating', 'preferred_roles', 'last_online']
              }
            ]
          }
        ],
        order: [['last_activity', 'DESC']]
      });

      const chatsWithDetails = await Promise.all(
        chatRooms.map(async (room) => {
          const memberInfo = room.members[0];
          const unreadCount = await chatService.getUnreadCount(room.id, userId);

          let chatData = {
            id: room.id,
            type: room.type,
            name: room.name,
            last_activity: room.last_activity,
            last_message: room.messages[0] || null,
            unread_count: unreadCount
          };

          if (room.type === 'private') {
            const otherMember = await ChatRoomMember.findOne({
              where: {
                room_id: room.id,
                user_id: { [Op.ne]: userId }
              },
              include: [
                {
                  model: User,
                  as: 'user',
                  attributes: ['id', 'username', 'avatar_url', 'region', 'last_online']
                }
              ]
            });

            chatData.other_user = otherMember ? otherMember.user : null;
            chatData.name = otherMember ? otherMember.user.username : 'Unknown User';
            
            if (otherMember) {
              const onlineStatus = await onlineStatusService.getUserStatus(otherMember.user.id);
              
              // ДОБАВЛЯЕМ: Проверяем блокировку для other_user
              const isBlocked = await UserBlock.findOne({
                where: {
                  blocker_user_id: userId,
                  blocked_user_id: otherMember.user.id
                }
              });

              chatData.other_user = {
                ...otherMember.user.toJSON(),
                is_online: onlineStatus.isOnline,
                is_blocked: !!isBlocked // Добавляем поле is_blocked
              };
            }
          } else if (room.type === 'team') {
            chatData.team = room.team;
            chatData.name = room.team ? room.team.name : 'Team Chat';
            
            // Добавляем информацию о участниках команды
            if (room.team && room.team.members) {
              // Добавляем онлайн статусы и информацию о блокировках для участников команды
              const membersWithStatus = await Promise.all(
                room.team.members.map(async (member) => {
                  const onlineStatus = await onlineStatusService.getUserStatus(member.id);
                  
                  // Проверяем, заблокирован ли участник для текущего пользователя
                  const isBlocked = await UserBlock.findOne({
                    where: {
                      blocker_user_id: userId,
                      blocked_user_id: member.id
                    }
                  });
                  
                  return {
                    ...member.toJSON(),
                    is_online: onlineStatus.isOnline,
                    is_blocked: !!isBlocked // Добавляем поле is_blocked
                  };
                })
              );
              
              chatData.members = membersWithStatus;
            } else {
              chatData.members = [];
            }
          }

          return chatData;
        })
      );

      res.json({
        chats: chatsWithDetails
      });
    } catch (error) {
      next(error);
    }
  }

  async getOrCreatePrivateChat(req, res, next) {
    try {
      const userId = req.user.id;
      const { otherUserId } = req.params;

      // Проверяем блокировки
      const isBlocked = await UserBlock.findOne({
        where: {
          [Op.or]: [
            { blocker_user_id: userId, blocked_user_id: otherUserId },
            { blocker_user_id: otherUserId, blocked_user_id: userId }
          ]
        }
      });

      if (isBlocked) {
        return res.status(403).json({
          error: 'Cannot start chat with blocked user'
        });
      }

      // Ищем существующий приватный чат
      const existingChats = await ChatRoom.findAll({
        include: [
          {
            model: ChatRoomMember,
            as: 'members',
            where: {
              user_id: [userId, otherUserId]
            },
            required: true
          }
        ],
        where: {
          type: 'private'
        }
      });

      // Фильтруем чаты, где есть оба пользователя
      let chatRoom = existingChats.find(chat => 
        chat.members.length === 2 && 
        chat.members.some(m => m.user_id === userId) && 
        chat.members.some(m => m.user_id === otherUserId)
      );

      // Если чат не найден, создаем новый
      if (!chatRoom) {
        const transaction = await sequelize.transaction();
        try {
          chatRoom = await ChatRoom.create({
            type: 'private'
          }, { transaction });

          // Добавляем обоих пользователей в чат
          await ChatRoomMember.bulkCreate([
            { room_id: chatRoom.id, user_id: userId },
            { room_id: chatRoom.id, user_id: otherUserId }
          ], { transaction });

          await transaction.commit();
        } catch (error) {
          await transaction.rollback();
          throw error;
        }
      }

      // Получаем информацию о втором пользователе
      const otherMember = await ChatRoomMember.findOne({
        where: {
          room_id: chatRoom.id,
          user_id: otherUserId
        },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'avatar_url', 'region', 'last_online']
          }
        ]
      });

      let onlineStatus = { isOnline: false };
      if (otherMember) {
        onlineStatus = await onlineStatusService.getUserStatus(otherUserId);
      }

      const chatData = {
        id: chatRoom.id,
        type: chatRoom.type,
        name: otherMember ? otherMember.user.username : 'Unknown User',
        other_user: otherMember ? {
          ...otherMember.user.toJSON(),
          is_online: onlineStatus.isOnline
        } : null,
        last_activity: chatRoom.last_activity
      };

      res.json(chatData);
    } catch (error) {
      next(error);
    }
  }

  async getChatMessages(req, res, next) {
    try {
      const { roomId } = req.params;
      const userId = req.user.id;
      const { page = 1, limit = 50 } = req.query;

      const offset = (page - 1) * limit;

      // Проверяем, что пользователь является участником чата
      const isMember = await ChatRoomMember.findOne({
        where: {
          room_id: roomId,
          user_id: userId
        }
      });

      if (!isMember) {
        return res.status(403).json({
          error: 'Access denied to this chat'
        });
      }

      // ОБНОВЛЕНО: Инициализируем запись участника, если не существует
      await chatService.initializeChatMember(roomId, userId);

      const messages = await ChatMessage.findAll({
        where: { room_id: roomId },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'avatar_url']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // ОБНОВЛЕНО: Отмечаем сообщения как прочитанные ТОЛЬКО при явном запросе
      // Не автоматически при получении сообщений
      // Пользователь должен явно отметить чат как прочитанный

      // Обновляем время последней активности комнаты
      await ChatRoom.update(
        { last_activity: sequelize.fn('NOW') },
        { where: { id: roomId } }
      );

      res.json({
        messages: messages.reverse()
      });
    } catch (error) {
      next(error);
    }
  }

  async markChatAsRead(req, res, next) {
    try {
      const { roomId } = req.params;
      const userId = req.user.id;

      // ОБНОВЛЕНО: Явно отмечаем чат как прочитанный
      const unreadCount = await chatService.markAsRead(roomId, userId);

      // Отправляем WebSocket событие об обновлении счетчика
      req.app.get('io').to(`user:${userId}`).emit('chatRead', {
        roomId,
        unread_count: unreadCount
      });

      res.json({
        message: 'Chat marked as read',
        unread_count: unreadCount
      });
    } catch (error) {
      next(error);
    }
  }

  // Добавляем метод для получения информации о непрочитанных сообщениях
  async getUnreadInfo(req, res, next) {
    try {
      const userId = req.user.id;
      const { roomId } = req.params;

      const unreadCount = await chatService.getUnreadCount(roomId, userId);
      const lastReadAt = await chatService.getLastReadAt(roomId, userId);

      res.json({
        unread_count: unreadCount,
        last_read_at: lastReadAt
      });
    } catch (error) {
      next(error);
    }
  }

  async sendMessage(req, res, next) {
    try {
      const { roomId } = req.params;
      const userId = req.user.id;
      const { message, message_type = 'text' } = req.body;

      // Проверяем, что пользователь является участником чата
      const isMember = await ChatRoomMember.findOne({
        where: {
          room_id: roomId,
          user_id: userId
        }
      });

      if (!isMember) {
        return res.status(403).json({
          error: 'Access denied to this chat'
        });
      }

      const chatRoom = await ChatRoom.findByPk(roomId);
      if (chatRoom.type === 'private') {
        const otherMember = await ChatRoomMember.findOne({
          where: {
            room_id: roomId,
            user_id: { [Op.ne]: userId }
          }
        });

        if (otherMember) {
          const isBlocked = await UserBlock.findOne({
            where: {
              [Op.or]: [
                { blocker_user_id: userId, blocked_user_id: otherMember.user_id },
                { blocker_user_id: otherMember.user_id, blocked_user_id: userId }
              ]
            }
          });

          if (isBlocked) {
            return res.status(403).json({
              error: 'Cannot send message to blocked user'
            });
          }
        }
      }

      // Создаем сообщение
      const chatMessage = await ChatMessage.create({
        room_id: roomId,
        user_id: userId,
        message,
        message_type
      });

      // ОБНОВЛЕНО: НЕ обновляем last_read_at для отправителя при отправке сообщения
      // Сообщения, отправленные пользователем, не должны считаться непрочитанными для него

      // Обновляем время последней активности комнаты
      await ChatRoom.update(
        { last_activity: sequelize.fn('NOW') },
        { where: { id: roomId } }
      );

      // Получаем сообщение с информацией о пользователе
      const messageWithUser = await ChatMessage.findByPk(chatMessage.id, {
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'avatar_url']
          }
        ]
      });

      // ОБНОВЛЕНО: Обновляем счетчики непрочитанных только для других участников
      const otherMembers = await chatService.onNewMessage(roomId, userId);

      // Отправляем сообщение через WebSocket
      const io = req.app.get('io');
      io.to(`chat:${roomId}`).emit('newMessage', {
        roomId,
        message: messageWithUser
      });

      // ОБНОВЛЕНО: Обновляем счетчики непрочитанных только для других участников
      for (const member of otherMembers) {
        const unreadCount = await chatService.getUnreadCount(roomId, member.user_id);
        io.to(`user:${member.user_id}`).emit('unreadCountUpdate', {
          roomId,
          unread_count: unreadCount
        });
      }

      res.status(201).json({
        message: 'Message sent successfully',
        chatMessage: messageWithUser
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteChat(req, res, next) {
    try {
      const { roomId } = req.params;
      const userId = req.user.id;

      const chatRoom = await ChatRoom.findByPk(roomId);
      if (!chatRoom) {
        return res.status(404).json({
          error: 'Chat room not found'
        });
      }

      // Проверяем, что пользователь является участником чата
      const isMember = await ChatRoomMember.findOne({
        where: {
          room_id: roomId,
          user_id: userId
        }
      });

      if (!isMember) {
        return res.status(403).json({
          error: 'Access denied to this chat'
        });
      }

      // Удаляем чат (только для приватных чатов)
      if (chatRoom.type !== 'private') {
        return res.status(400).json({
          error: 'Only private chats can be deleted'
        });
      }

      await chatRoom.destroy();

      res.json({
        message: 'Chat deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ChatController();