'use strict';
// Full integration test against a real MongoDB. Run with:
//   TEST_MONGODB_URI=mongodb://127.0.0.1:27017/savory-bites-test npm test
const URI = process.env.TEST_MONGODB_URI;
const test = require('node:test');
const assert = require('node:assert');
if (!URI) { test('API integration tests', { skip: 'set TEST_MONGODB_URI to run' }, () => {}); return; }

Object.assign(process.env, { MONGODB_URI: URI, SETUP_TOKEN: 'test-setup-token', MAX_IMAGE_MB: '1', NODE_ENV: 'test' });
const mongoose = require('mongoose');
const { createApp } = require('../app');
const { ensureDefaults } = require('../services/seed');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
let base, server, cookie = '';
const EMAIL = 'owner@example.com', PASS = 'Str0ngPassw0rd!';

async function call(path, { method = 'GET', json, form, headers = {}, auth = true, csrf = true } = {}) {
  const h = { ...headers };
  if (csrf) h['X-Requested-With'] = 'fetch';
  if (auth && cookie) h.Cookie = cookie;
  let body;
  if (json !== undefined) { h['Content-Type'] = 'application/json'; body = JSON.stringify(json); } else if (form) body = form;
  const res = await fetch(base + path, { method, headers: h, body, redirect: 'manual' });
  const sc = res.headers.get('set-cookie');
  if (sc && auth) cookie = sc.split(';')[0];
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, headers: res.headers, data: ct.includes('json') ? await res.json() : null, res };
}
const imgForm = (fields, buf = PNG, name = 'dish.png', type = 'image/png') => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  if (buf) f.append('image', new Blob([buf], { type }), name);
  return f;
};

test.before(async () => {
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();
  await ensureDefaults();
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => { server.close(); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); process.exit(0); });

test('security headers and no framework banner', async () => {
  const r = await call('/api/public/site', { auth: false });
  assert.strictEqual(r.status, 200);
  assert.ok(r.headers.get('content-security-policy').includes("script-src 'self'"));
  assert.strictEqual(r.headers.get('x-content-type-options'), 'nosniff');
  assert.strictEqual(r.headers.get('x-powered-by'), null);
  assert.strictEqual(r.headers.get('access-control-allow-origin'), null);
  assert.strictEqual(r.data.whatsappNumber, '2348164212898');
  assert.strictEqual(r.data.whatsappDisplay, '+234 816 421 2898');
  assert.ok(!('seeded' in r.data) && !('_id' in r.data));
});

test('public menu/gallery are seeded once and load without auth', async () => {
  const m = await call('/api/public/menu', { auth: false });
  assert.strictEqual(m.data.length, 8);
  assert.ok(m.data.every(d => d.image === '' && !('isActive' in d)));
  assert.ok(m.data.some(d => d.isPopular));
  assert.strictEqual((await call('/api/public/gallery', { auth: false })).data.length, 6);
  await ensureDefaults();
  assert.strictEqual((await call('/api/public/menu', { auth: false })).data.length, 8);
});

test('admin API and dashboard are protected server-side', async () => {
  for (const p of ['/api/admin/menu', '/api/admin/gallery', '/api/admin/settings', '/api/admin/enquiries', '/api/admin/stats', '/api/admin/auth/me']) {
    assert.strictEqual((await call(p, { auth: false })).status, 401, p);
  }
  assert.strictEqual((await call('/api/admin/menu', { method: 'POST', auth: false })).status, 401);
  const page = await call('/admin', { auth: false });
  assert.strictEqual(page.status, 302); assert.strictEqual(page.headers.get('location'), '/admin/login.html');
  assert.strictEqual((await call('/admin/login.html', { auth: false })).status, 200);
});

