const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const pool = require('./db');
const linkRoutes = require('./linkRoutes');
const redirectRoutes = require('./redirectRoutes');
const app = express();
const auth = require('./auth');
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use(express.json({ limit: '16kb' }));
app.use('/api', auth.protectMutation);
app.use('/api/auth', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, auth.router);
app.use('/api/links', linkRoutes);
app.use('/r', redirectRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Short URL API is running',
  });
});

// Serve the Vue production build from the same origin as the API.
// Unmatched API and redirect routes keep their normal 404 response.
app.use(express.static(path.join(__dirname, '../client/dist')));
app.use((error, req, res, next) => {
  console.error('Request failed:', error.code || error.type || 'internal');
  res.status(error.status === 400 ? 400 : error.status === 413 ? 413 : 500).json({ error: 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่' });
});

async function startServer() {
  try {
    const baseUrl = new URL(process.env.PUBLIC_BASE_URL);
    if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password || baseUrl.pathname !== '/' || baseUrl.search || baseUrl.hash) {
      throw new Error('PUBLIC_BASE_URL must be an HTTP(S) origin, e.g. https://your-app.onrender.com');
    }
    await pool.query('SELECT id FROM links LIMIT 1');
    await pool.query('SELECT id FROM users LIMIT 1');
    await pool.query('SELECT token_hash FROM sessions LIMIT 1');
    await pool.query('SELECT user_id, title, expires_at, deleted_at FROM links LIMIT 1');

    console.log('Connected to PostgreSQL');

    app.listen(PORT, () => {
      console.log(`Server is running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Cannot start server:', error.message);
    await pool.end();
    process.exitCode = 1;
  }
}

startServer();
