'use strict';
const config = require('../config');
const { HttpError } = require('./errorHandler');

const requireAdmin = (req, res, next) =>
  req.session && req.session.adminId ? next() : next(new HttpError(401, 'Please sign in.'));

const requireAdminPage = (req, res, next) =>
  req.session && req.session.adminId ? next() : res.redirect('/admin/login.html');

// CSRF defence for state-changing requests, on top of SameSite=Lax cookies:
// requires a custom header (cross-site forms cannot set it) and a same-origin Origin.
function requireCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('x-requested-with') !== 'fetch') return next(new HttpError(403, 'Invalid request.'));
  const origin = req.get('origin');
  if (origin) {
    let host = '';
    try { host = new URL(origin).host; } catch { /* ignore */ }
    if (host !== req.get('host') && !config.allowedOrigins.includes(origin)) return next(new HttpError(403, 'Origin not allowed.'));
  }
  next();
}
module.exports = { requireAdmin, requireAdminPage, requireCsrf };
