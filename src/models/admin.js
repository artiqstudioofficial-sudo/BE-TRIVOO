// models/admin.js
const conn = require('../configs/db');

/**
 * Ambil semua user dengan role AGENT + info verifikasi (agent_verifications)
 * - verification bisa null kalau belum submit
 */
async function listAgentUsers() {
  const sql = `
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      u.verification_status,     -- status ringkas di users (kalau kamu pakai)
      u.specialization,          -- specialization default dari user (kalau ada)
      up.avatar_url,

      -- agent_verifications fields (sesuai gambar)
      av.id                 AS av_id,
      av.user_id            AS av_user_id,
      av.agent_type         AS av_agent_type,
      av.id_card_number     AS av_id_card_number,
      av.tax_id             AS av_tax_id,
      av.company_name       AS av_company_name,
      av.bank_name          AS av_bank_name,
      av.bank_account_number AS av_bank_account_number,
      av.bank_account_holder AS av_bank_account_holder,
      av.specialization     AS av_specialization,
      av.id_document_url    AS av_id_document_url,
      av.status             AS av_status,
      av.reviewed_by        AS av_reviewed_by,
      av.reviewed_at        AS av_reviewed_at,
      av.rejection_reason   AS av_rejection_reason,
      av.created_at         AS av_created_at,
      av.updated_at         AS av_updated_at

    FROM users u
    LEFT JOIN agent_verifications av ON av.user_id = u.id
    LEFT JOIN user_profiles up ON up.user_id = u.id
    WHERE u.role = 'AGENT'
    ORDER BY u.created_at DESC
  `;

  const [rows] = await conn.query(sql, []);

  const data = rows.map((row) => {
    const verification =
      row.av_id == null
        ? null
        : {
            id: row.av_id,
            user_id: row.av_user_id,
            agent_type: row.av_agent_type, // 'INDIVIDUAL' | 'CORPORATE'
            id_card_number: row.av_id_card_number,
            tax_id: row.av_tax_id,
            company_name: row.av_company_name,
            bank_name: row.av_bank_name,
            bank_account_number: row.av_bank_account_number,
            bank_account_holder: row.av_bank_account_holder,
            specialization: row.av_specialization, // 'TOUR' | 'STAY' | 'TRANSPORT'
            id_document_url: row.av_id_document_url,
            status: row.av_status, // 'PENDING' | 'APPROVED' | 'REJECTED'
            reviewed_by: row.av_reviewed_by,
            reviewed_at: row.av_reviewed_at,
            rejection_reason: row.av_rejection_reason,
            created_at: row.av_created_at,
            updated_at: row.av_updated_at,
          };

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      avatar: row.avatar_url || null,

      // status di users (kalau masih kamu pakai)
      verification_status: row.verification_status, // 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED'

      // specialization dari user (bisa dipakai untuk fallback)
      specialization: row.specialization || null,

      // detail verifikasi dari tabel agent_verifications
      verification, // bisa null
    };
  });

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
