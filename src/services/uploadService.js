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
    // this.storage = this.initStorage();
    // this.upload = this.initMulter();
  }

  // initStorage() {
  //   return multer.diskStorage({
  //     destination: async (req, file, cb) => {
  //       await fileUtils.ensureUploadDir();
  //       cb(null, config.upload.uploadPath);
  //     },
  //     filename: (req, file, cb) => {
  //       const filename = fileUtils.generateFileName(file.originalname);
  //       cb(null, filename);
  //     }
  //   });
  // }

  // initMulter() {
  //   return multer({
  //     storage: this.storage,
  //     limits: {
  //       fileSize: config.upload.maxFileSize
  //     },
  //     fileFilter: (req, file, cb) => {
  //       if (fileUtils.isValidImageType(file.mimetype)) {
  //         cb(null, true);
  //       } else {
  //         cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
  //       }
  //     }
  //   });
  // }

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

      // Генерируем уникальное имя файла
      const fileName = yandexStorageService.generateFileName(
        file.originalname, 
        'user-avatars'
      );

      // Получаем URL для загрузки
      const { uploadUrl, publicUrl } = await yandexStorageService.generateUploadUrl(
        fileName,
        file.mimetype
      );

      // Загружаем файл напрямую из фронтенда в Yandex Cloud
      // Фронтенд получит uploadUrl и загрузит файл напрямую

      // Сохраняем publicUrl в базу данных
      await user.update({ avatar_url: publicUrl });

      // Инвалидируем кэш
      await redisClient.del(`user:${userId}`);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading user avatar:', error);
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

      if (team.captain_id !== captainId) {
        throw new Error('Only team captain can upload team avatar');
      }

      // Удаляем старый аватар если есть
      if (team.avatar_url) {
        await this.deleteOldAvatar(team.avatar_url);
      }

      const fileName = yandexStorageService.generateFileName(
        file.originalname,
        'team-avatars'
      );

      const { uploadUrl, publicUrl } = await yandexStorageService.generateUploadUrl(
        fileName,
        file.mimetype
      );

      await team.update({ avatar_url: publicUrl });
      await redisClient.del(`team:${teamId}`);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading team avatar:', error);
      throw error;
    }
  }

  async deleteOldAvatar(avatarUrl) {
    try {
      if (avatarUrl && avatarUrl.includes('storage.yandexcloud.net')) {
        // Извлекаем ключ файла из URL
        const urlParts = avatarUrl.split('/');
        const key = urlParts.slice(3).join('/'); // Убираем https://storage.yandexcloud.net/bucket-name/
        
        await yandexStorageService.deleteFile(key);
      }
    } catch (error) {
      console.error('Error deleting old avatar:', error);
    }
  }

  async getDirectUploadUrl(userId, originalName, fileType) {
    try {
      const prefix = fileType === 'user' ? 'user-avatars' : 'team-avatars';
      const fileName = yandexStorageService.generateFileName(originalName, prefix);

      const { uploadUrl, publicUrl } = await yandexStorageService.generateUploadUrl(
        fileName,
        'image/jpeg' // или определить из originalName
      );

      return {
        upload_url: uploadUrl,
        public_url: publicUrl,
        file_name: fileName
      };
    } catch (error) {
      console.error('Error getting direct upload URL:', error);
      throw error;
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