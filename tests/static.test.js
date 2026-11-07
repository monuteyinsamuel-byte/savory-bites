'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const walk = (d, ext, out = []) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) { if (f.name !== 'node_modules') walk(p, ext, out); } else if (p.endsWith(ext)) out.push(p); } return out; };

test('every stylesheet: media queries are max-width, unique, and ordered largest → smallest', () => {
  const sheets = walk(path.join(root, 'client'), '.css');
  assert.ok(sheets.length >= 2);
  for (const f of sheets) {
    const css = fs.readFileSync(f, 'utf8');
    const queries = [...css.matchAll(/@media\s*([^{]+)\{/g)].map(m => m[1].trim());
    assert.ok(queries.length > 0, `${f} has no media queries`);
    const widths = queries.map(q => { const m = /^\(max-width:\s*(\d+)px\)$/.exec(q); assert.ok(m, `${f}: unexpected media query "${q}"`); return +m[1]; });
    assert.deepStrictEqual(widths, [...new Set(widths)].sort((a, b) => b - a), `${f}: ${widths.join(', ')}`);
    // all media blocks must come after every normal rule
    const firstMedia = css.indexOf('@media');
    assert.ok(!/\}\s*[^@\s}][^{]*\{/.test(css.slice(css.lastIndexOf('}', css.indexOf('@media', firstMedia)) + 1).replace(/@media[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')), `${f}: normal rules found after the first @media`);
  }
});

test('HTML pages: local assets exist, no inline scripts/handlers/styles (CSP-safe)', () => {
  const pages = [...walk(path.join(root, 'client'), '.html'), ...walk(path.join(root, 'server', 'views'), '.html')];
  for (const f of pages) {
    const html = fs.readFileSync(f, 'utf8');
    assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), `${f}: inline script`);
    assert.ok(!/\son[a-z]+\s*=/i.test(html), `${f}: inline event handler`);
    assert.ok(!/\sstyle\s*=/i.test(html), `${f}: inline style attribute`);
    for (const m of html.matchAll(/(?:src|href)="(\/[^"#]*)"/g)) {
      const p = m[1] === '/' ? '/index.html' : m[1];
      if (p.startsWith('/api') || p === '/admin') continue;
      assert.ok(fs.existsSync(path.join(root, 'client', p)), `${f}: missing ${p}`);
    }
  }
});

test('WhatsApp number lives in one place and no other phone number is hard-coded in the client', () => {
  const files = [...walk(path.join(root, 'client'), '.js'), ...walk(path.join(root, 'client'), '.html'), ...walk(path.join(root, 'server', 'views'), '.html')];
  const configPath = path.join(root, 'client', 'js', 'supabase-config.js');
  for (const f of files.filter(f => f !== configPath)) assert.ok(!/\d{10,}/.test(fs.readFileSync(f, 'utf8')), `${f}: contains a long digit sequence`);
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(configPath, 'utf8'), context);
  assert.strictEqual(context.window.SB_CONFIG.whatsappNumber, '2348164212898');
  const wa = [...walk(path.join(root, 'client'), '.js')].filter(f => fs.readFileSync(f, 'utf8').includes('wa.me'));
  assert.deepStrictEqual(wa.map(f => path.basename(f)), ['main.js']);
});

test('Netlify deployment routes the dashboard and publishes static headers', () => {
  const redirects = fs.readFileSync(path.join(root, 'client', '_redirects'), 'utf8');
  const headers = fs.readFileSync(path.join(root, 'client', '_headers'), 'utf8');
  const netlify = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
  assert.match(netlify, /publish\s*=\s*"client"/);
  assert.match(redirects, /^\/admin\s+\/admin\/index\.html\s+200$/m);
  assert.match(headers, /X-Content-Type-Options:\s*nosniff/);
  assert.match(headers, /X-Frame-Options:\s*DENY/);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.start, undefined);
  assert.deepStrictEqual(pkg.dependencies, {});
});

test('deployed frontend does not call the retired Express API', () => {
  const scripts = walk(path.join(root, 'client'), '.js');
  for (const f of scripts) {
    const source = fs.readFileSync(f, 'utf8');
    assert.ok(!/\/api\/(?:admin|public|setup)\b/.test(source), `${f}: references an Express API`);
  }
});