test('setup: needs token, works once, then is closed; no public registration', async () => {
  assert.deepStrictEqual((await call('/api/setup/status', { auth: false })).data, { needsSetup: true, enabled: true });
  assert.strictEqual((await call('/api/setup', { method: 'POST', json: { token: 'nope', email: EMAIL, password: PASS }, auth: false })).status, 403);
  assert.strictEqual((await call('/api/setup', { method: 'POST', json: { token: 'test-setup-token', email: EMAIL, password: 'short' }, auth: false })).status, 400);
  assert.strictEqual((await call('/api/setup', { method: 'POST', json: { token: 'test-setup-token', email: EMAIL, password: PASS }, auth: false, csrf: false })).status, 403);
  assert.strictEqual((await call('/api/setup', { method: 'POST', json: { token: 'test-setup-token', email: EMAIL, password: PASS }, auth: false })).status, 201);
  assert.strictEqual((await call('/api/setup', { method: 'POST', json: { token: 'test-setup-token', email: 'x@example.com', password: PASS }, auth: false })).status, 403);
  assert.strictEqual((await call('/api/admin/auth/register', { method: 'POST', json: {}, auth: false })).status, 401);
  const Admin = require('../models/Admin');
  const a = await Admin.findOne({}).select('+passwordHash').lean();
  assert.ok(a.passwordHash.startsWith('$2') && !a.passwordHash.includes(PASS));
  assert.strictEqual(await Admin.countDocuments(), 1);
});

test('login: rejects bad creds and NoSQL-injection payloads, requires CSRF header', async () => {
  assert.strictEqual((await call('/api/admin/auth/login', { method: 'POST', json: { email: EMAIL, password: 'wrong-password1' }, auth: false })).status, 401);
  assert.strictEqual((await call('/api/admin/auth/login', { method: 'POST', json: { email: { $ne: '' }, password: { $ne: '' } }, auth: false })).status, 400);
  assert.strictEqual((await call('/api/admin/auth/login', { method: 'POST', json: { email: EMAIL, password: PASS }, auth: false, csrf: false })).status, 403);
  const bad = await call('/api/admin/auth/login', { method: 'POST', json: { email: EMAIL, password: PASS }, auth: false, headers: { Origin: 'https://evil.example' } });
  assert.strictEqual(bad.status, 403);
  const ok = await call('/api/admin/auth/login', { method: 'POST', json: { email: EMAIL, password: PASS } });
  assert.strictEqual(ok.status, 200);
  const sc = ok.headers.get('set-cookie');
  assert.ok(/HttpOnly/i.test(sc) && /SameSite=Lax/i.test(sc) && sc.startsWith('sb.sid='));
  assert.strictEqual((await call('/admin')).status, 200);
  assert.strictEqual((await call('/api/admin/auth/me')).data.email, EMAIL);
});

test('state-changing admin requests need the CSRF header even when signed in', async () => {
  assert.strictEqual((await call('/api/admin/menu', { method: 'POST', form: imgForm({ name: 'X', price: '1' }, null), csrf: false })).status, 403);
});

test('settings: validate, update, persist, and show on the public site', async () => {
  const bad = await call('/api/admin/settings', { method: 'PUT', json: { name: '', email: 'nope', mapUrl: 'javascript:alert(1)', phone: 'abc', hours: 'x' } });
  assert.strictEqual(bad.status, 400);
  assert.ok(bad.data.errors.name && bad.data.errors.email && bad.data.errors.mapUrl && bad.data.errors.phone && bad.data.errors.hours);
  const cur = (await call('/api/admin/settings')).data;
  const upd = await call('/api/admin/settings', { method: 'PUT', json: { ...cur, name: 'Savory Bites <b>Lagos</b>', email: 'hello@savory.example', phone: '+234 800 000 0000', address: '1 Test Road', mapUrl: 'https://maps.example.com/x', hours: [{ day: 'Daily', time: '09:00 – 21:00' }], $where: 'x', 'a.b': 1 } });
  assert.strictEqual(upd.status, 200);
  const pub = (await call('/api/public/site', { auth: false })).data;
  assert.strictEqual(pub.name, 'Savory Bites <b>Lagos</b>'); // stored as text; the frontend renders with textContent
  assert.deepStrictEqual(pub.hours, [{ day: 'Daily', time: '09:00 – 21:00' }]);
  assert.strictEqual(pub.email, 'hello@savory.example');
  assert.strictEqual(pub.whatsappNumber, '2348164212898');
});

