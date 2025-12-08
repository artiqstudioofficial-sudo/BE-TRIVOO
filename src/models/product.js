// models/product.js
const conn = require('../configs/db');

/**
 * Helper kecil untuk query dengan Promise
 */
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    conn.query(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function safeParseJSON(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
}

/**
 * Ambil satu product row mentah (tanpa images/blocked_dates)
 */
async function findProductRowById(productId) {
  const rows = await query(
    `
      SELECT
        p.*
      FROM products p
      WHERE p.id = ?
      LIMIT 1
    `,
    [productId],
  );

  return rows[0] || null;
}

/**
 * Ambil semua gallery images untuk product
 */
async function findProductImages(productId) {
  const rows = await query(
    `
      SELECT
        image_url
      FROM product_images
      WHERE product_id = ?
      ORDER BY sort_order ASC, id ASC
    `,
    [productId],
  );

  return rows.map((r) => r.image_url);
}

/**
 * Ambil semua blocked dates untuk product
 */
async function findProductBlockedDates(productId) {
  const rows = await query(
    `
      SELECT
        DATE_FORMAT(blocked_date, '%Y-%m-%d') AS blocked_date
      FROM product_blocked_dates
      WHERE product_id = ?
      ORDER BY blocked_date ASC
    `,
    [productId],
  );

  return rows.map((r) => r.blocked_date);
}

/**
 * Map row + images + blockedDates ke shape FE Product
 */
async function buildProductResponse(row) {
  if (!row) return null;

  const images = await findProductImages(row.id);
  const blockedDates = await findProductBlockedDates(row.id);

  const features = safeParseJSON(row.features, []);
  const details = safeParseJSON(row.details, null);

  return {
    id: row.id,
    ownerId: row.owner_id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    currency: row.currency,
    location: row.location,
    image: row.image_url,
    images,
    features,
    details,
    dailyCapacity: row.daily_capacity,
    blockedDates,
    rating: row.rating ? Number(row.rating) : 0,
    isActive: !!row.is_active,
    createdAt: row.created_at,
  };
}

/**
 * Create product baru
 * payload: {
 *   ownerId, categoryId, name, description, price, currency,
 *   location, image, images, features, details, dailyCapacity,
 *   blockedDates
 * }
 */
async function createProduct(payload) {
  // Insert ke products
  const result = await query(
    `
      INSERT INTO products (
        owner_id,
        category_id,
        name,
        description,
        price,
        currency,
        location,
        image_url,
        features,
        details,
        daily_capacity
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `,
    [
      payload.ownerId,
      payload.categoryId,
      payload.name,
      payload.description,
      payload.price,
      payload.currency,
      payload.location,
      payload.image,
      payload.features ? JSON.stringify(payload.features) : null,
      payload.details ? JSON.stringify(payload.details) : null,
      payload.dailyCapacity || 10,
    ],
  );

  const productId = result.insertId;

  // Gallery images
  if (Array.isArray(payload.images) && payload.images.length > 0) {
    for (let i = 0; i < payload.images.length; i += 1) {
      const img = payload.images[i];
      await query(
        `
          INSERT INTO product_images (product_id, image_url, sort_order)
          VALUES (?,?,?)
        `,
        [productId, img, i],
      );
    }
  }

  // Blocked dates
  if (Array.isArray(payload.blockedDates) && payload.blockedDates.length > 0) {
    for (const date of payload.blockedDates) {
      await query(
        `
          INSERT IGNORE INTO product_blocked_dates (product_id, blocked_date)
          VALUES (?,?)
        `,
        [productId, date],
      );
    }
  }

  const row = await findProductRowById(productId);
  return buildProductResponse(row);
}

/**
 * Update product milik owner tertentu
 */
async function updateProduct(productId, ownerId, payload) {
  // Pastikan product milik owner
  const existing = await findProductRowById(productId);
  if (!existing) return null;
  if (existing.owner_id !== ownerId) {
    // Bukan punya dia
    const err = new Error('Forbidden');
    err.code = 'FORBIDDEN';
    throw err;
  }

  await query(
    `
      UPDATE products
      SET
        category_id   = ?,
        name          = ?,
        description   = ?,
        price         = ?,
        currency      = ?,
        location      = ?,
        image_url     = ?,
        features      = ?,
        details       = ?,
        daily_capacity = ?,
        updated_at    = CURRENT_TIMESTAMP
      WHERE id = ? AND owner_id = ?
    `,
    [
      payload.categoryId,
      payload.name,
      payload.description,
      payload.price,
      payload.currency,
      payload.location,
      payload.image,
      payload.features ? JSON.stringify(payload.features) : null,
      payload.details ? JSON.stringify(payload.details) : null,
      payload.dailyCapacity || 10,
      productId,
      ownerId,
    ],
  );

  // Refresh gallery
  await query(`DELETE FROM product_images WHERE product_id = ?`, [productId]);
  if (Array.isArray(payload.images) && payload.images.length > 0) {
    for (let i = 0; i < payload.images.length; i += 1) {
      const img = payload.images[i];
      await query(
        `
          INSERT INTO product_images (product_id, image_url, sort_order)
          VALUES (?,?,?)
        `,
        [productId, img, i],
      );
    }
  }

  // Refresh blocked dates
  await query(`DELETE FROM product_blocked_dates WHERE product_id = ?`, [productId]);
  if (Array.isArray(payload.blockedDates) && payload.blockedDates.length > 0) {
    for (const date of payload.blockedDates) {
      await query(
        `
          INSERT IGNORE INTO product_blocked_dates (product_id, blocked_date)
          VALUES (?,?)
        `,
        [productId, date],
      );
    }
  }

  const row = await findProductRowById(productId);
  return buildProductResponse(row);
}

/**
 * Ambil product milik owner tertentu (buat edit)
 */
async function getProductByIdForOwner(productId, ownerId) {
  const row = await findProductRowById(productId);
  if (!row) return null;
  if (row.owner_id !== ownerId) return null;
  return buildProductResponse(row);
}

/**
 * List semua product milik owner tertentu
 * (bisa dipakai di halaman /agent/products)
 */
async function listProductsByOwner(ownerId) {
  const rows = await query(
    `
      SELECT
        p.id,
        p.owner_id,
        p.category_id,
        p.name,
        p.description,
        p.price,
        p.currency,
        p.location,
        p.image_url,
        p.daily_capacity,
        p.rating,
        p.is_active,
        p.created_at
      FROM products p
      WHERE p.owner_id = ?
      ORDER BY p.created_at DESC
    `,
    [ownerId],
  );

  return rows.map((row) => ({
    id: row.id,
    ownerId: row.owner_id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    currency: row.currency,
    location: row.location,
    image: row.image_url,
    dailyCapacity: row.daily_capacity,
    rating: row.rating ? Number(row.rating) : 0,
    isActive: !!row.is_active,
    createdAt: row.created_at,
  }));
}

module.exports = {
  createProduct,
  updateProduct,
  getProductByIdForOwner,
  listProductsByOwner,
};
