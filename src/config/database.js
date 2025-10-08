// config/database.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'dota2_teammate_finder_dev',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: console.log,
  },
  production: {
    username: 'dota2_user',
    password: 'dota2_user',
    database: 'dota2_teammate_finder',
    host: 'dpg-d3j39f3e5dus739h3b3g-a',
    port: 5432,
    dialect: 'postgres',
    logging: console.log
  }
};