'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const configPath = path.join(root, 'client', 'js', 'supabase-config.js');
const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey = (process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();

if (!supabaseUrl || !publishableKey) {
  throw new Error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in the Netlify environment.');
}

let parsedUrl;
try {
  parsedUrl = new URL(supabaseUrl);
} catch {
  throw new Error('SUPABASE_URL must be a valid HTTPS URL.');
}
if (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password) {
  throw new Error('SUPABASE_URL must be a valid HTTPS URL.');
}
if (/secret|service[_-]?role/i.test(publishableKey)) {
  throw new Error('SUPABASE_PUBLISHABLE_KEY must not contain a secret or service-role key.');
}
if (publishableKey.startsWith('sb_publishable_') && publishableKey.length < 24) {
  throw new Error('SUPABASE_PUBLISHABLE_KEY is incomplete.');
}

const jwtParts = publishableKey.split('.');
if (!publishableKey.startsWith('sb_publishable_') && jwtParts.length === 3) {
  try {
    const claims = JSON.parse(Buffer.from(jwtParts[1], 'base64url').toString('utf8'));
    if (claims.role !== 'anon') throw new Error();
  } catch {
    throw new Error('SUPABASE_PUBLISHABLE_KEY must be a publishable or legacy anon key.');
  }
} else if (!publishableKey.startsWith('sb_publishable_')) {
  throw new Error('SUPABASE_PUBLISHABLE_KEY must be a publishable or legacy anon key.');
}

const source = fs.readFileSync(configPath, 'utf8');
const match = source.match(/whatsappNumber:\s*(['"])(\d{8,15})\1/);
if (!match) throw new Error('Could not read the configured WhatsApp number.');

const output = `window.SB_CONFIG = Object.freeze(${JSON.stringify({
  supabaseUrl: parsedUrl.origin,
  supabasePublishableKey: publishableKey,
  whatsappNumber: match[2]
}, null, 2)});\n`;
fs.writeFileSync(configPath, output);
console.log('Generated the public Supabase configuration.');
