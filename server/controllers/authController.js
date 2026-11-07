'use strict';
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const config = require('../config');
const Admin = require('../models/Admin');
const { HttpError } = require('../middleware/errorHandler');
const v = require('../middleware/validate');

const COST = 12;
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', COST); // equalises timing for unknown emails
const regenerate = req => new Promise((res, rej) => req.session.regenerate(e => (e ? rej(e) : res())));
const save = req => new Promise((res, rej) => req.session.save(e => (e ? rej(e) : res())));
const sha = s => crypto.createHash('sha256').update(String(s)).digest();

exports.login = async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!email || !password || email.length > 254 || password.length > 200) throw new HttpError(400, 'Enter your email and password.');
  const admin = await Admin.findOne({ email }).select('+passwordHash');
  const ok = await bcrypt.compare(password, admin ? admin.passwordHash : DUMMY_HASH);
  if (!admin || !ok) throw new HttpError(401, 'Invalid email or password.');
  await regenerate(req); // prevents session fixation
  req.session.adminId = String(admin._id);
  await save(req);
  admin.lastLoginAt = new Date();
  await admin.save();
  res.json({ email: admin.email });
};

exports.logout = (req, res, next) => {
  req.session.destroy(err => {
    if (err) return next(err);
    res.clearCookie('sb.sid');
    res.json({ ok: true });
  });
};

exports.me = async (req, res) => {
  const admin = await Admin.findById(req.session.adminId);
  if (!admin) throw new HttpError(401, 'Please sign in.');
  res.json({ email: admin.email, maxImageMb: config.maxImageMb });
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const admin = await Admin.findById(req.session.adminId).select('+passwordHash');
  if (!admin || typeof currentPassword !== 'string' || !(await bcrypt.compare(currentPassword, admin.passwordHash))) {
    throw new HttpError(400, 'Current password is incorrect.', { currentPassword: 'Current password is incorrect.' });
  }
  const problem = v.passwordProblem(newPassword);
  if (problem) throw new HttpError(400, problem, { newPassword: problem });
  admin.passwordHash = await bcrypt.hash(newPassword, COST);
  await admin.save();
  await regenerate(req);
  req.session.adminId = String(admin._id);
  await save(req);
  res.json({ ok: true });
};

exports.setupStatus = async (req, res) => {
  const exists = (await Admin.estimatedDocumentCount()) > 0;
  res.json({ needsSetup: !exists, enabled: !!config.setupToken });
};

// One-time owner creation. Disabled forever once an admin exists, and always requires SETUP_TOKEN.
exports.setup = async (req, res) => {
  if (!config.setupToken) throw new HttpError(403, 'Setup is disabled. Set SETUP_TOKEN or run "npm run create-admin".');
  if (await Admin.exists({})) throw new HttpError(403, 'Setup has already been completed.');
  const { token, email, password } = req.body;
  if (typeof token !== 'string' || !crypto.timingSafeEqual(sha(token), sha(config.setupToken))) throw new HttpError(403, 'Invalid setup token.');
  const errors = {};
  const mail = v.text({ email }, 'email', { max: 254, required: true, label: 'Email' }, errors).toLowerCase();
  if (!errors.email && !v.isEmail(mail)) errors.email = 'Enter a valid email address.';
  const problem = v.passwordProblem(password);
  if (problem) errors.password = problem;
  v.fail(errors);
  try {
    await Admin.create({ email: mail, passwordHash: await bcrypt.hash(password, COST) });
  } catch (e) {
    if (e.code === 11000) throw new HttpError(403, 'Setup has already been completed.');
    throw e;
  }
  res.status(201).json({ ok: true });
};
exports.COST = COST;
