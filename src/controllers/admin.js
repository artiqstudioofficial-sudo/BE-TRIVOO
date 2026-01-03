const misc = require("../helpers/response");
const { update_verification_status } = require("../models/user");
const { update_agent_verification_status } = require("../models/agent");
const {
  list_agent_users,
  list_customer_users,
  list_agent_products_admin,
  get_agent_product_detail_admin,

  // ✅ campaigns
  create_campaign_admin,
  list_campaigns_admin,
  get_campaign_detail_admin,
  attach_campaign_products_admin,
} = require("../models/admin");

function normalize_verification_action(action) {
  const upper = String(action || "").toUpperCase();
  if (upper === "APPROVE") return "VERIFIED";
  if (upper === "REJECT") return "REJECTED";
  return null;
}

function ensure_admin(req) {
  const user = req?.session?.user || null;

  if (!user) {
    const err = new Error("Unauthorized");
    err.status_code = 401;
    throw err;
  }

  if (user.role !== "ADMIN") {
    const err = new Error("Forbidden");
    err.status_code = 403;
    throw err;
  }

  return user;
}

/** ===== existing ===== */

async function list_agents(req, res) {
  try {
    ensure_admin(req);
    const data = await list_agent_users();
    return misc.response(res, 200, false, "OK", data);
  } catch (err) {
    console.error(err);
    return misc.response(
      res,
      err.status_code || 500,
      true,
      err.message || "Internal server error"
    );
  }
}

async function list_customers(req, res) {
  try {
    ensure_admin(req);
    const data = await list_customer_users();
    return misc.response(res, 200, false, "OK", data);
  } catch (err) {
    console.error(err);
    return misc.response(
      res,
      err.status_code || 500,
      true,
      err.message || "Internal server error"
    );
  }
}

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

    return misc.response(res, 200, false, "OK", result);
  } catch (e) {
    console.error(e);
    return misc.response(
      res,
      e.status_code || 500,
      true,
      e.message || "Internal server error"
    );
  }
}

async function get_agent_product_detail(req, res) {
  try {
    ensure_admin(req);

    const product_id = Number(req.params.product_id);
    if (!Number.isFinite(product_id) || product_id <= 0) {
      return misc.response(res, 400, true, "product_id tidak valid");
    }

    const data = await get_agent_product_detail_admin(product_id);
    if (!data) {
      return misc.response(res, 404, true, "Product not found");
    }

    return misc.response(res, 200, false, "OK", data);
  } catch (e) {
    console.error(e);
    return misc.response(
      res,
      e.status_code || 500,
      true,
      e.message || "Internal server error"
    );
  }
}

async function update_agent_verification(req, res) {
  try {
    ensure_admin(req);

    const user_id = req.params.user_id;
    const { action } = req.body || {};

    const new_status = normalize_verification_action(action);
    if (!new_status) {
      return misc.response(res, 400, true, "action harus APPROVE atau REJECT");
    }

    await update_verification_status(user_id, new_status);
    await update_agent_verification_status(user_id, new_status);

    return misc.response(res, 200, false, `Agent verification ${new_status}`);
  } catch (e) {
    console.error(e);
    return misc.response(
      res,
      e.status_code || 500,
      true,
      e.message || "Internal server error"
    );
  }
}

/** ===== ✅ campaigns ===== */

function normalize_campaign_status(status) {
  const s = String(status || "")
    .toUpperCase()
    .trim();
  if (!s) return "DRAFT";
  if (["DRAFT", "ACTIVE", "ENDED", "CANCELLED"].includes(s)) return s;
  return null;
}

function toNumberOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function ensurePercent(v, fieldName) {
  const n = Number(v);
  if (!Number.isFinite(n)) {
    const err = new Error(`${fieldName} harus angka`);
    err.status_code = 400;
    throw err;
  }
  if (n < 0 || n > 100) {
    const err = new Error(`${fieldName} harus 0..100`);
    err.status_code = 400;
    throw err;
  }
  return n;
}

