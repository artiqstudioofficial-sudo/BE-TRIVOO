// src/models/agent.js
const db = require('../configs/db');

/**
 * data:
 *  - userId
 *  - agentType        (INDIVIDUAL / CORPORATE)
 *  - specialization   (TOUR / TRANSPORT / HOTEL / CAR_RENTAL / OTHER) -> ikut FE
 *  - idCardNumber
 *  - taxId
 *  - companyName
 *  - bankName
 *  - accountNumber    -> mapped ke bank_account_number
 *  - accountHolder    -> mapped ke bank_account_holder
 *  - documentUrl      -> mapped ke id_document_url
 */
async function upsertAgentVerification(data) {
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
    ) VALUES (?,?,?,?,?,?,?,?,?,?, 'PENDING')
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
      updated_at           = CURRENT_TIMESTAMP
  `;

  const params = [
    data.userId,
    data.agentType,
    data.specialization,
    data.idCardNumber,
    data.taxId,
    data.companyName || null,
    data.bankName,
    data.accountNumber,
    data.accountHolder,
    data.documentUrl || null,
  ];

  const [result] = await db.query(sql, params);
  return result;
}

async function findVerificationByUserId(userId) {
  const sql = `
    SELECT
      av.*,
      u.verification_status
    FROM agent_verifications av
    JOIN users u ON u.id = av.user_id
    WHERE av.user_id = ?
    LIMIT 1
  `;

  const [rows] = await db.query(sql, [userId]);
  return rows[0] || null;
}

module.exports = {
  upsertAgentVerification,
  findVerificationByUserId,
};
