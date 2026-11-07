'use strict';
const mongoose = require('mongoose');
const config = require('./config');
const { createApp } = require('./app');
const { ensureDefaults } = require('./services/seed');

async function main() {
  mongoose.set('sanitizeFilter', true); // extra NoSQL-injection guard: treats $-operators in filters as literals
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
  await ensureDefaults();
  const app = createApp();
  const server = app.listen(config.port, () => console.log(`Savory Bites running on port ${config.port}`));
  const stop = () => server.close(() => mongoose.disconnect().then(() => process.exit(0)));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
main().catch(err => { console.error('Failed to start:', err.message); process.exit(1); });
