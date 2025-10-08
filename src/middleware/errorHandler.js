// middleware/errorHandler.js
const { Sequelize } = require('sequelize');
const config = require('../config/config');

const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Sequelize validation errors
  if (err instanceof Sequelize.ValidationError) {
    const errors = err.errors.map(error => ({
      field: error.path,
      message: error.message
    }));
    
    return res.status(400).json({
      error: 'Validation failed',
      details: errors
    });
  }

  // Sequelize unique constraint error
  if (err instanceof Sequelize.UniqueConstraintError) {
    return res.status(400).json({
      error: 'Duplicate entry',
      field: err.errors[0].path,
      message: `${err.errors[0].path} already exists`
    });
  }

  // Sequelize foreign key constraint error
  if (err instanceof Sequelize.ForeignKeyConstraintError) {
    return res.status(400).json({
      error: 'Invalid reference',
      message: 'The referenced item does not exist'
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired'
    });
  }

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File too large',
      message: 'File size must be less than 5MB'
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: 'Invalid file type',
      message: 'Only JPEG, PNG, and WebP images are allowed'
    });
  }

  // Default error
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: config.nodeEnv === 'production' && statusCode === 500 
      ? 'Internal Server Error' 
      : message
  });
};

module.exports = errorHandler;