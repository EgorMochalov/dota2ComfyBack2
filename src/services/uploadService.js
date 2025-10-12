// services/uploadService.js - ОБНОВЛЕННЫЙ
const multer = require('multer');
const yandexStorageService = require('./yandexStorageService');
const fileUtils = require('../utils/fileUtils');
const { User, Team } = require('../models');

class UploadService {
  constructor() {
    // Настраиваем multer для обработки файлов в памяти (не сохраняем на диск)
    this.storage = multer.memoryStorage();
    
    this.upload = multer({
      storage: this.storage,
      limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
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

  // Загрузка аватарки пользователя в Yandex Cloud
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

      // Загружаем новый аватар в Yandex Cloud
      const uploadResult = await yandexStorageService.uploadFile(file, 'users');
      
      // Сохраняем URL из Yandex Cloud
      await user.update({ avatar_url: uploadResult.url });

      return uploadResult.url;
    } catch (error) {
      throw error;
    }
  }

  // Загрузка аватарки команды в Yandex Cloud
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

      // Загружаем новый аватар в Yandex Cloud
      const uploadResult = await yandexStorageService.uploadFile(file, 'teams');
      
      // Сохраняем URL из Yandex Cloud
      await team.update({ avatar_url: uploadResult.url });

      return uploadResult.url;
    } catch (error) {
      throw error;
    }
  }

  // Удаление старого аватарка
  async deleteOldAvatar(avatarUrl) {
    try {
      if (avatarUrl && avatarUrl.includes('storage.yandexcloud.net')) {
        await yandexStorageService.deleteFile(avatarUrl);
      }
    } catch (error) {
      console.error('Error deleting old avatar from Yandex Cloud:', error);
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