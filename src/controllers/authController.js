// controllers/authController.js - ПОЛНОСТЬЮ ОБНОВЛЯЕМ
const { User, Team } = require('../models');
const { generateToken } = require('../utils/jwt');
const { hashPassword, comparePassword, validatePassword } = require('../utils/password');
const onlineStatusService = require('../services/onlineStatusService');
const redisClient = require('../config/redis');
const { sequelize } = require('../models');

class AuthController {
  // Вспомогательный метод для формирования ответа с пользователем
  formatUserResponse(user) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      region: user.region,
      avatar_url: user.avatar_url,
      game_modes: user.game_modes,
      mmr_rating: user.mmr_rating,
      preferred_roles: user.preferred_roles,
      about_me: user.about_me,
      tags: user.tags,
      is_searching: user.is_searching,
      team_id: user.team_id,
      last_online: user.last_online,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      team: user.team // Включаем информацию о команде
    };
  }

  async register(req, res, next) {
    try {
      const { email, username, password, region } = req.body;

      // Проверяем существующего пользователя
      const existingUser = await User.findOne({
        where: {
          [sequelize.Op.or]: [{ email }, { username }]
        }
      });

      if (existingUser) {
        return res.status(400).json({
          error: 'User already exists',
          message: existingUser.email === email 
            ? 'Email already registered' 
            : 'Username already taken'
        });
      }

      // Валидируем пароль
      const passwordError = validatePassword(password);
      if (passwordError) {
        return res.status(400).json({
          error: 'Invalid password',
          message: passwordError
        });
      }

      // Хешируем пароль и создаем пользователя
      const passwordHash = await hashPassword(password);
      const user = await User.create({
        email,
        username,
        password_hash: passwordHash,
        region,
        game_modes: [],
        preferred_roles: [],
        tags: []
      });

      // Получаем пользователя с полной информацией (включая команду)
      const userWithTeam = await User.findByPk(user.id, {
        attributes: { exclude: ['password_hash'] },
        include: [
          {
            model: Team,
            as: 'team',
            attributes: ['id', 'name', 'avatar_url', 'region']
          }
        ]
      });

      // Генерируем токен
      const token = generateToken(userWithTeam.id);

      // Устанавливаем онлайн статус
      await onlineStatusService.setUserOnline(userWithTeam.id, {
        username: userWithTeam.username,
        region: userWithTeam.region
      });

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: this.formatUserResponse(userWithTeam)
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      // Ищем пользователя с информацией о команде
      const user = await User.findOne({ 
        where: { email },
        include: [
          {
            model: Team,
            as: 'team',
            attributes: ['id', 'name', 'avatar_url', 'region']
          }
        ]
      });
      
      if (!user) {
        return res.status(401).json({
          error: 'Invalid credentials',
          message: 'Invalid email or password'
        });
      }

      const isPasswordValid = await comparePassword(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({
          error: 'Invalid credentials',
          message: 'Invalid email or password'
        });
      }

      const token = generateToken(user.id);

      // Обновляем last_online с серверным временем
      await user.update({ 
        last_online: sequelize.fn('NOW') 
      });
      
      await onlineStatusService.setUserOnline(user.id, {
        username: user.username,
        region: user.region
      });

      // Исключаем password_hash из ответа
      const userWithoutPassword = { ...user.toJSON() };
      delete userWithoutPassword.password_hash;

      res.json({
        message: 'Login successful',
        token,
        user: this.formatUserResponse(userWithoutPassword)
      });
    } catch (error) {
      next(error);
    }
  }

  async getMe(req, res, next) {
    try {
      const user = req.user;

      // Обновляем активность с серверным временем
      await user.update({ 
        last_online: sequelize.fn('NOW') 
      });
      
      await onlineStatusService.updateUserActivity(user.id, {
        username: user.username,
        region: user.region
      });

      // Получаем актуальные данные пользователя с командой
      const currentUser = await User.findByPk(user.id, {
        attributes: { exclude: ['password_hash'] },
        include: [
          {
            model: Team,
            as: 'team',
            attributes: ['id', 'name', 'avatar_url', 'region']
          }
        ]
      });

      res.json({
        user: this.formatUserResponse(currentUser)
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const userId = req.user.id;
      await onlineStatusService.setUserOffline(userId);
      
      res.json({
        message: 'Logout successful'
      });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const user = req.user;
      const newToken = generateToken(user.id);

      // Получаем актуальные данные пользователя с командой
      const currentUser = await User.findByPk(user.id, {
        attributes: { exclude: ['password_hash'] },
        include: [
          {
            model: Team,
            as: 'team',
            attributes: ['id', 'name', 'avatar_url', 'region']
          }
        ]
      });

      res.json({
        token: newToken,
        user: this.formatUserResponse(currentUser)
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();