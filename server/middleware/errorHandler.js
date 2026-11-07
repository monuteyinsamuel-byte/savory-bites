'use strict';
const config = require('../config');

class HttpError extends Error {
  constructor(status, message, errors) { super(message); this.status = status; this.errors = errors; }
}

const notFoundApi = (req, res) => res.status(404).json({ error: 'Not found' });

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  let status = err.status || 500;
  let message = err.message;
  if (err.name === 'MulterError') {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? `Image is too large (max ${config.maxImageMb} MB).` : 'Invalid upload.';
  } else if (err.type === 'entity.parse.failed') { status = 400; message = 'Invalid JSON.'; }
  else if (err.type === 'entity.too.large') { status = 413; message = 'Request too large.'; }
  else if (err.name === 'CastError' || err.name === 'ValidationError') { status = 400; message = 'Invalid data.'; }
  else if (!err.status) { console.error(err); status = 500; message = 'Something went wrong. Please try again.'; }
  res.status(status).json({ error: message, errors: err.errors });
}
module.exports = { HttpError, errorHandler, notFoundApi };
