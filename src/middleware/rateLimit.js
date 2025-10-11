// middleware/rateLimit.js
const redisClient = require('../config/redis');

const rateLimit = (windowMs = 60000, maxRequests = 100) => {
  return async (req, res, next) => {
    try {
      const key = `rate_limit:${req.ip}:${req.path}`;
      const current = await redisClient.get(key);
      
      if (current === null) {
        await redisClient.set(key, '1', windowMs / 1000);
        return next();
      }
      
      const requests = parseInt(current);
      
      if (requests >= maxRequests) {
        return res.status(429).json({
          error: 'Too many requests',
          message: `Please try again in ${windowMs / 1000} seconds`
        });
      }
      
      await redisClient.set(key, (requests + 1).toString(), windowMs / 1000);
      next();
    } catch (error) {
      console.error('Rate limit error:', error);
      next(); // В случае ошибки Redis пропускаем запрос
    }
  };
};

// Более строгий лимит для аутентификации
const authRateLimit = rateLimit(900000, 100000); // 5 попыток за 15 минут

// Стандартный лимит для API
const apiRateLimit = rateLimit(60000, 100); // 100 запросов в минуту

module.exports = {
  rateLimit,
  authRateLimit,
  apiRateLimit
};