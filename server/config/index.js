'use strict';
const crypto = require('crypto');
require('dotenv').config();

const env = process.env;
const isProd = env.NODE_ENV === 'production';

/* ---------------------------------------------------------------
   CENTRAL WHATSAPP CONFIGURATION
   Restaurant number in international format (digits only, no "+").
   Local 08164212898 -> 2348164212898. Every WhatsApp button on the
   site reads this single value (served to the browser by the API).
   Override with the WHATSAPP_NUMBER environment variable if needed.
---------------------------------------------------------------- */
const WHATSAPP_NUMBER = (env.WHATSAPP_NUMBER || '2348164212898').replace(/\D/g, '');

const sessionSecret = env.SESSION_SECRET || '';
if (isProd) {
  if (!env.MONGODB_URI) throw new Error('MONGODB_URI is required in production.');
  if (sessionSecret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters in production.');
}

module.exports = {
  isProd,
  port: parseInt(env.PORT, 10) || 3000,
  mongoUri: env.MONGODB_URI || 'mongodb://127.0.0.1:27017/savory-bites',
  sessionSecret: sessionSecret || crypto.randomBytes(32).toString('hex'), // dev only: sessions reset on restart
  whatsappNumber: WHATSAPP_NUMBER,
  setupToken: env.SETUP_TOKEN || '',
  allowedOrigins: (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  maxImageMb: Number(env.MAX_IMAGE_MB) || 3,
  get maxImageBytes() { return this.maxImageMb * 1024 * 1024; },
  sessionHours: 8,
  seedSampleData: env.SEED_SAMPLE_DATA !== 'false'
};
