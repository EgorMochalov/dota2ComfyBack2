// middleware/auth.js
const jwt = require('jsonwebtoken');
const { User,Team } = require('../models');
const config = require('../config/config');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided.' 
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwtSecret);
    
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['password_hash'] },
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
        error: 'Invalid token. User not found.' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token.' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired.' 
      });
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      error: 'Internal server error during authentication.' 
    });
  }
};

module.exports = authMiddleware;