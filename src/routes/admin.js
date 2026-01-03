const express = require("express");
const Route = express.Router();

const admin = require("../controllers/admin");
const { requireAuth, requireAdmin } = require("../middleware/auth");

Route.use(requireAuth, requireAdmin);

Route.get("/users/agents", admin.list_agents);
Route.get("/users/customers", admin.list_customers);
Route.post("/agents/:user_id/verification", admin.update_agent_verification);
Route.get("/agents/products", admin.list_agent_products);
Route.get("/agents/products/:product_id", admin.get_agent_product_detail);

/** ✅ campaigns */
Route.post("/campaigns", admin.create_campaign);
Route.get("/campaigns", admin.list_campaigns);
Route.get("/campaigns/:campaign_id", admin.get_campaign_detail);

Route.post("/campaigns/:campaign_id/products", admin.attach_campaign_products);

module.exports = Route;
