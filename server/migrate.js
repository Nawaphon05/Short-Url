const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const fs = require('node:fs/promises');
const pool = require('./db');

async function migrate() {
  // Never silently apply a local development command to the hosted database.
  const host = new (require('pg').Client)(pool.options).connectionParameters.host;
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    throw new Error('Local migration only. Apply reviewed SQL manually on hosting after backup.');
  }
  await pool.query(await fs.readFile(path.join(__dirname, 'migrations/001_auth.sql'), 'utf8'));
  console.log('Auth migration complete. Existing links are retained without an owner.');
}
migrate().catch(() => { console.error('Migration failed. Check local connection and migration SQL; hosting is not modified.'); process.exitCode = 1; }).finally(() => pool.end());
