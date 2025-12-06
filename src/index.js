const express = require('express');

const auth = require('./routes/auth');
const agent = require('./routes/agent');
const Route = express.Router();

Route.use('/api/v1/auth', auth);
Route.use('/api/v1/agent', agent);

module.exports = Route;
