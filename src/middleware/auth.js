// middlewares/auth.js
const jwt = require('jsonwebtoken');
const misc = require('../helpers/response');

const JWT_SECRET = process.env.JWT_SECRET;

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    return misc.response(res, 401, true, 'Unauthorized');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    console.error(e);
    return misc.response(res, 401, true, 'Invalid token');
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return misc.response(res, 403, true, 'Forbidden: Admin only');
  }
  next();
}

module.exports = {
  requireAuth,
  requireAdmin,
};
