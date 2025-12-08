// routes/admin.js
const express = require('express');
const Route = express.Router();

const adminController = require('../controllers/admin');
const { requireAuth, requireAdmin } = require('../middleware/auth');

Route.use(requireAuth, requireAdmin);

Route.get('/users/agents', adminController.listAgents);

Route.get('/users/customers', adminController.listCustomers);

Route.post('/agents/:userId/verification', adminController.updateAgentVerification);

module.exports = Route;
