const express = require('express');
const Route = express.Router();
const agent = require('../controllers/agent');
const agentProduct = require('../controllers/agent_product');

const { requireAuth } = require('../middleware/auth');

Route.post('/verification', requireAuth, agent.submitVerification);
Route.get('/verification', requireAuth, agent.getMyVerification);

Route.get('/products', agentProduct.listMyProducts);
Route.get('/products/:id', agentProduct.getMyProduct);
Route.post('/products', agentProduct.createMyProduct);
Route.put('/products/:id', agentProduct.updateMyProduct);

module.exports = Route;