let dishId, dishImage;
test('menu CRUD with image upload, enable/disable and delete', async () => {
  assert.strictEqual((await call('/api/admin/menu', { method: 'POST', form: imgForm({ name: '', price: '-3' }, null) })).status, 400);
  const created = await call('/api/admin/menu', { method: 'POST', form: imgForm({ name: 'Jollof <img src=x onerror=alert(1)>', price: '3500.50', category: 'Mains', description: 'Smoky', isPopular: 'true', isActive: 'true', sortOrder: '99' }) });
  assert.strictEqual(created.status, 201);
  dishId = created.data.id; dishImage = created.data.image;
  assert.ok(/^\/media\/[a-f0-9]{24}$/.test(dishImage));
  const media = await fetch(base + dishImage);
  assert.strictEqual(media.status, 200);
  assert.strictEqual(media.headers.get('content-type'), 'image/png');
  assert.strictEqual(media.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(Buffer.from(await media.arrayBuffer()).equals(PNG));
  let pub = (await call('/api/public/menu', { auth: false })).data;
  assert.ok(pub.some(d => d.id === dishId && d.price === 3500.5));
  // disable → hidden publicly
  const upd = await call(`/api/admin/menu/${dishId}`, { method: 'PUT', form: imgForm({ name: 'Jollof Rice', price: '4000', category: 'Mains', description: '', isPopular: 'true', isActive: 'false', sortOrder: '99' }, null) });
  assert.strictEqual(upd.status, 200); assert.strictEqual(upd.data.image, dishImage);
  pub = (await call('/api/public/menu', { auth: false })).data;
  assert.ok(!pub.some(d => d.id === dishId));
  assert.ok((await call('/api/admin/menu')).data.some(d => d.id === dishId && d.isActive === false));
  // replace image removes the old one
  const rep = await call(`/api/admin/menu/${dishId}`, { method: 'PUT', form: imgForm({ name: 'Jollof Rice', price: '4000', isActive: 'true' }) });
  assert.notStrictEqual(rep.data.image, dishImage);
  assert.strictEqual((await fetch(base + dishImage)).status, 404);
  dishImage = rep.data.image;
  // remove image flag
  const rm = await call(`/api/admin/menu/${dishId}`, { method: 'PUT', form: imgForm({ name: 'Jollof Rice', price: '4000', isActive: 'true', removeImage: 'true' }, null) });
  assert.strictEqual(rm.data.image, ''); assert.strictEqual((await fetch(base + dishImage)).status, 404);
  // delete
  assert.strictEqual((await call(`/api/admin/menu/${dishId}`, { method: 'DELETE' })).status, 200);
  assert.strictEqual((await call(`/api/admin/menu/${dishId}`, { method: 'DELETE' })).status, 404);
  assert.strictEqual((await call('/api/admin/menu/not-an-id', { method: 'DELETE' })).status, 400);
  assert.strictEqual((await call('/api/admin/menu/' + encodeURIComponent('{"$ne":1}'), { method: 'DELETE' })).status, 400);
});

test('unsafe uploads are rejected (svg, disguised files, wrong extension, oversize)', async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  const mk = (buf, name, type) => call('/api/admin/gallery', { method: 'POST', form: imgForm({ caption: 'x' }, buf, name, type) });
  assert.strictEqual((await mk(svg, 'a.svg', 'image/svg+xml')).status, 400);
  assert.strictEqual((await mk(svg, 'a.png', 'image/png')).status, 400);              // svg disguised as png
  assert.strictEqual((await mk(Buffer.from('<?php system($_GET[1]); ?>'), 'shell.php.jpg', 'image/jpeg')).status, 400);
  assert.strictEqual((await mk(PNG, 'a.gif', 'image/png')).status, 400);              // bad extension
  assert.strictEqual((await mk(PNG, 'a.jpg', 'image/png')).status, 400);              // extension/content mismatch
  const big = Buffer.concat([PNG, Buffer.alloc(1.2 * 1024 * 1024)]);
  const r = await mk(big, 'big.png', 'image/png');
  assert.strictEqual(r.status, 400); assert.ok(/too large/i.test(r.data.error));
  assert.strictEqual((await call('/api/admin/gallery', { method: 'POST', form: imgForm({ caption: 'no file' }, null) })).status, 400);
  assert.strictEqual((await call('/api/admin/gallery')).data.length, 6); // nothing was stored
});

