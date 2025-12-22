// models/admin_products.js
const db = require('../configs/db');

/**
 * Admin: list semua produk milik agent
 * Support:
 *  - owner_id
 *  - q (search name/location)
 *  - page, limit
 */
async function list_agent_products_admin(params = {}) {
  const owner_id = params.owner_id ? Number(params.owner_id) : null;
  const q = params.q ? String(params.q).trim() : '';
  const page = params.page ? Math.max(1, Number(params.page)) : 1;
  const limit = params.limit ? Math.min(100, Math.max(1, Number(params.limit))) : 20;
  const offset = (page - 1) * limit;

  const where = [`u.role = 'AGENT'`];
  const values = [];

  if (owner_id && Number.isFinite(owner_id)) {
    where.push(`p.owner_id = ?`);
    values.push(owner_id);
  }

  if (q) {
    where.push(`(p.name LIKE ? OR p.location LIKE ?)`);
    values.push(`%${q}%`, `%${q}%`);
  }

  const where_sql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // ===== total count =====
  const count_sql = `
    SELECT COUNT(DISTINCT p.id) AS total
    FROM products p
    JOIN users u ON u.id = p.owner_id
    ${where_sql}
  `;

  const [count_rows] = await db.query(count_sql, values);
  const total = Number(count_rows?.[0]?.total || 0);

  // ===== list data =====
  const sql = `
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
      p.features,
      p.details,
      p.daily_capacity,
      p.rating,
      p.is_active,
      p.created_at,
      p.updated_at,

      u.name AS owner_name,
      u.email AS owner_email,
      up.avatar_url AS owner_avatar,

      GROUP_CONCAT(
        pi.image_url
        ORDER BY pi.sort_order
        SEPARATOR '||'
      ) AS gallery_images

    FROM products p
    JOIN users u ON u.id = p.owner_id
    LEFT JOIN user_profiles up ON up.user_id = u.id
    LEFT JOIN product_images pi ON pi.product_id = p.id

    ${where_sql}
    GROUP BY p.id
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await db.query(sql, [...values, limit, offset]);

  const data = rows.map((r) => ({
    id: r.id,
    owner_id: r.owner_id,
    category_id: r.category_id,
    name: r.name,
    description: r.description,
    price: Number(r.price),
    currency: r.currency,
    location: r.location,
    image_url: r.image_url,
    images: split_gallery(r.gallery_images),
    features: safe_json_array(r.features),
    details: safe_json_object(r.details),
    daily_capacity: r.daily_capacity != null ? Number(r.daily_capacity) : null,
    rating: r.rating != null ? Number(r.rating) : 0,
    is_active: !!r.is_active,
    created_at: r.created_at,
    updated_at: r.updated_at,

    owner: {
      id: r.owner_id,
      name: r.owner_name,
      email: r.owner_email,
      avatar_url: r.owner_avatar || null,
    },
  }));

  return {
    meta: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
    data,
  };
}

/* ================= helpers ================= */

function split_gallery(v) {
  if (!v) return [];
  return String(v).split('||').filter(Boolean);
}

function safe_json_array(v) {
  if (Array.isArray(v)) return v;
  if (v == null || v === '') return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safe_json_object(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

module.exports = {
  list_agent_products_admin,
};
