// controllers/admin.js
const misc = require('../helpers/response');
const { updateVerificationStatus } = require('../models/user');
const { updateAgentVerificationStatus } = require('../models/agent');
const { listAgentUsers, listCustomerUsers } = require('../models/admin');

function normalizeVerificationAction(action) {
  const upper = String(action || '').toUpperCase();
  if (upper === 'APPROVE') return 'VERIFIED';
  if (upper === 'REJECT') return 'REJECTED';
  return null;
}

module.exports = {
  // GET /api/v1/admin/users/agents
  listAgents: async (req, res) => {
    try {
      const data = await listAgentUsers();
      return misc.response(res, 200, false, 'OK', data);
    } catch (err) {
      console.error(err);
      return misc.response(res, 500, true, err.message || 'Internal server error');
    }
  },

  // GET /api/v1/admin/users/customers
  listCustomers: async (req, res) => {
    try {
      const data = await listCustomerUsers();
      console.log(data);
      return misc.response(res, 200, false, 'OK', data);
    } catch (err) {
      console.error(err);
      return misc.response(res, 500, true, err.message || 'Internal server error');
    }
  },

  // PATCH /api/v1/admin/users/:userId/verification
  updateAgentVerification: async (req, res) => {
    try {
      const userId = parseInt(req.params.userId, 10);
      const { action } = req.body;

      if (!userId || Number.isNaN(userId)) {
        return misc.response(res, 400, true, 'userId tidak valid');
      }

      const newStatus = normalizeVerificationAction(action);
      if (!newStatus) {
        return misc.response(res, 400, true, 'action harus APPROVE atau REJECT');
      }

      // Update users.verification_status
      await updateVerificationStatus(userId, newStatus);

      // Update agent_verifications.status juga (kalau ada)
      await updateAgentVerificationStatus(userId, newStatus);

      return misc.response(res, 200, false, `Agent verification ${newStatus}`);
    } catch (e) {
      console.error(e);
      return misc.response(res, 500, true, e.message || 'Internal server error');
    }
  },
};
