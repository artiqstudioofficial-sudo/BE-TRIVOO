const express = require("express");
const Route = express.Router();

const auth = require("../controllers/auth");
const { requireAuth } = require("../middleware/auth");

Route.post("/login", auth.login);
Route.post("/register", auth.register);

// session-based: me wajib requireAuth
Route.get("/me", requireAuth, auth.me);

// session-based: logout destroy session
Route.post("/logout", requireAuth, auth.logout);

module.exports = Route;