async function create_campaign(req, res) {
  try {
    const adminUser = ensure_admin(req);

    const {
      name,
      description,
      start_date,
      end_date,
      min_discount_percent,
      agent_fee_percent,
      status,
      product_ids, // optional: array product untuk langsung attach
    } = req.body || {};

    if (!String(name || "").trim()) {
      return misc.response(res, 400, true, "name wajib diisi");
    }
    if (!start_date || !end_date) {
      return misc.response(
        res,
        400,
        true,
        "start_date dan end_date wajib diisi (YYYY-MM-DD)"
      );
    }

    const minDiscount = ensurePercent(
      min_discount_percent ?? 0,
      "min_discount_percent"
    );
    const agentFee = ensurePercent(agent_fee_percent ?? 0, "agent_fee_percent");

    const st = normalize_campaign_status(status);
    if (!st)
      return misc.response(
        res,
        400,
        true,
        "status invalid (DRAFT/ACTIVE/ENDED/CANCELLED)"
      );

    const created = await create_campaign_admin({
      name: String(name).trim(),
      description: description ? String(description) : null,
      start_date: String(start_date),
      end_date: String(end_date),
      min_discount_percent: minDiscount,
      agent_fee_percent: agentFee,
      status: st,
      created_by: adminUser.id,
      product_ids: Array.isArray(product_ids) ? product_ids : null,
    });

    return misc.response(res, 201, false, "Campaign created", created);
  } catch (e) {
    console.error(e);
    return misc.response(
      res,
      e.status_code || 500,
      true,
      e.message || "Internal server error"
    );
  }
}

async function list_campaigns(req, res) {
  try {
    ensure_admin(req);

    const { q, status, page, limit, date } = req.query;

    const result = await list_campaigns_admin({
      q,
      status,
      page,
      limit,
      date, // optional: filter campaign yang aktif pada tanggal tertentu (YYYY-MM-DD)
    });

    return misc.response(res, 200, false, "OK", result);
  } catch (e) {
    console.error(e);
    return misc.response(
      res,
      e.status_code || 500,
      true,
      e.message || "Internal server error"
    );
  }
}

async function get_campaign_detail(req, res) {
  try {
    ensure_admin(req);

    const campaign_id = Number(req.params.campaign_id);
    if (!Number.isFinite(campaign_id) || campaign_id <= 0) {
      return misc.response(res, 400, true, "campaign_id tidak valid");
    }

    const data = await get_campaign_detail_admin(campaign_id);
    if (!data) return misc.response(res, 404, true, "Campaign not found");

    return misc.response(res, 200, false, "OK", data);
  } catch (e) {
    console.error(e);
    return misc.response(
      res,
      e.status_code || 500,
      true,
      e.message || "Internal server error"
    );
  }
}

async function attach_campaign_products(req, res) {
  try {
    ensure_admin(req);

    const campaign_id = Number(req.params.campaign_id);
    if (!Number.isFinite(campaign_id) || campaign_id <= 0) {
      return misc.response(res, 400, true, "campaign_id tidak valid");
    }

    const { product_ids } = req.body || {};
    if (!Array.isArray(product_ids) || product_ids.length === 0) {
      return misc.response(
        res,
        400,
        true,
        "product_ids harus array dan tidak boleh kosong"
      );
    }

    const ids = product_ids
      .map((x) => Number(x))
      .filter((x) => Number.isFinite(x) && x > 0);

    if (ids.length === 0) {
      return misc.response(res, 400, true, "product_ids tidak valid");
    }

    const out = await attach_campaign_products_admin(campaign_id, ids);
    return misc.response(res, 200, false, "Products attached to campaign", out);
  } catch (e) {
    console.error(e);
    return misc.response(
      res,
      e.status_code || 500,
      true,
      e.message || "Internal server error"
    );
  }
}

module.exports = {
  list_agents,
  list_customers,
  list_agent_products,
  get_agent_product_detail,
  update_agent_verification,

  create_campaign,
  list_campaigns,
  get_campaign_detail,
  attach_campaign_products,
};
