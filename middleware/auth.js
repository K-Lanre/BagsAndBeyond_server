const jwt = require('jsonwebtoken');
const { AdminUser } = require('../models');

exports.verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided, authorization denied' });
    }
    
    const token = authHeader.split(' ')[1];
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_change_me_in_prod');
    
    const user = await AdminUser.findByPk(decoded.id);
    
    if (!user || !user.is_active) {
      return res.status(401).json({ message: 'User not found or inactive' });
    }
    
    req.admin = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ message: 'Token is invalid or expired' });
  }
};

exports.isAdmin = (req, res, next) => {
  if (req.admin && (req.admin.role === 'admin' || req.admin.role === 'super_admin')) {
    next();
  } else {
    res.status(403).json({ message: 'Require Admin Role' });
  }
};

exports.isSuperAdmin = (req, res, next) => {
  if (req.admin && req.admin.role === 'super_admin') {
    next();
  } else {
    res.status(403).json({ message: 'Require Super Admin Role' });
  }
};
