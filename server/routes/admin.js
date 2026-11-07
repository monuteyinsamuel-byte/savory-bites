'use strict';
const router = require('express').Router();
const upload = require('../middleware/upload');
const sanitize = require('../middleware/sanitize');
const { requireAdmin, requireCsrf } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiters');
const { idParam } = require('../middleware/validate');
const auth = require('../controllers/authController');
const menu = require('../controllers/menuController');
const gallery = require('../controllers/galleryController');
const settings = require('../controllers/settingsController');
const enquiries = require('../controllers/enquiryController');
const stats = require('../controllers/statsController');
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.param('id', idParam);
router.use(requireCsrf);

// Auth (login is the only unauthenticated endpoint here)
router.post('/auth/login', loginLimiter, wrap(auth.login));
router.post('/auth/logout', auth.logout);

// Everything below requires a valid admin session (enforced server-side).
router.use(requireAdmin);
router.get('/auth/me', wrap(auth.me));
router.post('/auth/password', wrap(auth.changePassword));
router.get('/stats', wrap(stats.get));

router.get('/menu', wrap(menu.list));
router.post('/menu', upload, sanitize, wrap(menu.create));
router.put('/menu/:id', upload, sanitize, wrap(menu.update));
router.delete('/menu/:id', wrap(menu.remove));

router.get('/gallery', wrap(gallery.list));
router.post('/gallery', upload, sanitize, wrap(gallery.create));
router.put('/gallery/:id', upload, sanitize, wrap(gallery.update));
router.delete('/gallery/:id', wrap(gallery.remove));

router.get('/settings', wrap(settings.get));
router.put('/settings', wrap(settings.update));

router.get('/enquiries', wrap(enquiries.list));
router.patch('/enquiries/:id', wrap(enquiries.setStatus));
router.delete('/enquiries/:id', wrap(enquiries.remove));
module.exports = router;
