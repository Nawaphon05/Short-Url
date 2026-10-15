const express = require('express');
const { randomBytes } = require('node:crypto');
const pool = require('./db');

const router = express.Router();

function validateUrl(value) {
  if (typeof value !== 'string' || value.length > 4096) {
    return null;
  }

  try {
    const url = new URL(value.trim());

    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }

    if (url.username || url.password) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

async function createLink(originalUrl) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomBytes(6).toString('base64url');

    try {
      const result = await pool.query(
        `INSERT INTO links (code, original_url)
         VALUES ($1, $2)
         RETURNING *`,
        [code, originalUrl]
      );

      return result.rows[0];
    } catch (error) {
      if (error.code !== '23505') {
        throw error;
      }
    }
  }

  throw new Error('Could not generate a unique code');
}

router.post('/', async (req, res) => {
  const originalUrl = validateUrl(req.body?.url);

  if (!originalUrl) {
    return res.status(400).json({
      error: 'Please enter a valid HTTP or HTTPS URL',
    });
  }

  try {
    const link = await createLink(originalUrl);
    const baseUrl = process.env.PUBLIC_BASE_URL.replace(/\/+$/, '');

    res.status(201).json({
      ...link,
      short_url: `${baseUrl}/r/${link.code}`,
    });
  } catch (error) {
    console.error('Create link failed:', error.message);

    res.status(500).json({
      error: 'Cannot create short URL',
    });
  }
});

router.get('/', async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = 20;

  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) {
    return res.status(400).json({
      error: 'Invalid page number',
    });
  }

  const offset = (page - 1) * limit;

  try {
    const result = await pool.query(
      `SELECT id, code, original_url, clicks, created_at
       FROM links
       ORDER BY created_at DESC, id DESC
       LIMIT $1 OFFSET $2`,
      [limit + 1, offset]
    );

    const baseUrl = process.env.PUBLIC_BASE_URL.replace(/\/+$/, '');

    const items = result.rows.slice(0, limit).map((link) => ({
      ...link,
      short_url: `${baseUrl}/r/${link.code}`,
    }));

    res.set('Cache-Control', 'no-store');

    res.json({
      items,
      page,
      hasMore: result.rows.length > limit,
    });
  } catch (error) {
    console.error('Load history failed:', error.message);

    res.status(500).json({
      error: 'Cannot load link history',
    });
  }
});

module.exports = router;