const bcrypt = require('bcryptjs');
const misc = require('../helpers/response');
const { findUserByEmail, createUser, findUserById } = require('../models/user');
const { createDefaultProfile } = require('../models/profile');

require('dotenv').config();

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

function setSessionUser(req, user) {
  req.session.user = {
    id: user.id,
    email: user.email,
    role: user.role,
    specialization: user.specialization ?? null,
    name: user.name ?? null,
  };
}

module.exports = {
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

      const newUser = await createUser({
        name,
        email,
        passwordHash,
        role: normRole,
        specialization: normSpec,
      });

      try {
        await createDefaultProfile(newUser.id);
      } catch (e) {
        console.error('Failed to create default profile for user', newUser.id, e.message);
      }

      // ✅ set session (tersimpan di Redis)
      setSessionUser(req, newUser);

      // optional: pastiin session tersave sebelum response
      req.session.save((err) => {
        if (err) {
          console.error('[SESSION] save error:', err);
          return misc.response(res, 500, true, 'Failed to create session');
        }

        // kalau createUser kamu sudah aman, boleh return newUser,
        // tapi kalau ada field sensitif, bikin safeUser dulu.
        return misc.response(res, 201, false, 'Register successfully', {
          user: req.session.user,
        });
      });
    } catch (e) {
      console.error(e);
      return misc.response(res, 500, true, e.message || 'Internal server error');
    }
  },

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

      // ✅ rotate session id (anti session fixation)
      req.session.regenerate((regenErr) => {
        if (regenErr) {
          console.error('[SESSION] regenerate error:', regenErr);
          return misc.response(res, 500, true, 'Failed to create session');
        }

        // ✅ set session user (tersimpan di Redis)
        setSessionUser(req, user);

        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('[SESSION] save error:', saveErr);
            return misc.response(res, 500, true, 'Failed to persist session');
          }

          return misc.response(res, 200, false, 'Login successfully', {
            user: req.session.user,
          });
        });
      });
    } catch (e) {
      console.error(e);
      return misc.response(res, 500, true, e.message || 'Internal server error');
    }
  },

  me: async (req, res) => {
    try {
      // middleware requireAuth kamu bisa set req.user
      // tapi sumber utama sekarang: req.session.user
      const userId = req.session?.user?.id || req.user?.id;

      if (!userId) {
        return misc.response(res, 401, true, 'Unauthorized');
      }

      const user = await findUserById(userId);
      if (!user) {
        return misc.response(res, 404, true, 'User not found');
      }

      const { password_hash, ...safeUser } = user;

      return misc.response(res, 200, false, 'OK', {
        user: safeUser,
      });
    } catch (e) {
      console.error(e);
      return misc.response(res, 500, true, e.message || 'Internal server error');
    }
  },

  logout: async (req, res) => {
    try {
      if (!req.session) {
        return misc.response(res, 200, false, 'Logged out');
      }

      req.session.destroy((err) => {
        if (err) {
          console.error('[SESSION] destroy error:', err);
          return misc.response(res, 500, true, 'Failed to logout');
        }

        // cookie name harus sama dengan di session config: name: "sid"
        res.clearCookie('sid');
        return misc.response(res, 200, false, 'Logged out');
      });
    } catch (e) {
      console.error(e);
      return misc.response(res, 500, true, e.message || 'Internal server error');
    }
  },
};
