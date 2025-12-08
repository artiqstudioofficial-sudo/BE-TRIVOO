const express = require('express');
const Route = express.Router();

const auth = require('./routes/auth');
const agent = require('./routes/agent');
const admin = require('./routes/admin');

Route.use('/api/v1/auth', auth);
Route.use('/api/v1/agent', agent);
Route.use('/api/v1/admin', admin);

module.exports = Route;
