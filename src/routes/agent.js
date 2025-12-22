const express = require('express');
const Route = express.Router();
const agent = require('../controllers/agent');
const agentProduct = require('../controllers/agent_product');

const { requireAuth } = require('../middleware/auth');

Route.post('/verification', requireAuth, agent.submit_verification);
Route.get('/verification', requireAuth, agent.get_my_verification);

Route.get('/products', requireAuth, agentProduct.list_my_products);
Route.get('/products/:id', requireAuth, agentProduct.get_my_product);
Route.post('/products', requireAuth, agentProduct.create_my_product);
Route.put('/products/:id', requireAuth, agentProduct.update_my_product);

module.exports = Route;
