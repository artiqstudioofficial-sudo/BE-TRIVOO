const misc = require("../helpers/response");

function requireAuth(req, res, next) {
  const user = req.session?.user;

  if (!user) {
    return misc.response(res, 401, true, "Unauthorized");
  }

  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  const user = req.session?.user || req.user;

  if (!user) {
    return misc.response(res, 401, true, "Unauthorized");
  }

  if (user.role !== "ADMIN") {
    return misc.response(res, 403, true, "Forbidden: Admin only");
  }

  next();
}

module.exports = {
  requireAuth,
  requireAdmin,
};
