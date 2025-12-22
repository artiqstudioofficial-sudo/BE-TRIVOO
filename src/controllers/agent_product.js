const misc = require('../helpers/response');
const {
  create_product,
  update_product,
  get_product_by_id_for_owner,
  list_products_by_owner,
} = require('../models/product');

// ----------------- session helpers -----------------
function get_session_user(req) {
  return req?.session?.user || null;
}

function ensure_agent(req) {
  const user = get_session_user(req);

  if (!user) {
    const err = new Error('Unauthorized');
    err.status_code = 401;
    throw err;
  }

  if (user.role !== 'AGENT') {
    const err = new Error('Forbidden');
    err.status_code = 403;
    throw err;
  }

  return user;
}

// ----------------- utils -----------------
function to_number_or_null(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function to_number_or_default(v, def) {
  const n = to_number_or_null(v);
  return n === null ? def : n;
}

function ensure_array(v) {
  return Array.isArray(v) ? v : [];
}

// ----------------- handlers -----------------

/**
 * GET /api/v1/agent/products
 * (dulu: /my, sekarang bisa kamu samain aja)
 */
async function list_my_products(req, res) {
  try {
    const user = ensure_agent(req);
    const data = await list_products_by_owner(user.id);
    return misc.response(res, 200, false, 'OK', data);
  } catch (e) {
    console.error(e);
    return misc.response(res, e.status_code || 500, true, e.message || 'Internal server error');
  }
}

/**
 * GET /api/v1/agent/products/:id
 */
async function get_my_product(req, res) {
  try {
    const user = ensure_agent(req);
    const product_id = Number.parseInt(req.params.id, 10);

    if (!product_id) {
      return misc.response(res, 400, true, 'product_id tidak valid');
    }

    const product = await get_product_by_id_for_owner(product_id, user.id);
    if (!product) {
      return misc.response(res, 404, true, 'Product tidak ditemukan');
    }

    return misc.response(res, 200, false, 'OK', product);
  } catch (e) {
    console.error(e);
    return misc.response(res, e.status_code || 500, true, e.message || 'Internal server error');
  }
}

/**
 * POST /api/v1/agent/products
 */
async function create_my_product(req, res) {
  try {
    const user = ensure_agent(req);

    const {
      category_id,
      name,
      description,
      price,
      currency,
      location,
      image_url,
      images,
      features,
      details,
      daily_capacity,
      blocked_dates,
    } = req.body || {};

    if (!category_id || !name || !description || price == null || !currency || !location) {
      return misc.response(res, 400, true, 'Field wajib belum lengkap');
    }

    const payload = {
      owner_id: user.id,
      category_id: Number(category_id),
      name: String(name).trim(),
      description: String(description).trim(),
      price: Number(price),
      currency: String(currency).trim(),
      location: String(location).trim(),
      image_url:
        image_url ||
        'https://images.unsplash.com/photo-1500835556837-99ac94a94552?auto=format&fit=crop&w=800&q=80',
      images: ensure_array(images),
      features: ensure_array(features),
      details: details || null,
      daily_capacity: to_number_or_default(daily_capacity, 10),
      blocked_dates: ensure_array(blocked_dates),
    };

    const product = await create_product(payload);
    return misc.response(res, 201, false, 'Product created', product);
  } catch (e) {
    console.error(e);
    return misc.response(res, e.status_code || 500, true, e.message || 'Internal server error');
  }
}

/**
 * PUT /api/v1/agent/products/:id
 */
async function update_my_product(req, res) {
  try {
    const user = ensure_agent(req);
    const product_id = Number.parseInt(req.params.id, 10);

    if (!product_id) {
      return misc.response(res, 400, true, 'product_id tidak valid');
    }

    const payload = {
      owner_id: user.id,
      category_id: Number(req.body?.category_id),
      name: req.body?.name,
      description: req.body?.description,
      price: Number(req.body?.price),
      currency: req.body?.currency,
      location: req.body?.location,
      image_url: req.body?.image_url,
      images: ensure_array(req.body?.images),
      features: ensure_array(req.body?.features),
      details: req.body?.details || null,
      daily_capacity: to_number_or_default(req.body?.daily_capacity, 10),
      blocked_dates: ensure_array(req.body?.blocked_dates),
    };

    const product = await update_product(product_id, user.id, payload);
    if (!product) {
      return misc.response(res, 404, true, 'Product tidak ditemukan');
    }

    return misc.response(res, 200, false, 'Product updated', product);
  } catch (e) {
    console.error(e);
    return misc.response(res, e.status_code || 500, true, e.message || 'Internal server error');
  }
}

module.exports = {
  list_my_products,
  get_my_product,
  create_my_product,
  update_my_product,
};
