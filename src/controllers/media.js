const misc = require('../helpers/response');

function ensure_auth(req) {
  const user = req?.session?.user || null;
  if (!user) {
    const err = new Error('Unauthorized');
    err.status_code = 401;
    throw err;
  }
  return user;
}

function to_public_url(req, public_path) {
  const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;

  return `${base}${public_path}`;
}

async function upload_media(req, res) {
  try {
    ensure_auth(req);

    const file = req.files?.file?.[0] || null;
    const files = req.files?.files || [];

    const picked = [];
    if (file) picked.push(file);
    if (Array.isArray(files) && files.length > 0) picked.push(...files);

    if (!picked.length) {
      return misc.response(res, 400, true, 'File tidak ditemukan (field: file atau files)');
    }

    const items = picked.map((f) => {
      const public_path = `/uploads/${f.filename}`;
      const url = to_public_url(req, public_path);

      return {
        path: public_path,
        url,
        file_name: f.originalname,
        stored_name: f.filename,
        mime: f.mimetype,
        size: f.size,
      };
    });

    return misc.response(res, 200, false, 'OK', {
      path: items[0].path,
      url: items[0].url,
      items,
    });
  } catch (e) {
    console.error(e);
    return misc.response(res, e.status_code || 500, true, e.message || 'Internal server error');
  }
}

module.exports = {
  upload_media,
};
