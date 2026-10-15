const { Pool } = require('pg');

const pool = new Pool({
  connectionTimeoutMillis: 5000,
});

module.exports = pool;