// sockets/chatHandlers.js - ОБНОВЛЕННЫЙ
const onlineStatusService = require('../services/onlineStatusService');
const chatService = require('../services/chatService');
const { ChatRoomMember, User } = require('../models');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    const userId = socket.handshake.auth.userId;
    if (!userId) {
      socket.disconnect();
      return;
    }

    socket.join(`user:${userId}`);
    onlineStatusService.setUserOnline(userId, {
      socketId: socket.id,
      username: socket.handshake.auth.username
    });

    socket.broadcast.emit('userOnline', { userId });

    // Подписываемся на чаты пользователя
    socket.on('subscribeToChats', async () => {
      try {
        const userChats = await ChatRoomMember.findAll({
          where: { user_id: userId },
          attributes: ['room_id']
        });

        userChats.forEach(chat => {
          socket.join(`chat:${chat.room_id}`);
        });

        console.log(`User ${userId} subscribed to ${userChats.length} chats`);
      } catch (error) {
        console.error('Error subscribing to chats:', error);
      }
    });

    socket.on('joinChat', (roomId) => {
      socket.join(`chat:${roomId}`);
      console.log(`User ${userId} joined chat: ${roomId}`);
    });

    socket.on('leaveChat', (roomId) => {
      socket.leave(`chat:${roomId}`);
      console.log(`User ${userId} left chat: ${roomId}`);
    });

    // Отметить чат как прочитанный
    socket.on('markChatAsRead', async (data) => {
      try {
        const { roomId } = data;
        const unreadCount = await chatService.markAsRead(roomId, userId);
        
        socket.emit('chatRead', {
          roomId,
          unread_count: unreadCount
        });

        // ОБНОВЛЕНО: Уведомляем других участников, что пользователь прочитал сообщения
        socket.to(`chat:${roomId}`).emit('userReadMessages', {
          roomId,
          userId,
          username: socket.handshake.auth.username
        });
      } catch (error) {
        console.error('Error marking chat as read:', error);
      }
    });

    socket.on('typing', (data) => {
      const { roomId, isTyping } = data;
      socket.to(`chat:${roomId}`).emit('userTyping', {
        userId,
        username: socket.handshake.auth.username,
        isTyping
      });
    });

    socket.on('userActivity', () => {
      onlineStatusService.updateUserActivity(userId);
    });

    socket.on('subscribeToNotifications', () => {
      socket.join(`notifications:${userId}`);
    });

    socket.on('unsubscribeFromNotifications', () => {
      socket.leave(`notifications:${userId}`);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      onlineStatusService.setUserOffline(userId);
      socket.broadcast.emit('userOffline', { userId });
    });
  });
};