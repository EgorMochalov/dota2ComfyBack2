// controllers/authController.js
const { User, sequelize } = require('../models');
const { generateToken } = require('../utils/jwt');
const { hashPassword, comparePassword, validatePassword } = require('../utils/password');
const onlineStatusService = require('../services/onlineStatusService');
const redisClient = require('../config/redis');
const { Op } = require('sequelize');

class AuthController {
  async register(req, res, next) {
    try {
      const { email, username, password, region } = req.body;
      console.log(email)
      // Проверяем существующего пользователя
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [{ email }, { username }]
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

      // Генерируем токен
      const token = generateToken(user.id);

      // Устанавливаем онлайн статус
      await onlineStatusService.setUserOnline(user.id, {
        username: user.username,
        region: user.region
      });

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          region: user.region,
          avatar_url: user.avatar_url,
          is_searching: user.is_searching,
          team_id: user.team_id,
          last_online: user.last_online
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ where: { email } });
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

      // Обновляем last_online и онлайн статус
      await user.update({ last_online: new Date() });
      await onlineStatusService.setUserOnline(user.id, {
        username: user.username,
        region: user.region
      });
      console.log(user)
      res.json({
        message: 'Login successful',
        token,
        user: {
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
          updatedAt: user.updatedAt
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getMe(req, res, next) {
    try {
      const user = req.user;

      // Обновляем активность
      await user.update({ last_online: new Date() });
      await onlineStatusService.updateUserActivity(user.id, {
        username: user.username,
        region: user.region
      });

      res.json({
        user: {
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
          updatedAt: user.updatedAt
        }
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

      res.json({
        token: newToken,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          region: user.region,
          avatar_url: user.avatar_url,
          is_searching: user.is_searching,
          team_id: user.team_id
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();