const path = require('path');
const fs = require('fs');
const misc = require('../helpers/response');
const { upsertAgentVerification, findVerificationByUserId } = require('../models/agent');
const { updateVerificationStatus } = require('../models/user');

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'agent_docs');

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

function normalizeAgentType(type) {
  const allowed = ['INDIVIDUAL', 'CORPORATE'];
  if (!type) return 'INDIVIDUAL';
  const upper = String(type).toUpperCase();
  return allowed.includes(upper) ? upper : 'INDIVIDUAL';
}

function normalizeAgentSpecialization(spec) {
  const allowed = ['TOUR', 'STAY', 'TRANSPORT'];
  if (!spec) return 'TOUR';
  const upper = String(spec).toUpperCase();
  return allowed.includes(upper) ? upper : 'TOUR';
}

module.exports = {
  submitVerification: async (req, res) => {
    try {
      // HARUS lewat requireAuth, jangan ambil dari body lagi
      const userId = req.user?.id;
      if (!userId) {
        return misc.response(res, 401, true, 'Unauthorized');
      }

      const {
        type,
        idCardNumber,
        taxId,
        companyName,
        bankName,
        accountNumber,
        accountHolder,
        specialization,
      } = req.body;

      if (!idCardNumber || !taxId || !bankName || !accountNumber || !accountHolder) {
        return misc.response(res, 400, true, 'Semua field wajib diisi');
      }

      const normType = normalizeAgentType(type);
      const normSpec = normalizeAgentSpecialization(specialization);

      let documentUrl = null;

      // ==== HANDLE FILE (optional) ====
      if (req.files && req.files.idDocument) {
        ensureUploadDir();

        const docFile = req.files.idDocument;
        const ext = path.extname(docFile.name).toLowerCase();
        const allowedExts = ['.jpg', '.jpeg', '.png', '.pdf'];

        if (!allowedExts.includes(ext)) {
          return misc.response(
            res,
            400,
            true,
            'Format file tidak didukung. Gunakan JPG, PNG, atau PDF',
          );
        }

        // contoh limit 5MB
        const maxSize = 5 * 1024 * 1024;
        if (docFile.size > maxSize) {
          return misc.response(res, 400, true, 'Ukuran file maksimal 5MB');
        }

        const filename = `agent-${userId}-${Date.now()}${ext}`;
        const destPath = path.join(UPLOAD_DIR, filename);

        // express-fileupload
        await docFile.mv(destPath);

        // URL yang bisa diakses front-end (karena app.use(express.static('public')))
        documentUrl = `/uploads/agent_docs/${filename}`;
      }

      await upsertAgentVerification({
        userId,
        agentType: normType,
        specialization: normSpec,
        idCardNumber,
        taxId,
        companyName,
        bankName,
        accountNumber,
        accountHolder,
        documentUrl,
      });

      await updateVerificationStatus(userId, 'PENDING');

      return misc.response(res, 200, false, 'Verification submitted, status PENDING');
    } catch (e) {
      console.error(e);
      return misc.response(res, 500, true, e.message || 'Internal server error');
    }
  },

  getMyVerification: async (req, res) => {
    try {
      const userId = req.user?.id || req.query.userId;

      if (!userId) {
        return misc.response(res, 400, true, 'userId wajib diisi');
      }

      const verification = await findVerificationByUserId(userId);

      return misc.response(res, 200, false, 'OK', verification);
    } catch (e) {
      console.error(e);
      return misc.response(res, 500, true, e.message || 'Internal server error');
    }
  },
};
