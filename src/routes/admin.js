// routes/admin.js
const express = require('express');
const Route = express.Router();

const admin = require('../controllers/admin');
const { requireAuth, requireAdmin } = require('../middleware/auth');

Route.use(requireAuth, requireAdmin);

Route.get('/users/agents', admin.list_agents);

Route.get('/users/customers', admin.list_customers);

Route.post('/agents/:user_id/verification', admin.update_agent_verification);

Route.get('/agents/products', admin.list_agent_products);

module.exports = Route;
