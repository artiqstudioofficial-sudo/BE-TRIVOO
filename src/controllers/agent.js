const path = require("path");
const fs = require("fs");

const misc = require("../helpers/response");
const {
  upsert_agent_verification,
  find_verification_by_user_id,
} = require("../models/agent");

const { update_verification_status } = require("../models/user");

const UPLOAD_DIR = path.join(
  __dirname,
  "..",
  "public",
  "uploads",
  "agent_docs"
);
const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".pdf"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function ensure_upload_dir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

function normalize_agent_type(agent_type) {
  const allowed = new Set(["INDIVIDUAL", "CORPORATE"]);
  const upper = String(agent_type || "INDIVIDUAL").toUpperCase();
  return allowed.has(upper) ? upper : "INDIVIDUAL";
}

function normalize_agent_specialization(specialization) {
  const allowed = new Set(["TOUR", "STAY", "TRANSPORT"]);
  const upper = String(specialization || "TOUR").toUpperCase();
  return allowed.has(upper) ? upper : "TOUR";
}

async function handle_optional_document_upload(req, user_id) {
  if (!req.files || !req.files.id_document) return null;

  ensure_upload_dir();

  const doc_file = req.files.id_document;
  const ext = path.extname(doc_file.name).toLowerCase();

  if (!ALLOWED_EXTS.has(ext)) {
    const err = new Error(
      "Format file tidak didukung. Gunakan JPG, PNG, atau PDF"
    );
    err.status_code = 400;
    throw err;
  }

  if (doc_file.size > MAX_FILE_SIZE) {
    const err = new Error("Ukuran file maksimal 5MB");
    err.status_code = 400;
    throw err;
  }

  const filename = `agent-${user_id}-${Date.now()}${ext}`;
  const dest_path = path.join(UPLOAD_DIR, filename);

  await doc_file.mv(dest_path);

  return `/uploads/agent_docs/${filename}`;
}

module.exports = {
  submit_verification: async (req, res) => {
    try {
      const user_id = req.session?.user?.id;
      if (!user_id) return misc.response(res, 401, true, "Unauthorized");

      const {
        agent_type,
        id_card_number,
        tax_id,
        company_name,
        bank_name,
        bank_account_number,
        bank_account_holder,
        specialization,
      } = req.body;

      if (
        !id_card_number ||
        !tax_id ||
        !bank_name ||
        !bank_account_number ||
        !bank_account_holder
      ) {
        return misc.response(res, 400, true, "Semua field wajib diisi");
      }

      const norm_agent_type = normalize_agent_type(agent_type);
      const norm_specialization =
        normalize_agent_specialization(specialization);

      let id_document_url = null;
      try {
        id_document_url = await handle_optional_document_upload(req, user_id);
      } catch (e) {
        return misc.response(
          res,
          e.status_code || 500,
          true,
          e.message || "Upload failed"
        );
      }

      const payload = {
        user_id,
        agent_type: norm_agent_type,
        specialization: norm_specialization,
        id_card_number,
        tax_id,
        company_name: company_name ? String(company_name).trim() : null,
        bank_name,
        bank_account_number,
        bank_account_holder,
        ...(id_document_url ? { id_document_url } : {}),
      };

      await upsert_agent_verification(payload);

      await update_verification_status(user_id, "PENDING");

      return misc.response(
        res,
        200,
        false,
        "Verification submitted, status PENDING"
      );
    } catch (e) {
      console.error(e);
      return misc.response(
        res,
        500,
        true,
        e.message || "Internal server error"
      );
    }
  },

  get_my_verification: async (req, res) => {
    try {
      const user_id = req.session?.user?.id;
      if (!user_id) return misc.response(res, 401, true, "Unauthorized");

      const verification = await find_verification_by_user_id(user_id);
      return misc.response(res, 200, false, "OK", verification);
    } catch (e) {
      console.error(e);
      return misc.response(
        res,
        500,
        true,
        e.message || "Internal server error"
      );
    }
  },
};
