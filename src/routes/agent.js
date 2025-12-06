const express = require('express');
const Route = express.Router();
const agent = require('../controllers/agent');

const { requireAuth } = require('../middleware/auth');

Route.post('/verification', requireAuth, agent.submitVerification);
Route.get('/verification', requireAuth, agent.getMyVerification);

module.exports = Route;
