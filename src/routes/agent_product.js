// routes/agentProducts.js
const express = require('express');
const router = express.Router();

const agentProductController = require('../controllers/agent_product');

// Di sini diasumsikan middleware auth JWT sudah dipasang
// di level atas: routerNav.use('/api/v1/agent', authMiddleware, agentProductsRouter);

// GET /api/v1/agent/products
router.get('/products', agentProductController.listMyProducts);

// GET /api/v1/agent/products/:id
router.get('/products/:id', agentProductController.getMyProduct);

// POST /api/v1/agent/products
router.post('/products', agentProductController.createMyProduct);

// PUT /api/v1/agent/products/:id
router.put('/products/:id', agentProductController.updateMyProduct);

module.exports = router;
