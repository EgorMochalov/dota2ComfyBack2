const Redis = require('ioredis');
const config = require('./config');
require('dotenv').config();

class RedisClient {
  constructor() {
    console.log('Initializing Redis connection to Upstash...');
    
    const redisConfig = {
      host: 'first-serval-10008.upstash.io',
      port: 6379,
      username: 'default',
      password: 'AScYAAIncDJlYjZjNzAxMDkxMzE0ZDEyYTYzZWYxODhhNzg2Zjg3Y3AyMTAwMDg',
      tls: {
        rejectUnauthorized: false
      },
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      connectTimeout: 30000,
      commandTimeout: 10000,
      lazyConnect: false,
      keepAlive: 5000
    };

    this.client = new Redis(redisConfig);

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.client.on('connect', () => {
      console.log('🔄 Connecting to Upstash Redis...');
    });

    this.client.on('ready', () => {
      console.log('✅ Redis connected successfully and ready');
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    this.client.on('close', () => {
      console.log('🔒 Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
    });

    this.client.on('end', () => {
      console.log('❌ Redis connection ended');
    });
  }

  async connect() {
    // ioredis автоматически подключается при создании
    // Но мы можем проверить соединение
    try {
      await this.client.ping();
      console.log('✅ Redis connection verified');
    } catch (error) {
      console.error('❌ Redis connection failed:', error);
      throw error;
    }
  }

  async set(key, value, expiry = null) {
    try {
      if (expiry) {
        // В ioredis: set(key, value, 'EX', seconds)
        return await this.client.set(key, value, 'EX', expiry);
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
      // ioredis принимает массив или spread arguments
      return await this.client.sadd(key, ...members);
    } catch (error) {
      console.error('Redis sadd error:', error);
      throw error;
    }
  }

  async srem(key, ...members) {
    try {
      return await this.client.srem(key, ...members);
    } catch (error) {
      console.error('Redis srem error:', error);
      throw error;
    }
  }

  async smembers(key) {
    try {
      return await this.client.smembers(key);
    } catch (error) {
      console.error('Redis smembers error:', error);
      throw error;
    }
  }

  async publish(channel, message) {
    try {
      if (typeof message !== 'string') {
        message = JSON.stringify(message);
      }
      return await this.client.publish(channel, message);
    } catch (error) {
      console.error('Redis publish error:', error);
      throw error;
    }
  }

  async subscribe(channel, callback) {
    try {
      this.client.subscribe(channel, (err, count) => {
        if (err) {
          console.error('Redis subscribe error:', err);
          return;
        }
        console.log(`Subscribed to ${channel}. Total subscriptions: ${count}`);
      });

      this.client.on('message', (subChannel, message) => {
        if (subChannel === channel) {
          try {
            let parsedMessage = message;
            try {
              parsedMessage = JSON.parse(message);
            } catch (e) {
              // Если не JSON, оставляем как строку
            }
            callback(parsedMessage);
          } catch (error) {
            console.error('Error processing message:', error);
          }
        }
      });
    } catch (error) {
      console.error('Redis subscribe error:', error);
      throw error;
    }
  }

  async quit() {
    try {
      await this.client.quit();
      console.log('✅ Redis disconnected gracefully');
    } catch (error) {
      console.error('Error disconnecting from Redis:', error);
      throw error;
    }
  }

  async disconnect() {
    await this.quit();
  }

  // Дополнительные полезные методы
  async keys(pattern) {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      console.error('Redis keys error:', error);
      throw error;
    }
  }

  async flushall() {
    try {
      return await this.client.flushall();
    } catch (error) {
      console.error('Redis flushall error:', error);
      throw error;
    }
  }

  async ttl(key) {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      console.error('Redis ttl error:', error);
      throw error;
    }
  }

  // Метод для проверки здоровья соединения
  async healthCheck() {
    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;
      return {
        status: 'healthy',
        latency: `${latency}ms`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new RedisClient();