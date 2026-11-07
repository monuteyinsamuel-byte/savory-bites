'use strict';
const rateLimit = require('express-rate-limit');
const make = (windowMs, limit, message, extra = {}) => rateLimit({
  windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: message }, ...extra
});
module.exports = {
  apiLimiter: make(15 * 60 * 1000, 400, 'Too many requests. Please slow down.'),
  loginLimiter: make(15 * 60 * 1000, 10, 'Too many sign-in attempts. Try again in 15 minutes.', { skipSuccessfulRequests: true }),
  setupLimiter: make(60 * 60 * 1000, 10, 'Too many setup attempts. Try again later.'),
  enquiryLimiter: make(60 * 60 * 1000, 8, 'Too many messages sent. Please try again later.')
};
