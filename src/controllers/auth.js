// src/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const misc = require('../helpers/response');
const { findUserByEmail, createUser } = require('../models/user');
const { createDefaultProfile } = require('../models/profile');

require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';

// Normalisasi role & specialization dari frontend
function normalizeRole(role) {
  const allowed = ['CUSTOMER', 'AGENT', 'ADMIN'];
  if (!role) return 'CUSTOMER';
  const upper = String(role).toUpperCase();
  return allowed.includes(upper) ? upper : 'CUSTOMER';
}

function normalizeSpecialization(role, specialization) {
  if (role !== 'AGENT') return null;
  const allowed = ['TOUR', 'STAY', 'TRANSPORT'];
  if (!specialization) return null;
  const upper = String(specialization).toUpperCase();
  return allowed.includes(upper) ? upper : null;
}

module.exports = {
  // POST /api/v1/auth/register
  register: async (req, res) => {
    try {
      const { name, email, password, role, specialization } = req.body;

      if (!name || !email || !password) {
        return misc.response(res, 400, true, 'name, email, dan password wajib diisi');
      }

      const existing = await findUserByEmail(email);
      if (existing) {
        return misc.response(res, 409, true, 'Email sudah terdaftar');
      }

      const normRole = normalizeRole(role);
      const normSpec = normalizeSpecialization(normRole, specialization);

      const passwordHash = await bcrypt.hash(password, 10);

      // 1) buat user
      const newUser = await createUser({
        name,
        email,
        passwordHash,
        role: normRole,
        specialization: normSpec,
      });

      // 2) buat profile default (tidak wajib gagal kalau profile error kecil)
      try {
        await createDefaultProfile(newUser.id);
      } catch (e) {
        console.error('Failed to create default profile for user', newUser.id, e.message);
        // tidak di-throw, supaya user tetap berhasil register walau profil gagal
      }

      const token = jwt.sign(
        { id: newUser.id, email: newUser.email, role: newUser.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN },
      );

      return misc.response(res, 201, false, 'Register successfully', {
        token,
        user: newUser,
      });
    } catch (e) {
      console.error(e);
      return misc.response(res, 500, true, e.message || 'Internal server error');
    }
  },

  // POST /api/v1/auth/login
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return misc.response(res, 400, true, 'email dan password wajib diisi');
      }

      const user = await findUserByEmail(email);
      if (!user) {
        return misc.response(res, 401, true, 'Email atau password salah');
      }

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return misc.response(res, 401, true, 'Email atau password salah');
      }

      if (!user.is_active) {
        return misc.response(res, 403, true, 'Akun tidak aktif');
      }

      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      });

      const { password_hash, ...safeUser } = user;

      return misc.response(res, 200, false, 'Login successfully', {
        token,
        user: safeUser,
      });
    } catch (e) {
      console.error(e);
      return misc.response(res, 500, true, e.message || 'Internal server error');
    }
  },
};
