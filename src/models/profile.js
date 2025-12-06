const db = require('../configs/db');

async function createDefaultProfile(userId) {
  const [result] = await db.query(
    `INSERT INTO user_profiles (user_id)
     VALUES (?)`,
    [userId],
  );

  const [rows] = await db.query(
    `SELECT *
       FROM user_profiles
      WHERE id = ?`,
    [result.insertId],
  );

  return rows[0];
}

module.exports = {
  createDefaultProfile,
};
