// services/chatService.js - ПОЛНОСТЬЮ ПЕРЕРАБОТАННЫЙ
const { ChatRoomMember, ChatMessage, sequelize } = require('../models');
const { Op } = require('sequelize');
class ChatService {
  // Подсчет непрочитанных сообщений для пользователя в комнате
  async getUnreadCount(roomId, userId) {
    const member = await ChatRoomMember.findOne({
      where: { room_id: roomId, user_id: userId }
    });

    if (!member || !member.last_read_at) {
      // Если нет записи или last_read_at, считаем все сообщения, кроме своих
      return await ChatMessage.count({
        where: {
          room_id: roomId,
          user_id: { [Op.ne]: userId } // Исключаем свои сообщения
        }
      });
    }

    // Считаем сообщения после last_read_at, исключая свои
    return await ChatMessage.count({
      where: {
        room_id: roomId,
        createdAt: { [Op.gt]: member.last_read_at },
        user_id: { [Op.ne]: userId } // Исключаем свои сообщения
      }
    });
  }

  // Отметить все сообщения как прочитанные
  async markAsRead(roomId, userId) {
    await ChatRoomMember.update(
      { last_read_at: new Date() },
      { where: { room_id: roomId, user_id: userId } }
    );

    return await this.getUnreadCount(roomId, userId);
  }

  // Обновить счетчики непрочитанных при новом сообщении
  async onNewMessage(roomId, senderId) {
    try {
      // Находим всех участников чата, кроме отправителя
      const members = await ChatRoomMember.findAll({
        where: {
          room_id: roomId,
          user_id: { [Op.ne]: senderId }
        }
      });

      // Для каждого участника (кроме отправителя) увеличиваем счетчик
      for (const member of members) {
        const unreadCount = await this.getUnreadCount(roomId, member.user_id);
        
        // Можно добавить логику для пуш-уведомлений здесь
        console.log(`User ${member.user_id} now has ${unreadCount} unread messages in room ${roomId}`);
      }

      return members;
    } catch (error) {
      console.error('Error in onNewMessage:', error);
      return [];
    }
  }

  // Получить время последнего прочтения для пользователя
  async getLastReadAt(roomId, userId) {
    const member = await ChatRoomMember.findOne({
      where: { room_id: roomId, user_id: userId },
      attributes: ['last_read_at']
    });

    return member ? member.last_read_at : null;
  }

  // Инициализировать запись участника чата (если не существует)
  async initializeChatMember(roomId, userId) {
    const existingMember = await ChatRoomMember.findOne({
      where: { room_id: roomId, user_id: userId }
    });

    if (!existingMember) {
      return await ChatRoomMember.create({
        room_id: roomId,
        user_id: userId,
        last_read_at: new Date() // Устанавливаем текущее время как прочитанное
      });
    }

    return existingMember;
  }
}

module.exports = new ChatService();