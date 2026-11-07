'use strict';
// Usage: npm run create-admin   (interactive)
//    or: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' npm run create-admin
const readline = require('readline');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../config');
const Admin = require('../models/Admin');
const v = require('../middleware/validate');
const { COST } = require('../controllers/authController');

function ask(q, hidden) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) { rl._writeToOutput = s => { if (s.includes(q)) process.stdout.write(s); }; }
  return new Promise(res => rl.question(q, a => { rl.close(); if (hidden) process.stdout.write('\n'); res(a); }));
}

(async () => {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
  if (await Admin.exists({})) { console.error('An admin already exists. Nothing changed.'); return; }
  const email = (process.env.ADMIN_EMAIL || await ask('Admin email: ')).trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || await ask('Password (min 10 chars, letters + numbers): ', true);
  if (!v.isEmail(email)) throw new Error('Invalid email address.');
  const problem = v.passwordProblem(password);
  if (problem) throw new Error(problem);
  await Admin.create({ email, passwordHash: await bcrypt.hash(password, COST) });
  console.log(`Admin created: ${email}. Sign in at /admin`);
})().catch(e => { console.error('Error:', e.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
