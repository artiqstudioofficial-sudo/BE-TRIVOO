const db = require('../configs/db');

async function findUserByEmail(email) {
  const [rows] = await db.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  return rows[0] || null;
}

async function createUser({ name, email, passwordHash, role, specialization }) {
  const [result] = await db.query(
    `INSERT INTO users (name, email, password_hash, role, specialization)
     VALUES (?, ?, ?, ?, ?)`,
    [name, email, passwordHash, role, specialization],
  );

  const [rows] = await db.query(
    'SELECT id, name, email, role, specialization, is_active, created_at FROM users WHERE id = ?',
    [result.insertId],
  );

  return rows[0];
}

module.exports = {
  findUserByEmail,
  createUser,
};
