const db = require("../configs/db");

async function create_default_profile(user_id) {
  const uid = Number(user_id);
  if (!Number.isFinite(uid) || uid <= 0) throw new Error("user_id is invalid");

  const [result] = await db.query(
    `
      INSERT INTO user_profiles (user_id)
      VALUES (?)
    `,
    [uid]
  );

  const [rows] = await db.query(
    `
      SELECT *
      FROM user_profiles
      WHERE id = ?
      LIMIT 1
    `,
    [result.insertId]
  );

  return rows[0] || null;
}

module.exports = {
  create_default_profile,
};
