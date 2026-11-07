'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { strip } = require('../middleware/sanitize');
const v = require('../middleware/validate');
const { sniff } = require('../services/imageStorage');
const { formatDisplay } = require('../services/whatsapp');

test('sanitize removes operator and prototype keys', () => {
  const out = strip(JSON.parse('{"email":{"$ne":""},"a.b":1,"__proto__":{"x":1},"ok":"y","n":[{"$gt":1,"k":2}]}'));
  assert.deepStrictEqual(out, { email: {}, ok: 'y', n: [{ k: 2 }] });
  assert.strictEqual(({}).x, undefined);
});
test('validators', () => {
  const e = {};
  assert.strictEqual(v.text({ a: '  hi\u0000 ' }, 'a', { max: 5 }, e), 'hi');
  v.text({ a: 'x'.repeat(9) }, 'a', { max: 5 }, e); assert.ok(e.a);
  const e2 = {}; v.text({ a: { $ne: 1 } }, 'a', { max: 5 }, e2); assert.ok(e2.a);
  const e3 = {}; v.number({ p: '-1' }, 'p', { min: 0 }, e3); assert.ok(e3.p);
  assert.strictEqual(v.number({ p: '12.5' }, 'p', { min: 0 }, {}), 12.5);
  assert.ok(v.passwordProblem('short1')); assert.ok(v.passwordProblem('onlyletterspassword')); assert.strictEqual(v.passwordProblem('goodpassw0rd!'), null);
  assert.ok(v.isHttpsUrl('https://maps.example.com') && !v.isHttpsUrl('javascript:alert(1)') && !v.isHttpsUrl('http://x.com'));
  assert.ok(v.isObjectId('a'.repeat(24)) && !v.isObjectId('{"$ne":1}'));
});
test('image sniffing accepts only real JPG/PNG/WebP', () => {
  const pad = Buffer.alloc(16);
  assert.strictEqual(sniff(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), pad])), 'image/jpeg');
  assert.strictEqual(sniff(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pad])), 'image/png');
  assert.strictEqual(sniff(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), pad])), 'image/webp');
  assert.strictEqual(sniff(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')), null);
  assert.strictEqual(sniff(Buffer.from('GIF89a' + 'x'.repeat(20))), null);
});
test('WhatsApp display format', () => {
  assert.strictEqual(formatDisplay('2348164212898'), '+234 816 421 2898');
});
