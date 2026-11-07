'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const clientSource = fs.readFileSync(path.join(root, 'client', 'js', 'supabase-client.js'), 'utf8');

function loadClient({ config = {}, supabase } = {}) {
  const window = { SB: {}, SB_CONFIG: config, supabase };
  vm.runInNewContext(clientSource, { window, URL });
  return window.SB;
}

test('snake_case database fields map to camelCase and back, including nested JSON', () => {
  const sb = loadClient();
  const database = {
    name: 'Savory Bites',
    tagline: 'Fresh and seasonal',
    introduction: 'Welcome',
    description: 'Restaurant description',
    address: '1 Market Street',
    map_url: 'https://maps.example.test',
    key: 'main',
    email: 'hello@example.test',
    phone: '+234 800 000 0000',
    currency: '₦',
    notice: '',
    hours: [{ day: 'Monday–Friday', time: '09:00–17:00' }],
    image: '/dish.png',
    is_active: true,
    is_popular: false,
    sort_order: 5,
    created_at: '2026-01-01T00:00:00Z',
  };
  const browser = sb.fromSupabase(database);
  assert.equal(browser.mapUrl, 'https://maps.example.test');
  assert.equal(browser.key, 'main');
  assert.equal(browser.name, 'Savory Bites');
  assert.equal(browser.image, '/dish.png');
  assert.equal(browser.isActive, true);
  assert.equal(browser.isPopular, false);
  assert.equal(browser.sortOrder, 5);
  assert.equal(browser.createdAt, '2026-01-01T00:00:00Z');
  assert.equal(browser.hours[0].day, 'Monday–Friday');
  assert.equal(browser.hours[0].time, '09:00–17:00');
  assert.equal(JSON.stringify(sb.toSupabase(browser)), JSON.stringify(database));
});

test('menu and gallery image operations use the existing image column', () => {
  const admin = fs.readFileSync(path.join(root, 'client', 'admin', 'js', 'admin.js'), 'utf8');
  const frontend = fs.readFileSync(path.join(root, 'client', 'js', 'main.js'), 'utf8');
  assert.match(admin, /image:\s*item\s*\?\s*item\.image/);
  assert.match(admin, /data\.image\s*=\s*uploaded\.url/);
  assert.match(admin, /select\('image'\)\.eq\('image',\s*imageUrl\)/);
  assert.match(frontend, /item\.image\s*\|\|\s*''/);
  assert.doesNotMatch(`${admin}\n${frontend}`, /image_url|\.imageUrl/);
  assert.match(admin, /s\.key\s*\?\s*\['key',\s*s\.key\]/);
  assert.match(admin, /data\.hours\s*=\s*\[\.\.\.hoursBox\.children\]/);
});

test('client initializes once with only the configured public credentials', () => {
  let calls = 0;
  const expected = { from: () => ({}) };
  const sb = loadClient({
    config: { supabaseUrl: 'https://demo-project.supabase.co', supabasePublishableKey: 'sb_publishable_public' },
    supabase: {
      createClient(url, key) {
        calls++;
        assert.equal(url, 'https://demo-project.supabase.co');
        assert.equal(key, 'sb_publishable_public');
        return expected;
      }
    }
  });
  assert.equal(sb.supabaseClient(), expected);
  assert.equal(sb.supabaseClient(), expected);
  assert.equal(calls, 1);
});

test('client reports missing public configuration clearly', () => {
  assert.throws(() => loadClient().supabaseClient(), /Supabase is not configured/);
});

test('static build emits public config and rejects service-role credentials', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'savory-bites-build-'));
  try {
    fs.mkdirSync(path.join(temp, 'scripts'));
    fs.mkdirSync(path.join(temp, 'client', 'js'), { recursive: true });
    fs.copyFileSync(path.join(root, 'scripts', 'build-static.js'), path.join(temp, 'scripts', 'build-static.js'));
    fs.copyFileSync(path.join(root, 'client', 'js', 'supabase-config.js'), path.join(temp, 'client', 'js', 'supabase-config.js'));
    const configPath = path.join(temp, 'client', 'js', 'supabase-config.js');
    const env = {
      ...process.env,
      SUPABASE_URL: 'https://demo-project.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_key_for_unit_tests'
    };
    const built = spawnSync(process.execPath, [path.join(temp, 'scripts', 'build-static.js')], { env, encoding: 'utf8' });
    assert.equal(built.status, 0, built.stderr);
    const output = fs.readFileSync(configPath, 'utf8');
    assert.match(output, /https:\/\/demo-project\.supabase\.co/);
    assert.match(output, /sb_publishable_test_key_for_unit_tests/);
    assert.match(output, /2348164212898/);
    const builtContext = { window: {} };
    vm.runInNewContext(output, builtContext);
    assert.deepEqual(Object.keys(builtContext.window.SB_CONFIG).sort(), [
      'supabasePublishableKey', 'supabaseUrl', 'whatsappNumber'
    ]);
    assert.doesNotMatch(output, /sb_secret_|service[_-]?role|MONGODB_URI|DATABASE_URL|DB_PASSWORD/i);

    const rejected = spawnSync(process.execPath, [path.join(temp, 'scripts', 'build-static.js')], {
      env: { ...env, SUPABASE_PUBLISHABLE_KEY: 'sb_secret_do_not_publish' },
      encoding: 'utf8'
    });
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /must not contain a secret or service-role key/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('checked-in browser config contains no build credentials and scanning remains enabled', () => {
  const config = fs.readFileSync(path.join(root, 'client', 'js', 'supabase-config.js'), 'utf8');
  assert.doesNotMatch(config, /supabaseUrl|supabasePublishableKey|sb_publishable_|sb_secret_|service[_-]?role/i);
  const netlify = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
  assert.doesNotMatch(netlify, /SECRETS_SCAN_ENABLED\s*=\s*["']?false/i);
});
