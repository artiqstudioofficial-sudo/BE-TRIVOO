const express = require('express');
const bodyParser = require('body-parser');
const logger = require('morgan');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
const port = 4000;

const routerNav = require('./src/index');

const fileUpload = require('express-fileupload');
app.use(fileUpload());
app.use(express.static('public'));

// Logging
app.use(logger('dev'));

// Security headers
app.use(helmet());

// CORS – atur origin & headers sesuai kebutuhan
app.use(
  cors({
    origin: '*', // atau 'https://frontend-kamu.com'
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204, // biar IE/old browser nggak error
  }),
);

// Handle preflight secara eksplisit
app.options('*', cors());

app.use(compression());
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use('/', routerNav);

const server = app.listen(port, () => {
  console.log(`\n\t *** Server listening on PORT ${port}  ***`);
});

// Penting: taruh setelah semua route lain, kalau nggak dia override
app.get('*', (_, response) => {
  response.sendStatus(404);
});

module.exports = server;
