const express = require('express');
const pool = require('./db');
const path = require('node:path');
const router = express.Router();
router.get('/:code', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { code } = req.params;
  if (!/^[A-Za-z0-9_-]{3,48}$/.test(code)) return res.status(404).sendFile(path.join(__dirname, 'pages/not-found.html'));
  try {
    // Eligibility and increment are one statement: an expired link never gains a click.
    const result = req.method === 'HEAD'
      ? await pool.query('SELECT original_url FROM links WHERE code=$1 AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at>statement_timestamp())', [code])
      : await pool.query(`UPDATE links SET clicks=clicks+1 WHERE code=$1 AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at>statement_timestamp()) RETURNING original_url`, [code]);
    if (result.rows.length) return res.redirect(302,result.rows[0].original_url);
    const existing = await pool.query('SELECT deleted_at FROM links WHERE code=$1', [code]);
    const page = !existing.rows.length ? 'not-found' : existing.rows[0].deleted_at ? 'deleted' : 'expired';
    return res.status(page === 'not-found' ? 404 : 410).sendFile(path.join(__dirname, `pages/${page}.html`));
  } catch (err) {
    console.error('Redirect failed:', err.code || 'internal');
    res.status(503).sendFile(path.join(__dirname, 'pages/unavailable.html'));
  }
});
module.exports = router;
