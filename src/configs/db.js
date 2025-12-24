// configs/db.js
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  // lebih tahan idle reset (NAT/WSL/Docker)
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 10_000,
});

function isTransientDbError(err) {
  const code = err?.code;
  return ['ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT', 'EPIPE'].includes(code);
}

/**
 * IMPORTANT:
 * - Model kamu pakai: const [rows] = await conn.query(sql)
 * - Maka query() harus return [rows, fields] persis seperti mysql2/promise.
 */
async function query(sql, params = []) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const conn = await pool.getConnection();
    try {
      // ✅ cegah reuse koneksi pool yang sudah mati
      await conn.ping();

      // ✅ mysql2/promise: return [rows, fields]
      const result = await conn.query(sql, params);
      return result;
    } catch (err) {
      // retry hanya untuk error koneksi transient
      if (isTransientDbError(err) && attempt === 1) {
        // lanjut loop -> ambil koneksi baru
        continue;
      }
      throw err;
    } finally {
      conn.release();
    }
  }
}

// Export object yang punya .query seperti pool,
// biar model yang existing TETAP jalan.
module.exports = {
  query,
  execute: async (sql, params = []) => {
    // execute juga return [rows, fields]
    for (let attempt = 1; attempt <= 2; attempt++) {
      const conn = await pool.getConnection();
      try {
        await conn.ping();
        const result = await conn.execute(sql, params);
        return result;
      } catch (err) {
        if (isTransientDbError(err) && attempt === 1) continue;
        throw err;
      } finally {
        conn.release();
      }
    }
  },
  pool, // opsional kalau kamu butuh akses pool di tempat lain
};
