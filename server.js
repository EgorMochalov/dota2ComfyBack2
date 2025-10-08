// server.js - ДОБАВЛЯЕМ ПРОДАКШЕН КОНФИГ
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { sequelize } = require('./src/models');
const config = require('./src/config/config');
const errorHandler = require('./src/middleware/errorHandler');
const redisClient = require('./src/config/redis');


// Импорт маршрутов
const routes = require('./src/routes');

// Импорт сервисов
const onlineStatusService = require('./src/services/onlineStatusService');
const searchStatusCleanup = require('./src/jobs/searchStatusCleanup');
const onlineStatusCleanup = require('./src/jobs/onlineStatusCleanup');

const chatHandlers = require('./src/sockets/chatHandlers');

const app = express();
const server = http.createServer(app);

// Настройка CORS для продакшена
const corsOptions = {
  origin: function (origin, callback) {
    // Разрешаем запросы без origin (например, из мобильных приложений)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:3000', 
      'https://your-frontend-app.onrender.com' // замените на ваш фронтенд URL
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Статические файлы (для загруженных аватарков)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api', routes);

// Health check с проверкой всех сервисов
app.get('/health', async (req, res) => {
  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    database: 'unknown',
    redis: 'unknown'
  };

  try {
    // Проверяем подключение к базе данных
    await sequelize.authenticate();
    healthCheck.database = 'connected';
    
    // Проверяем подключение к Redis
    await redisClient.set('healthcheck', 'ok', 10);
    const redisStatus = await redisClient.get('healthcheck');
    healthCheck.redis = redisStatus === 'ok' ? 'connected' : 'disconnected';
  } catch (error) {
    healthCheck.status = 'ERROR';
    healthCheck.error = error.message;
    
    if (error.name === 'SequelizeConnectionError') {
      healthCheck.database = 'disconnected';
    }
  }

  const statusCode = healthCheck.status === 'OK' ? 200 : 503;
  res.status(statusCode).json(healthCheck);
});

// WebSocket настройка
const io = socketIo(server, {
  cors: {
    origin: function (origin, callback) {
      // Та же логика CORS что и выше
      if (!origin) return callback(null, true);
      
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        'http://localhost:3000',
        'https://your-frontend-app.onrender.com'
      ];
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware для аутентификации WebSocket
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentication error'));
  }

  try {
    // В реальном приложении здесь должна быть проверка JWT токена
    const userId = socket.handshake.auth.userId;
    const username = socket.handshake.auth.username;
    
    if (!userId || !username) {
      return next(new Error('Invalid authentication data'));
    }

    socket.userId = userId;
    socket.username = username;
    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
});

// Инициализация WebSocket обработчиков
chatHandlers(io);

// Сохраняем io instance в app для доступа из контроллеров
app.set('io', io);

// Обработка ошибок
app.use(errorHandler);

// Обработка несуществующих маршрутов
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The route ${req.originalUrl} does not exist`
  });
});

// Запуск сервера
const startServer = async () => {
  try {
    console.log('🔄 Attempting to connect to database...');
    
    // Добавляем повторные попытки подключения к БД
    let dbConnected = false;
    let dbRetries = 5;
    
    while (dbRetries > 0 && !dbConnected) {
      try {
        await sequelize.authenticate();
        dbConnected = true;
        console.log('✅ Database connection established');
      } catch (dbError) {
        console.error(`❌ Database connection failed. Retries left: ${dbRetries - 1}`, dbError.message);
        dbRetries--;
        
        if (dbRetries > 0) {
          console.log('🔄 Retrying in 5 seconds...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }

    if (!dbConnected) {
      throw new Error('Unable to connect to database after multiple attempts');
    }

    // В продакшене запускаем миграции
    if (config.nodeEnv === 'production') {
      try {
        console.log('🔄 Running database migrations...');
        // Не используем sync в продакшене! Вместо этого используем миграции
        const { execSync } = require('child_process');
        execSync('npx sequelize-cli db:migrate', { stdio: 'inherit' });
        console.log('✅ Database migrations completed');
      } catch (migrationError) {
        console.error('❌ Database migration failed:', migrationError);
        // Не прерываем запуск, если миграции не удались
      }
    }

    // Подключение к Redis с повторными попытками
    let redisConnected = false;
    let redisRetries = 3;
    
    while (redisRetries > 0 && !redisConnected) {
      try {
        await redisClient.connect();
        redisConnected = true;
        console.log('✅ Redis connection established');
      } catch (redisError) {
        console.error(`❌ Redis connection failed. Retries left: ${redisRetries - 1}`);
        redisRetries--;
        
        if (redisRetries > 0) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
          console.warn('⚠️  Continuing without Redis connection');
        }
      }
    }

    // Запускаем фоновые задачи
    if (config.nodeEnv !== 'test') {
      searchStatusCleanup.start();
      onlineStatusCleanup.start();
      console.log('✅ Background jobs started');
    }

    const PORT = process.env.PORT || config.port;
    server.listen(PORT, () => {
      console.log('🚀 Server started successfully');
      console.log(`📍 Environment: ${config.nodeEnv}`);
      console.log(`📍 Port: ${PORT}`);
      console.log(`📍 Health check: https://your-app.onrender.com/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Обработка graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  server.close(async () => {
    await sequelize.close();
    await redisClient.quit();
    console.log('Server shut down');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  
  server.close(async () => {
    await sequelize.close();
    await redisClient.quit();
    console.log('Server shut down');
    process.exit(0);
  });
});

startServer();