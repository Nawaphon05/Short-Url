require('dotenv').config();

const express = require('express');
const pool = require('./db');
const linkRoutes = require('./linkRoutes');
const redirectRoutes = require('./redirectRoutes');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api/links', linkRoutes);
app.use('/r', redirectRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Short URL API is running',
  });
});

async function startServer() {
  try {
    await pool.query('SELECT id FROM links LIMIT 1');

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