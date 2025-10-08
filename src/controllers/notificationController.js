// controllers/notificationController.js
const { Notification } = require('../models');

class NotificationController {
  async getNotifications(req, res, next) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, unread_only = false } = req.query;

      const offset = (page - 1) * limit;
      const where = { user_id: userId };

      if (unread_only === 'true') {
        where.is_read = false;
      }

      const { count, rows: notifications } = await Notification.findAndCountAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        notifications,
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

  async markAsRead(req, res, next) {
    try {
      const { notificationId } = req.params;
      const userId = req.user.id;

      const notification = await Notification.findOne({
        where: {
          id: notificationId,
          user_id: userId
        }
      });

      if (!notification) {
        return res.status(404).json({
          error: 'Notification not found'
        });
      }

      await notification.update({ is_read: true });

      res.json({
        message: 'Notification marked as read'
      });
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req, res, next) {
    try {
      const userId = req.user.id;

      await Notification.update(
        { is_read: true },
        { where: { user_id: userId, is_read: false } }
      );

      res.json({
        message: 'All notifications marked as read'
      });
    } catch (error) {
      next(error);
    }
  }

  async getUnreadCount(req, res, next) {
    try {
      const userId = req.user.id;

      const count = await Notification.count({
        where: {
          user_id: userId,
          is_read: false
        }
      });

      res.json({
        unread_count: count
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new NotificationController();