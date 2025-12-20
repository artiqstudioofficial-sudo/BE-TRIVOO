// src/models/agent.js
const db = require('../configs/db');

/**
 * Normalisasi & safety helpers
 */
const AGENT_TYPES = new Set(['INDIVIDUAL', 'CORPORATE']);
const SPECIALIZATIONS = new Set(['TOUR', 'STAY', 'TRANSPORT']);
const VERIF_STATUS = new Set(['PENDING', 'APPROVED', 'VERIFIED', 'REJECTED']);

function pickEnum(val, set, fallback) {
  const v = String(val || '').toUpperCase();
  return set.has(v) ? v : fallback;
}

function normalizeUpsertPayload(data) {
  if (!data) throw new Error('payload is required');
  if (!data.userId) throw new Error('userId is required');

  const userId = Number(data.userId);
  if (!Number.isFinite(userId) || userId <= 0) throw new Error('userId is invalid');

  const agentType = pickEnum(data.agentType, AGENT_TYPES, 'INDIVIDUAL');
  const specialization = pickEnum(data.specialization, SPECIALIZATIONS, 'TOUR');

  const idCardNumber = String(data.idCardNumber || '').trim();
  const taxId = String(data.taxId || '').trim();
  const bankName = String(data.bankName || '').trim();
  const accountNumber = String(data.accountNumber || '').trim();
  const accountHolder = String(data.accountHolder || '').trim();

  if (!idCardNumber) throw new Error('idCardNumber is required');
  if (!taxId) throw new Error('taxId is required');
  if (!bankName) throw new Error('bankName is required');
  if (!accountNumber) throw new Error('accountNumber is required');
  if (!accountHolder) throw new Error('accountHolder is required');

  const companyName = data.companyName ? String(data.companyName).trim() : null;
  const documentUrl = data.documentUrl ? String(data.documentUrl).trim() : null;

  return {
    userId,
    agentType,
    specialization,
    idCardNumber,
    taxId,
    companyName,
    bankName,
    accountNumber,
    accountHolder,
    documentUrl,
  };
}

/**
 * Upsert Agent Verification
 * - insert/update record agent_verifications untuk user
 * - status selalu PENDING ketika submit ulang
 * - reset reviewed_by / reviewed_at / rejection_reason
 */
async function upsertAgentVerification(payload) {
  const data = normalizeUpsertPayload(payload);

  const sql = `
    INSERT INTO agent_verifications (
      user_id,
      agent_type,
      specialization,
      id_card_number,
      tax_id,
      company_name,
      bank_name,
      bank_account_number,
      bank_account_holder,
      id_document_url,
      status
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING'
    )
    ON DUPLICATE KEY UPDATE
      agent_type           = VALUES(agent_type),
      specialization       = VALUES(specialization),
      id_card_number       = VALUES(id_card_number),
      tax_id               = VALUES(tax_id),
      company_name         = VALUES(company_name),
      bank_name            = VALUES(bank_name),
      bank_account_number  = VALUES(bank_account_number),
      bank_account_holder  = VALUES(bank_account_holder),
      id_document_url      = VALUES(id_document_url),
      status               = 'PENDING',
      rejection_reason     = NULL,
      reviewed_at          = NULL,
      reviewed_by          = NULL,
      updated_at           = CURRENT_TIMESTAMP
  `;

  const params = [
    data.userId,
    data.agentType,
    data.specialization,
    data.idCardNumber,
    data.taxId,
    data.companyName,
    data.bankName,
    data.accountNumber,
    data.accountHolder,
    data.documentUrl,
  ];

  const [result] = await db.query(sql, params);
  return result;
}

/**
 * Ambil verification terbaru user (kalau suatu saat ada multi-row)
 * plus join verification_status dari users
 */
async function findVerificationByUserId(userId) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) throw new Error('userId is invalid');

  const sql = `
    SELECT
      av.*,
      u.verification_status
    FROM agent_verifications av
    JOIN users u ON u.id = av.user_id
    WHERE av.user_id = ?
    ORDER BY av.id DESC
    LIMIT 1
  `;

  const [rows] = await db.query(sql, [uid]);
  return rows[0] || null;
}

/**
 * Update status agent_verifications saja
 * (biasanya dipanggil internal dalam transaksi yang juga update users.verification_status)
 */
async function updateAgentVerificationStatus(userId, status) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) throw new Error('userId is invalid');

  const st = String(status || '').toUpperCase();
  console.log(st);
  if (!VERIF_STATUS.has(st)) throw new Error('Invalid verification status');

  const sql = `
    UPDATE agent_verifications
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `;

  const [result] = await db.query(sql, [st, uid]);
  return result;
}

