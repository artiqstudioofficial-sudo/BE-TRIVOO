const express = require('express');

const auth = require('./routes/auth');
const Route = express.Router();

Route.use('/api/v1/auth', auth);

module.exports = Route;
