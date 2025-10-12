// services/uploadService.js - ПОЛНОСТЬЮ ПЕРЕРАБОТАННЫЙ
const { User, Team } = require('../models');

class UploadService {
  // Загрузка аватарки пользователя как Base64
  async uploadUserAvatar(userId, file) {
    try {
      if (!file) {
        throw new Error('No file provided');
      }

      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Читаем файл как Base64
      const avatarData = file.buffer.toString('base64');
      const mimetype = file.mimetype;

      // Обновляем пользователя
      await user.update({
        avatar_data: avatarData,
        avatar_mimetype: mimetype,
        avatar_url: `data:${mimetype};base64,${avatarData}` // Data URL для фронтенда
      });

      return user.avatar_url;
    } catch (error) {
      throw error;
    }
  }

  // Загрузка аватарки команды как Base64
  async uploadTeamAvatar(teamId, file, captainId) {
    try {
      if (!file) {
        throw new Error('No file provided');
      }

      const team = await Team.findByPk(teamId);
      if (!team) {
        throw new Error('Team not found');
      }

      // Проверяем права
      if (team.captain_id !== captainId) {
        throw new Error('Only team captain can upload team avatar');
      }

      // Читаем файл как Base64
      const avatarData = file.buffer.toString('base64');
      const mimetype = file.mimetype;

      // Обновляем команду
      await team.update({
        avatar_data: avatarData,
        avatar_mimetype: mimetype,
        avatar_url: `data:${mimetype};base64,${avatarData}` // Data URL для фронтенда
      });

      return team.avatar_url;
    } catch (error) {
      throw error;
    }
  }

  // Middleware для multer (память вместо диска)
  getMulterConfig() {
    const multer = require('multer');
    
    return multer({
      storage: multer.memoryStorage(), // Храним в памяти, потом конвертируем в Base64
      limits: {
        fileSize: 2 * 1024 * 1024, // 2MB максимум
      },
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new Error('Only image files are allowed'), false);
        }
      }
    });
  }

  // Middleware для обработки ошибок загрузки
  handleUploadError(err, req, res, next) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'File too large',
          message: 'File size must be less than 2MB'
        });
      }
    }
    
    if (err.message.includes('Only image files')) {
      return res.status(400).json({
        error: 'Invalid file type',
        message: 'Only image files are allowed'
      });
    }

    next(err);
  }
}

module.exports = new UploadService();