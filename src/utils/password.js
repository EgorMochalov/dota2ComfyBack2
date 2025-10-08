// utils/password.js
const bcrypt = require('bcryptjs');

const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

const validatePassword = (password) => {
  if (password.length < 6) {
    return 'Password must be at least 6 characters long';
  }
  
  // Можно добавить больше проверок
  // if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
  //   return 'Password must contain at least one lowercase letter, one uppercase letter, and one number';
  // }
  
  return null;
};

module.exports = {
  hashPassword,
  comparePassword,
  validatePassword
};