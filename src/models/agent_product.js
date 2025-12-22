const conn = require("../configs/db");

async function query(sql, params = []) {
  try {
    const [rows] = await conn.execute(sql, params);
    return rows;
  } catch (err) {
    err.message = `${err.message}\nSQL: ${sql}`;
    throw err;
  }
}

function safe_parse_json(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
}

async function find_product_row_by_id(product_id) {
  const rows = await query(
    `
      SELECT
        p.*
      FROM products p
      WHERE p.id = ?
      LIMIT 1
    `,
    [product_id]
  );

  return rows[0] || null;
}

async function find_product_images(product_id) {
  const rows = await query(
    `
      SELECT
        image_url
      FROM product_images
      WHERE product_id = ?
      ORDER BY sort_order ASC, id ASC
    `,
    [product_id]
  );

  return rows.map((r) => r.image_url);
}

async function find_product_blocked_dates(product_id) {
  const rows = await query(
    `
      SELECT
        DATE_FORMAT(blocked_date, '%Y-%m-%d') AS blocked_date
      FROM product_blocked_dates
      WHERE product_id = ?
      ORDER BY blocked_date ASC
    `,
    [product_id]
  );

  return rows.map((r) => r.blocked_date);
}

async function build_product_response(row) {
  if (!row) return null;

  const images = await find_product_images(row.id);
  const blocked_dates = await find_product_blocked_dates(row.id);

  const features = safe_parse_json(row.features, []);
  const details = safe_parse_json(row.details, null);

  return {
    id: row.id,
    owner_id: row.owner_id,
    category_id: row.category_id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    currency: row.currency,
    location: row.location,
    image: row.image_url,
    images,
    features,
    details,
    daily_capacity: row.daily_capacity,
    blocked_dates,
    rating: row.rating ? Number(row.rating) : 0,
    is_active: !!row.is_active,
    created_at: row.created_at,
  };
}

async function create_product(payload) {
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
      payload.owner_id,
      payload.category_id,
      payload.name,
      payload.description,
      payload.price,
      payload.currency,
      payload.location,
      payload.image,
      payload.features ? JSON.stringify(payload.features) : null,
      payload.details ? JSON.stringify(payload.details) : null,
      payload.daily_capacity || 10,
    ]
  );

  const product_id = result.insertId;

  if (Array.isArray(payload.images) && payload.images.length > 0) {
    for (let i = 0; i < payload.images.length; i += 1) {
      const img = payload.images[i];
      await query(
        `
          INSERT INTO product_images (product_id, image_url, sort_order)
          VALUES (?,?,?)
        `,
        [product_id, img, i]
      );
    }
  }

  if (
    Array.isArray(payload.blocked_dates) &&
    payload.blocked_dates.length > 0
  ) {
    for (const date of payload.blocked_dates) {
      await query(
        `
          INSERT IGNORE INTO product_blocked_dates (product_id, blocked_date)
          VALUES (?,?)
        `,
        [product_id, date]
      );
    }
  }

  const row = await find_product_row_by_id(product_id);
  return build_product_response(row);
}

async function update_product(product_id, owner_id, payload) {
  const existing = await find_product_row_by_id(product_id);
  if (!existing) return null;

  if (Number(existing.owner_id) !== Number(owner_id)) {
    const err = new Error("Forbidden");
    err.code = "FORBIDDEN";
    throw err;
  }

  await query(
    `
      UPDATE products
      SET
        category_id    = ?,
        name           = ?,
        description    = ?,
        price          = ?,
        currency       = ?,
        location       = ?,
        image_url      = ?,
        features       = ?,
        details        = ?,
        daily_capacity = ?,
        updated_at     = CURRENT_TIMESTAMP
      WHERE id = ? AND owner_id = ?
    `,
    [
      payload.category_id,
      payload.name,
      payload.description,
      payload.price,
      payload.currency,
      payload.location,
      payload.image,
      payload.features ? JSON.stringify(payload.features) : null,
      payload.details ? JSON.stringify(payload.details) : null,
      payload.daily_capacity || 10,
      product_id,
      owner_id,
    ]
  );

  await query(`DELETE FROM product_images WHERE product_id = ?`, [product_id]);
  if (Array.isArray(payload.images) && payload.images.length > 0) {
    for (let i = 0; i < payload.images.length; i += 1) {
      const img = payload.images[i];
      await query(
        `
          INSERT INTO product_images (product_id, image_url, sort_order)
          VALUES (?,?,?)
        `,
        [product_id, img, i]
      );
    }
  }

  await query(`DELETE FROM product_blocked_dates WHERE product_id = ?`, [
    product_id,
  ]);
  if (
    Array.isArray(payload.blocked_dates) &&
    payload.blocked_dates.length > 0
  ) {
    for (const date of payload.blocked_dates) {
      await query(
        `
          INSERT IGNORE INTO product_blocked_dates (product_id, blocked_date)
          VALUES (?,?)
        `,
        [product_id, date]
      );
    }
  }

  const row = await find_product_row_by_id(product_id);
  return build_product_response(row);
}

async function get_product_by_id_for_owner(product_id, owner_id) {
  const row = await find_product_row_by_id(product_id);
  if (!row) return null;
  if (Number(row.owner_id) !== Number(owner_id)) return null;
  return build_product_response(row);
}

async function list_products_by_owner(owner_id) {
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
    [owner_id]
  );

  return rows.map((row) => ({
    id: row.id,
    owner_id: row.owner_id,
    category_id: row.category_id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    currency: row.currency,
    location: row.location,
    image: row.image_url,
    daily_capacity: row.daily_capacity,
    rating: row.rating ? Number(row.rating) : 0,
    is_active: !!row.is_active,
    created_at: row.created_at,
  }));
}

module.exports = {
  create_product,
  update_product,
  get_product_by_id_for_owner,
  list_products_by_owner,
};
