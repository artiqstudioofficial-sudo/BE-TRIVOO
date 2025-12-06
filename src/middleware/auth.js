// src/middlewares/auth.js
const jwt = require('jsonwebtoken');
const misc = require('../helpers/response');
const { findUserById } = require('../models/user');

const JWT_SECRET = process.env.JWT_SECRET;

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return misc.response(res, 401, true, 'Unauthorized');
    }

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await findUserById(payload.id);

    if (!user || !user.is_active) {
      return misc.response(res, 401, true, 'Unauthorized');
    }

    // pasang ke req, biar bisa dipakai di controller lain
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (e) {
    console.error(e);
    return misc.response(res, 401, true, 'Invalid or expired token');
  }
}

module.exports = {
  requireAuth,
};
