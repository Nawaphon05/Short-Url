const path = require('node:path');
require('dotenv').config({ path:path.join(__dirname,'.env'), quiet:true });
const express = require('express');
const { Pool } = require('pg');
const { createHash, timingSafeEqual } = require('node:crypto');
const token = process.env.REDIRECT_SERVICE_TOKEN;
if (!token || token.startsWith('replace-with-') || !/^[A-Za-z0-9_-]{32,256}$/.test(token)) throw new Error('Set a 32-256 character URL-safe REDIRECT_SERVICE_TOKEN');
const digest = value => createHash('sha256').update(value).digest();
const expected = digest(`Bearer ${token}`);
const appUrl = process.env.PUBLIC_BASE_URL ? new URL(process.env.PUBLIC_BASE_URL) : null;
if (appUrl && (!['http:', 'https:'].includes(appUrl.protocol) || appUrl.username || appUrl.password || appUrl.pathname !== '/' || appUrl.search || appUrl.hash)) throw new Error('PUBLIC_BASE_URL must be the main web service origin');
const pool = new Pool({ ...(process.env.DATABASE_URL ? { connectionString:process.env.DATABASE_URL } : {}), max:5, connectionTimeoutMillis:5000, statement_timeout:10000 });
const app = express();
app.disable('x-powered-by');
app.use((req,res,next) => { res.set('Cache-Control','no-store'); next(); });
app.get('/', (req,res) => appUrl ? res.redirect(302, appUrl.origin) : res.status(503).send('Main web URL is not configured. Please return to the original Short URL website.'));
app.get('/healthz', async (req,res) => {
  try { await pool.query('SELECT 1'); res.json({status:'ok',service:'redirect'}); }
  catch { res.status(503).json({status:'unavailable'}); }
});
app.use('/internal', (req,res,next) => {
  if (!timingSafeEqual(digest(req.get('authorization') || ''),expected)) return res.status(401).json({error:'Unauthorized'});
  next();
});
async function resolveLink(req,res) {
  const publicRoute = req.path.startsWith('/r/');
  const page = (status, name) => res.status(status).sendFile(path.join(__dirname, `pages/${name}.html`));
  const {code} = req.params;
  if (!/^[A-Za-z0-9_-]{3,48}$/.test(code)) return publicRoute ? page(404,'not-found') : res.status(404).end();
  try {
    const result = req.method === 'HEAD'
      ? await pool.query('SELECT original_url FROM links WHERE code=$1 AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at>statement_timestamp())',[code])
      : await pool.query('UPDATE links SET clicks=clicks+1 WHERE code=$1 AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at>statement_timestamp()) RETURNING original_url',[code]);
    if (result.rows.length) return res.status(302).set('Location',result.rows[0].original_url).end();
    const existing = await pool.query('SELECT deleted_at FROM links WHERE code=$1',[code]);
    if (!existing.rows.length) return publicRoute ? page(404,'not-found') : res.status(404).end();
    const state = existing.rows[0].deleted_at ? 'deleted' : 'expired';
    return publicRoute ? page(410,state) : res.status(410).set('X-Link-State',state).end();
  } catch (err) {
    console.error('Resolve failed:',err.code || 'internal');
    if (publicRoute) return page(503,'unavailable');
    res.status(503).json({error:'Service unavailable'});
  }
}
app.get('/internal/links/:code', resolveLink);
// Public short links are intentionally accessible without a session, just as
// /r/:code on the main service. Management and /internal remain protected.
app.get('/r/:code', resolveLink);
app.use((req,res) => res.status(404).end());
let server;
async function start() {
  await pool.query('SELECT code,original_url,clicks,expires_at,deleted_at FROM links LIMIT 1');
  server = app.listen(process.env.PORT || 3001, () => console.log('Redirect service ready'));
  server.on('error',async err => { console.error('Listen failed:',err.code); await pool.end(); process.exitCode=1; });
}
for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => {
  if (!server) return;
  server.close(() => pool.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1),10000).unref();
});
start().catch(async err => { console.error('Redirect startup failed:',err.code || 'configuration'); await pool.end(); process.exitCode=1; });
