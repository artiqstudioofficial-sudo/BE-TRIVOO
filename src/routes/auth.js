const express = require('express');
const Route = express.Router();
const auth = require('../controllers/auth');
const { requireAuth } = require('../middleware/auth');

Route.post('/login', auth.login);
Route.post('/register', auth.register);
Route.get('/me', requireAuth, auth.me);

module.exports = Route;
