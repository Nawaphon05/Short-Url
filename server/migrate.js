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
  for (const file of ['001_auth.sql', '002_link_management.sql', '003_soft_delete.sql']) {
    await pool.query((await fs.readFile(path.join(__dirname, 'migrations', file), 'utf8')).replace(/^\uFEFF/, ''));
  }
  console.log('Local migrations complete. Existing links are retained.');
}
migrate().catch(() => { console.error('Migration failed. Check local connection and migration SQL; hosting is not modified.'); process.exitCode = 1; }).finally(() => pool.end());
