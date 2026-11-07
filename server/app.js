'use strict';
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
const config = require('./config');
const sanitize = require('./middleware/sanitize');
const { apiLimiter } = require('./middleware/rateLimiters');
const { errorHandler, notFoundApi, HttpError } = require('./middleware/errorHandler');
const { requireAdminPage } = require('./middleware/auth');
const { isObjectId } = require('./middleware/validate');
const publicController = require('./controllers/publicController');

const CLIENT = path.join(__dirname, '..', 'client');

function createApp({ sessionStore } = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (config.isProd) app.set('trust proxy', 1); // Render/Railway/Heroku sit behind a proxy

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false
  }));

  // Same-origin by default. Add other origins via ALLOWED_ORIGINS if the API is used from elsewhere.
  app.use(cors({ origin: (origin, cb) => cb(null, !origin || config.allowedOrigins.includes(origin)), credentials: true }));

  app.use(express.json({ limit: '20kb' }));
  app.use(sanitize);

  const store = sessionStore || require('connect-mongo').create({ mongoUrl: config.mongoUri, collectionName: 'sessions', ttl: config.sessionHours * 3600 });
  app.use(session({
    name: 'sb.sid',
    secret: config.sessionSecret,
    store,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { httpOnly: true, sameSite: 'lax', secure: config.isProd, maxAge: config.sessionHours * 3600 * 1000 }
  }));

  // API
  app.use('/api', apiLimiter, (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use('/api/public', require('./routes/public'));
  app.use('/api/setup', require('./routes/setup'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api', notFoundApi);

  // Uploaded images
  app.get('/media/:id', (req, res, next) => (isObjectId(req.params.id) ? next() : next(new HttpError(400, 'Invalid identifier.'))),
    (req, res, next) => publicController.media(req, res).catch(next));

  // Admin dashboard shell is only served to signed-in admins (login/setup pages remain public).
  app.get(['/admin', '/admin/'], requireAdminPage, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
  });

  app.use(express.static(CLIENT, { maxAge: config.isProd ? '1h' : 0 }));
  app.use(errorHandler);
  return app;
}
module.exports = { createApp };