test('gallery upload, edit and delete', async () => {
  const c = await call('/api/admin/gallery', { method: 'POST', form: imgForm({ caption: 'Terrace', sortOrder: '50' }, PNG, '../../etc/passwd.png') });
  assert.strictEqual(c.status, 201);
  assert.ok(/^\/media\/[a-f0-9]{24}$/.test(c.data.image)); // user filename never used
  assert.ok((await call('/api/public/gallery', { auth: false })).data.some(g => g.caption === 'Terrace'));
  const u = await call(`/api/admin/gallery/${c.data.id}`, { method: 'PUT', form: imgForm({ caption: 'Terrace at dusk', sortOrder: '50' }, null) });
  assert.strictEqual(u.data.caption, 'Terrace at dusk'); assert.strictEqual(u.data.image, c.data.image);
  assert.strictEqual((await call(`/api/admin/gallery/${c.data.id}`, { method: 'DELETE' })).status, 200);
  assert.strictEqual((await fetch(base + c.data.image)).status, 404);
});

test('enquiries: public submit, honeypot, validation, admin manage', async () => {
  const post = json => call('/api/public/enquiries', { method: 'POST', json, auth: false, csrf: false });
  assert.strictEqual((await post({ name: '', message: '' })).status, 400);
  assert.strictEqual((await post({ name: { $gt: '' }, message: 'x' })).status, 400);
  assert.strictEqual((await post({ name: 'Bot', message: 'spam', website: 'http://spam' })).status, 201);
  assert.strictEqual((await post({ name: 'Ada', message: 'Table for 4 <script>alert(1)</script>' })).status, 201);
  const list = (await call('/api/admin/enquiries')).data;
  assert.strictEqual(list.length, 1); // honeypot not saved
  assert.strictEqual(list[0].status, 'new'); assert.ok(list[0].message.includes('<script>')); // stored as inert text
  assert.strictEqual((await call('/api/admin/stats')).data.enquiriesNew, 1);
  assert.strictEqual((await call(`/api/admin/enquiries/${list[0].id}`, { method: 'PATCH', json: { status: 'bogus' } })).status, 400);
  assert.strictEqual((await call(`/api/admin/enquiries/${list[0].id}`, { method: 'PATCH', json: { status: 'handled' } })).data.status, 'handled');
  assert.strictEqual((await call('/api/admin/stats')).data.enquiriesNew, 0);
  assert.strictEqual((await call(`/api/admin/enquiries/${list[0].id}`, { method: 'DELETE' })).status, 200);
  assert.strictEqual((await call('/api/admin/enquiries')).data.length, 0);
});

test('error handling: bad JSON, unknown API route, no stack traces', async () => {
  const r = await fetch(base + '/api/admin/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: '{bad' });
  assert.strictEqual(r.status, 400); const d = await r.json(); assert.ok(!JSON.stringify(d).includes('node_modules'));
  assert.strictEqual((await call('/api/nope', { auth: false })).status, 404);
  assert.strictEqual((await fetch(base + '/media/zzzz')).status, 400);
});

test('password change, logout, and session invalidation', async () => {
  assert.strictEqual((await call('/api/admin/auth/password', { method: 'POST', json: { currentPassword: 'wrong', newPassword: 'NewPassw0rd123' } })).status, 400);
  assert.strictEqual((await call('/api/admin/auth/password', { method: 'POST', json: { currentPassword: PASS, newPassword: 'weak' } })).status, 400);
  assert.strictEqual((await call('/api/admin/auth/password', { method: 'POST', json: { currentPassword: PASS, newPassword: 'NewPassw0rd123' } })).status, 200);
  const old = cookie;
  assert.strictEqual((await call('/api/admin/auth/logout', { method: 'POST' })).status, 200);
  assert.strictEqual((await call('/api/admin/menu', { auth: false, headers: { Cookie: old } })).status, 401); // session destroyed server-side
  cookie = '';
  assert.strictEqual((await call('/api/admin/auth/login', { method: 'POST', json: { email: EMAIL, password: PASS } })).status, 401);
  assert.strictEqual((await call('/api/admin/auth/login', { method: 'POST', json: { email: EMAIL, password: 'NewPassw0rd123' } })).status, 200);
});

test('login rate limiting kicks in after repeated failures', async () => {
  let last = 0;
  for (let i = 0; i < 12; i++) last = (await call('/api/admin/auth/login', { method: 'POST', json: { email: EMAIL, password: 'bad-password-' + i }, auth: false })).status;
  assert.strictEqual(last, 429);
});
