'use strict';
const path = require('path');
const multer = require('multer');
const config = require('../config');
const { HttpError } = require('./errorHandler');

const EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

// Files are held in memory (never written to disk with a user-supplied name),
// then verified by magic bytes in services/imageStorage.js before saving.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxImageBytes, files: 1, fields: 20, fieldSize: 20 * 1024 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!EXT.has(ext) || !MIME.has(file.mimetype)) return cb(new HttpError(400, 'Only JPG, PNG or WebP images are allowed.'));
    cb(null, true);
  }
});
module.exports = upload.single('image');
