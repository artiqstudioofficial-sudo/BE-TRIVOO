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
Route.delete('/products/:id/delete', requireAuth, agentProduct.delete_my_product);

Route.get('/products/:id/images', requireAuth, agentProduct.list_my_product_images);
Route.post('/products/:id/images', requireAuth, agentProduct.add_my_product_images);
Route.put('/products/:id/images/reorder', requireAuth, agentProduct.reorder_my_product_images);
Route.put('/products/:id/images/:image_id', requireAuth, agentProduct.update_my_product_image);
Route.delete('/products/:id/images/:image_id', requireAuth, agentProduct.delete_my_product_image);

module.exports = Route;
