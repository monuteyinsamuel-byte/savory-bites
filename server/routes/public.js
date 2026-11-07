'use strict';
const router = require('express').Router();
const c = require('../controllers/publicController');
const { enquiryLimiter } = require('../middleware/rateLimiters');
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/site', wrap(c.site));
router.get('/menu', wrap(c.menu));
router.get('/gallery', wrap(c.gallery));
router.post('/enquiries', enquiryLimiter, wrap(c.createEnquiry));
module.exports = router;
