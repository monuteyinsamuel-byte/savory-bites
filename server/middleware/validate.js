'use strict';
const { HttpError } = require('./errorHandler');

// Removes control characters, keeps newlines/tabs, trims.
const clean = s => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();

function text(body, field, { min = 0, max = 200, required = false, label = field } = {}, errors) {
  let v = body[field];
  if (v === undefined || v === null) v = '';
  if (typeof v !== 'string' && typeof v !== 'number') { errors[field] = `${label} is invalid.`; return ''; }
  v = clean(v);
  if (required && !v) errors[field] = `${label} is required.`;
  else if (v && v.length < min) errors[field] = `${label} must be at least ${min} characters.`;
  else if (v.length > max) errors[field] = `${label} must be at most ${max} characters.`;
  return v;
}

function number(body, field, { min = -Infinity, max = Infinity, required = false, integer = false, def = 0, label = field } = {}, errors) {
  const raw = body[field];
  if (raw === undefined || raw === null || raw === '') {
    if (required) errors[field] = `${label} is required.`;
    return def;
  }
  const n = typeof raw === 'number' ? raw : (typeof raw === 'string' ? Number(raw.trim()) : NaN);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
    errors[field] = `${label} must be ${integer ? 'a whole ' : 'a '}number between ${min} and ${max}.`;
    return def;
  }
  return n;
}

const bool = (v, def = false) => (v === undefined ? def : v === true || v === 'true' || v === 'on' || v === '1');
const isEmail = s => /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(s);
const isHttpsUrl = s => { try { return new URL(s).protocol === 'https:'; } catch { return false; } };
const isObjectId = s => typeof s === 'string' && /^[a-f0-9]{24}$/.test(s);

function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < 10) return 'Password must be at least 10 characters.';
  if (pw.length > 200) return 'Password is too long.';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Password must contain letters and numbers.';
  return null;
}

function fail(errors) {
  if (Object.keys(errors).length) throw new HttpError(400, 'Please fix the highlighted fields.', errors);
}

// Express param guard: rejects anything that is not a 24-char hex ObjectId.
function idParam(req, res, next, id) {
  if (!isObjectId(id)) return next(new HttpError(400, 'Invalid identifier.'));
  next();
}

module.exports = { clean, text, number, bool, isEmail, isHttpsUrl, isObjectId, passwordProblem, fail, idParam };
