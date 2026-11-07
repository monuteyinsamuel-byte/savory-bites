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
    image_url: '/dish.png',
    is_active: true,
    is_popular: false,
    sort_order: 5,
    created_at: '2026-01-01T00:00:00Z',
    hours: [{ opens_at: '09:00', closes_at: '17:00' }]
  };
  const browser = sb.fromSupabase(database);
  assert.equal(browser.imageUrl, '/dish.png');
  assert.equal(browser.isActive, true);
  assert.equal(browser.isPopular, false);
  assert.equal(browser.sortOrder, 5);
  assert.equal(browser.createdAt, '2026-01-01T00:00:00Z');
  assert.equal(browser.hours[0].opensAt, '09:00');
  assert.equal(JSON.stringify(sb.toSupabase(browser)), JSON.stringify(database));
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
