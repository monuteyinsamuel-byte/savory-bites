'use strict';
// Removes Mongo operator keys ("$gt", "a.b") and prototype-pollution keys from user input.
const BAD = new Set(['__proto__', 'constructor', 'prototype']);
function strip(v) {
  if (Array.isArray(v)) return v.map(strip);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      if (k.startsWith('$') || k.includes('.') || BAD.has(k)) continue;
      out[k] = strip(val);
    }
    return out;
  }
  return v;
}
module.exports = (req, res, next) => {
  if (req.body) req.body = strip(req.body);
  if (req.query) req.query = strip(req.query);
  next();
};
module.exports.strip = strip;
