// utils/jwt.js
const jwt = require('jsonwebtoken');
const config = require('../config/config');

const generateToken = (userId) => {
  return jwt.sign(
    { userId }, 
    config.jwtSecret, 
    { expiresIn: config.jwtExpiresIn }
  );
};

const verifyToken = (token) => {
  return jwt.verify(token, config.jwtSecret);
};

const decodeToken = (token) => {
  return jwt.decode(token);
};

module.exports = {
  generateToken,
  verifyToken,
  decodeToken
};