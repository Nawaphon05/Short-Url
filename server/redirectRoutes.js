const express = require('express');
const pool = require('./db');

const router = express.Router();

router.get('/:code', async (req, res) => {
  const { code } = req.params;

  if (!/^[A-Za-z0-9_-]{8}$/.test(code)) {
    return res.status(404).send('Link not found');
  }

  try {
    const result = req.method === 'HEAD'
      ? await pool.query(
          'SELECT original_url FROM links WHERE code = $1',
          [code]
        )
      : await pool.query(
          `UPDATE links
           SET clicks = clicks + 1
           WHERE code = $1
           RETURNING original_url`,
          [code]
        );

    if (result.rows.length === 0) {
      return res.status(404).send('Link not found');
    }

    res.set('Cache-Control', 'no-store');
    res.redirect(302, result.rows[0].original_url);
  } catch (error) {
    console.error('Redirect failed:', error.message);

    res.status(500).send('Cannot open this link');
  }
});

module.exports = router;