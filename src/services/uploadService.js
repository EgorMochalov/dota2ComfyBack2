// services/uploadService.js
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/config');
const fileUtils = require('../utils/fileUtils');
const redisClient = require('../config/redis');
const { User, Team } = require('../models');

class UploadService {
  constructor() {
    this.storage = this.initStorage();
    this.upload = this.initMulter();
  }

  initStorage() {
    return multer.diskStorage({
      destination: async (req, file, cb) => {
        await fileUtils.ensureUploadDir();
        cb(null, config.upload.uploadPath);
      },
      filename: (req, file, cb) => {
        const filename = fileUtils.generateFileName(file.originalname);
        cb(null, filename);
      }
    });
  }

  initMulter() {
    return multer({
      storage: this.storage,
      limits: {
        fileSize: config.upload.maxFileSize
      },
      fileFilter: (req, file, cb) => {
        if (fileUtils.isValidImageType(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
        }
      }
    });
  }

  // Загрузка аватарки пользователя
  async uploadUserAvatar(userId, file) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Удаляем старый аватар если есть
      if (user.avatar_url) {
        await this.deleteOldAvatar(user.avatar_url);
      }

      // Сохраняем новый аватар
      const avatarUrl = `/uploads/${file.filename}`;
      await user.update({ avatar_url: avatarUrl });

      // Инвалидируем кэш
      await redisClient.del(`user:${userId}`);

      return avatarUrl;
    } catch (error) {
      // Удаляем загруженный файл в случае ошибки
      if (file && file.path) {
        await fileUtils.deleteFile(file.path);
      }
      throw error;
    }
  }

  // Загрузка аватарки команды
  async uploadTeamAvatar(teamId, file, captainId) {
    try {
      const team = await Team.findByPk(teamId);
      if (!team) {
        throw new Error('Team not found');
      }

      // Проверяем права
      if (team.captain_id !== captainId) {
        throw new Error('Only team captain can upload team avatar');
      }

      // Удаляем старый аватар если есть
      if (team.avatar_url) {
        await this.deleteOldAvatar(team.avatar_url);
      }

      // Сохраняем новый аватар
      const avatarUrl = `/uploads/${file.filename}`;
      await team.update({ avatar_url: avatarUrl });

      // Инвалидируем кэш
      await redisClient.del(`team:${teamId}`);

      return avatarUrl;
    } catch (error) {
      // Удаляем загруженный файл в случае ошибки
      if (file && file.path) {
        await fileUtils.deleteFile(file.path);
      }
      throw error;
    }
  }

  async deleteOldAvatar(avatarUrl) {
    try {
      if (avatarUrl && avatarUrl.startsWith('/uploads/')) {
        const filename = path.basename(avatarUrl);
        const filePath = path.join(config.upload.uploadPath, filename);
        await fileUtils.deleteFile(filePath);
      }
    } catch (error) {
      console.error('Error deleting old avatar:', error);
    }
  }

  // Получение middleware для загрузки одного файла
  getSingleUploadMiddleware(fieldName = 'avatar') {
    return this.upload.single(fieldName);
  }

  // Middleware для обработки ошибок загрузки
  handleUploadError(err, req, res, next) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'File too large',
          message: 'File size must be less than 5MB'
        });
      }
      
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          error: 'Invalid file',
          message: 'Unexpected file field'
        });
      }
    }
    
    if (err.message.includes('Invalid file type')) {
      return res.status(400).json({
        error: 'Invalid file type',
        message: 'Only JPEG, PNG, and WebP images are allowed'
      });
    }

    next(err);
  }
}

module.exports = new UploadService();