// models/admin.js
const conn = require('../configs/db');

/**
 * Ambil semua user dengan role AGENT + info verifikasi
 */
async function listAgentUsers() {
  const sql = `
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      u.verification_status,
      u.specialization,
      av.agent_type,
      up.avatar_url
    FROM users u
    LEFT JOIN agent_verifications av ON av.user_id = u.id
    LEFT JOIN user_profiles up ON up.user_id = u.id
    WHERE u.role = 'AGENT'
    ORDER BY u.created_at DESC
  `;

  const [rows] = await conn.query(sql, []);

  const data = rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    avatar: row.avatar_url || null,
    verificationStatus: row.verification_status, // 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED'
    agentType: row.agent_type || null, // 'INDIVIDUAL' | 'CORPORATE'
    specialization: row.specialization || null, // 'TOUR' | 'STAY' | 'TRANSPORT'
  }));

  return data;
}

/**
 * Ambil semua user dengan role CUSTOMER
 */
async function listCustomerUsers() {
  const sql = `
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      up.avatar_url
    FROM users u
    LEFT JOIN user_profiles up ON up.user_id = u.id
    WHERE u.role = 'CUSTOMER'
    ORDER BY u.created_at DESC
  `;

  const [rows] = await conn.query(sql, []);

  const data = rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    avatar: row.avatar_url || null,
  }));

  return data;
}

module.exports = {
  listAgentUsers,
  listCustomerUsers,
};