/**
 * BEST: keputusan admin approve/reject dalam 1 transaksi:
 * - update agent_verifications (status, reviewed_by, reviewed_at, rejection_reason)
 * - update users.verification_status (PENDING/VERIFIED/REJECTED)
 */
async function setAgentVerificationDecision({
  userId,
  action, // 'APPROVE' | 'REJECT'
  reviewedBy = null,
  rejectionReason = null,
}) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) throw new Error('userId is invalid');

  const act = String(action || '').toUpperCase();
  if (!['APPROVE', 'REJECT'].includes(act)) throw new Error('action must be APPROVE or REJECT');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // pastikan verification ada
    const [vrows] = await conn.query(
      `SELECT id FROM agent_verifications WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
      [uid],
    );
    if (!vrows[0]) {
      throw new Error('Agent verification not found for this user');
    }

    if (act === 'APPROVE') {
      await conn.query(
        `
        UPDATE agent_verifications
        SET
          status = 'APPROVED',
          reviewed_by = ?,
          reviewed_at = CURRENT_TIMESTAMP,
          rejection_reason = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
        `,
        [reviewedBy, uid],
      );

      await conn.query(
        `
        UPDATE users
        SET verification_status = 'VERIFIED', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [uid],
      );
    } else {
      const reason = rejectionReason ? String(rejectionReason).trim() : 'Rejected by admin';

      await conn.query(
        `
        UPDATE agent_verifications
        SET
          status = 'REJECTED',
          reviewed_by = ?,
          reviewed_at = CURRENT_TIMESTAMP,
          rejection_reason = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
        `,
        [reviewedBy, reason, uid],
      );

      await conn.query(
        `
        UPDATE users
        SET verification_status = 'REJECTED', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [uid],
      );
    }

    await conn.commit();
    return { ok: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * Admin: list semua AGENT lengkap avatar + verification object (bisa null)
 * Output disusun mirip response yang kamu kasih:
 * {
 *   id, name, email, role, avatar, verification_status, specialization,
 *   verification: {...} | null
 * }
 */
async function listAgentUsersWithVerification() {
  const sql = `
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      u.verification_status,
      u.specialization AS user_specialization,
      up.avatar_url AS avatar,

      av.id            AS v_id,
      av.user_id       AS v_user_id,
      av.agent_type    AS v_agent_type,
      av.id_card_number AS v_id_card_number,
      av.tax_id        AS v_tax_id,
      av.company_name  AS v_company_name,
      av.bank_name     AS v_bank_name,
      av.bank_account_number AS v_bank_account_number,
      av.bank_account_holder AS v_bank_account_holder,
      av.specialization AS v_specialization,
      av.id_document_url AS v_id_document_url,
      av.status        AS v_status,
      av.reviewed_by   AS v_reviewed_by,
      av.reviewed_at   AS v_reviewed_at,
      av.rejection_reason AS v_rejection_reason,
      av.created_at    AS v_created_at,
      av.updated_at    AS v_updated_at
    FROM users u
    LEFT JOIN user_profiles up
      ON up.user_id = u.id
    LEFT JOIN agent_verifications av
      ON av.user_id = u.id
     AND av.id = (
       SELECT av2.id
       FROM agent_verifications av2
       WHERE av2.user_id = u.id
       ORDER BY av2.id DESC
       LIMIT 1
     )
    WHERE u.role = 'AGENT'
    ORDER BY u.created_at DESC
  `;

  const [rows] = await db.query(sql);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    avatar: r.avatar || null,
    verification_status: r.verification_status,
    specialization: r.user_specialization || null,

    verification: r.v_id
      ? {
          id: r.v_id,
          user_id: r.v_user_id,
          agent_type: r.v_agent_type,
          id_card_number: r.v_id_card_number,
          tax_id: r.v_tax_id,
          company_name: r.v_company_name,
          bank_name: r.v_bank_name,
          bank_account_number: r.v_bank_account_number,
          bank_account_holder: r.v_bank_account_holder,
          specialization: r.v_specialization,
          id_document_url: r.v_id_document_url,
          status: r.v_status,
          reviewed_by: r.v_reviewed_by,
          reviewed_at: r.v_reviewed_at,
          rejection_reason: r.v_rejection_reason,
          created_at: r.v_created_at,
          updated_at: r.v_updated_at,
        }
      : null,
  }));
}

module.exports = {
  upsertAgentVerification,
  findVerificationByUserId,
  updateAgentVerificationStatus,

  // best admin helpers
  setAgentVerificationDecision,
  listAgentUsersWithVerification,
};
