// config/redis.js
const redis = require('redis');
const config = require('./config');
require('dotenv').config();
class RedisClient {
  constructor() {
    const redisConfig = {
          // Конфиг для внешнего Redis (Redis Cloud, Upstash и т.д.)
          url: process.env.REDIS_URL,
          socket: {
            tls: true,
            rejectUnauthorized: false
          }
        }

    this.client = redis.createClient(redisConfig);

    this.client.on('error', (err) => {
      console.error('Redis Client Error', err);
    });

    this.client.on('connect', () => {
      console.log('Redis connected successfully');
    });

    this.connect();
  }

  async connect() {
    await this.client.connect();
  }

  async set(key, value, expiry = null) {
    try {
      if (expiry) {
        return await this.client.set(key, value, { EX: expiry });
      }
      return await this.client.set(key, value);
    } catch (error) {
      console.error('Redis set error:', error);
      throw error;
    }
  }

  async get(key) {
    try {
      return await this.client.get(key);
    } catch (error) {
      console.error('Redis get error:', error);
      throw error;
    }
  }

  async del(key) {
    try {
      return await this.client.del(key);
    } catch (error) {
      console.error('Redis del error:', error);
      throw error;
    }
  }

  async exists(key) {
    try {
      return await this.client.exists(key);
    } catch (error) {
      console.error('Redis exists error:', error);
      throw error;
    }
  }

  async expire(key, seconds) {
    try {
      return await this.client.expire(key, seconds);
    } catch (error) {
      console.error('Redis expire error:', error);
      throw error;
    }
  }

  async sadd(key, ...members) {
    try {
      return await this.client.sAdd(key, members);
    } catch (error) {
      console.error('Redis sadd error:', error);
      throw error;
    }
  }

  async srem(key, ...members) {
    try {
      return await this.client.sRem(key, members);
    } catch (error) {
      console.error('Redis srem error:', error);
      throw error;
    }
  }

  async smembers(key) {
    try {
      return await this.client.sMembers(key);
    } catch (error) {
      console.error('Redis smembers error:', error);
      throw error;
    }
  }

  async publish(channel, message) {
    try {
      return await this.client.publish(channel, JSON.stringify(message));
    } catch (error) {
      console.error('Redis publish error:', error);
      throw error;
    }
  }

  async quit() {
    await this.client.quit();
  }
}

module.exports = new RedisClient();