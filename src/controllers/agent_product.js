// controllers/agentProduct.js
const misc = require('../helpers/response');
const {
  createProduct,
  updateProduct,
  getProductByIdForOwner,
  listProductsByOwner,
} = require('../models/product');

function ensureAgent(req) {
  if (!req.user) {
    const err = new Error('Unauthorized');
    err.statusCode = 401;
    throw err;
  }
  if (req.user.role !== 'AGENT') {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
}

/**
 * GET /api/v1/agent/products
 * List semua produk milik agent (owner)
 */
async function listMyProducts(req, res) {
  try {
    ensureAgent(req);
    const ownerId = req.user.id;

    const data = await listProductsByOwner(ownerId);

    return misc.response(res, 200, false, 'OK', data);
  } catch (e) {
    console.error(e);
    const status = e.statusCode || 500;
    return misc.response(res, status, true, e.message || 'Internal server error');
  }
}

/**
 * GET /api/v1/agent/products/:id
 * Ambil detail satu product milik agent (buat edit)
 */
async function getMyProduct(req, res) {
  try {
    ensureAgent(req);
    const ownerId = req.user.id;
    const productId = parseInt(req.params.id, 10);

    if (!productId || Number.isNaN(productId)) {
      return misc.response(res, 400, true, 'productId tidak valid');
    }

    const product = await getProductByIdForOwner(productId, ownerId);
    if (!product) {
      return misc.response(res, 404, true, 'Product tidak ditemukan');
    }

    return misc.response(res, 200, false, 'OK', product);
  } catch (e) {
    console.error(e);
    const status = e.statusCode || 500;
    return misc.response(res, status, true, e.message || 'Internal server error');
  }
}

/**
 * POST /api/v1/agent/products
 * Create product baru
 */
async function createMyProduct(req, res) {
  try {
    ensureAgent(req);
    const ownerId = req.user.id;

    const {
      categoryId,
      name,
      description,
      price,
      currency,
      location,
      image,
      images,
      features,
      details,
      dailyCapacity,
      blockedDates,
    } = req.body;

    if (!categoryId || !name || !description || !price || !currency || !location) {
      return misc.response(res, 400, true, 'Field wajib belum lengkap');
    }

    const payload = {
      ownerId,
      categoryId: Number(categoryId),
      name,
      description,
      price: Number(price),
      currency,
      location,
      image:
        image ||
        'https://images.unsplash.com/photo-1500835556837-99ac94a94552?auto=format&fit=crop&w=800&q=80',
      images: Array.isArray(images) ? images : [],
      features: Array.isArray(features) ? features : [],
      details: details || null,
      dailyCapacity: dailyCapacity ? Number(dailyCapacity) : 10,
      blockedDates: Array.isArray(blockedDates) ? blockedDates : [],
    };

    const product = await createProduct(payload);

    return misc.response(res, 201, false, 'Product created', product);
  } catch (e) {
    console.error(e);
    const status = e.statusCode || 500;
    return misc.response(res, status, true, e.message || 'Internal server error');
  }
}

/**
 * PUT /api/v1/agent/products/:id
 * Update product milik agent
 */
async function updateMyProduct(req, res) {
  try {
    ensureAgent(req);
    const ownerId = req.user.id;
    const productId = parseInt(req.params.id, 10);

    if (!productId || Number.isNaN(productId)) {
      return misc.response(res, 400, true, 'productId tidak valid');
    }

    const {
      categoryId,
      name,
      description,
      price,
      currency,
      location,
      image,
      images,
      features,
      details,
      dailyCapacity,
      blockedDates,
    } = req.body;

    const payload = {
      ownerId,
      categoryId: Number(categoryId),
      name,
      description,
      price: Number(price),
      currency,
      location,
      image:
        image ||
        'https://images.unsplash.com/photo-1500835556837-99ac94a94552?auto=format&fit=crop&w=800&q=80',
      images: Array.isArray(images) ? images : [],
      features: Array.isArray(features) ? features : [],
      details: details || null,
      dailyCapacity: dailyCapacity ? Number(dailyCapacity) : 10,
      blockedDates: Array.isArray(blockedDates) ? blockedDates : [],
    };

    const product = await updateProduct(productId, ownerId, payload);
    if (!product) {
      return misc.response(res, 404, true, 'Product tidak ditemukan');
    }

    return misc.response(res, 200, false, 'Product updated', product);
  } catch (e) {
    console.error(e);
    if (e.code === 'FORBIDDEN') {
      return misc.response(res, 403, true, 'Tidak boleh mengedit product milik user lain');
    }
    const status = e.statusCode || 500;
    return misc.response(res, status, true, e.message || 'Internal server error');
  }
}

module.exports = {
  listMyProducts,
  getMyProduct,
  createMyProduct,
  updateMyProduct,
};
