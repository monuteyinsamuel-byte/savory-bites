'use strict';
const router = require('express').Router();
const c = require('../controllers/authController');
const { setupLimiter } = require('../middleware/rateLimiters');
const { requireCsrf } = require('../middleware/auth');
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/status', wrap(c.setupStatus));
router.post('/', setupLimiter, requireCsrf, wrap(c.setup));
module.exports = router;
