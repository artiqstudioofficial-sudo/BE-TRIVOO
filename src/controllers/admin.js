const misc = require('../helpers/response');
const { update_verification_status } = require('../models/user');
const { update_agent_verification_status } = require('../models/agent');
const { list_agent_users, list_customer_users } = require('../models/admin');
const { list_agent_products_admin } = require('../models/admin_product');
const { delete_product_for_owner } = require('../models/product');

// ----------------- helpers -----------------
function normalize_verification_action(action) {
  const upper = String(action || '').toUpperCase();
  if (upper === 'APPROVE') return 'VERIFIED';
  if (upper === 'REJECT') return 'REJECTED';
  return null;
}

function ensure_admin(req) {
  const user = req?.session?.user || null;

  if (!user) {
    const err = new Error('Unauthorized');
    err.status_code = 401;
    throw err;
  }

  if (user.role !== 'ADMIN') {
    const err = new Error('Forbidden');
    err.status_code = 403;
    throw err;
  }

  return user;
}

// ----------------- handlers -----------------
async function list_agents(req, res) {
  try {
    ensure_admin(req);
    const data = await list_agent_users();
    return misc.response(res, 200, false, 'OK', data);
  } catch (err) {
    console.error(err);
    return misc.response(res, err.status_code || 500, true, err.message || 'Internal server error');
  }
}

async function list_customers(req, res) {
  try {
    ensure_admin(req);
    const data = await list_customer_users();
    return misc.response(res, 200, false, 'OK', data);
  } catch (err) {
    console.error(err);
    return misc.response(res, err.status_code || 500, true, err.message || 'Internal server error');
  }
}

/**
 * GET /api/v1/admin/agent-products?owner_id=&q=&page=&limit=
 */
async function list_agent_products(req, res) {
  try {
    ensure_admin(req);

    const { owner_id, q, page, limit } = req.query;

    const result = await list_agent_products_admin({
      owner_id,
      q,
      page,
      limit,
    });

    return misc.response(res, 200, false, 'OK', result);
  } catch (e) {
    console.error(e);
    return misc.response(res, e.status_code || 500, true, e.message || 'Internal server error');
  }
}

/**
 * PATCH /api/v1/admin/users/:user_id/verification
 * body: { action: "APPROVE" | "REJECT" }
 */
async function update_agent_verification(req, res) {
  try {
    ensure_admin(req);

    const user_id = req.params.user_id;
    const { action } = req.body || {};

    const new_status = normalize_verification_action(action);
    if (!new_status) {
      return misc.response(res, 400, true, 'action harus APPROVE atau REJECT');
    }

    await update_verification_status(user_id, new_status);

    await update_agent_verification_status(user_id, new_status);

    return misc.response(res, 200, false, `Agent verification ${new_status}`);
  } catch (e) {
    console.error(e);
    return misc.response(res, e.status_code || 500, true, e.message || 'Internal server error');
  }
}
module.exports = {
  list_agents,
  list_customers,
  list_agent_products,
  update_agent_verification,
};
