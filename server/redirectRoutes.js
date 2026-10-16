const express = require('express');
const path = require('node:path');
const { getRedirectConfig } = require('./redirectConfig');
const router = express.Router();
const page = (res, status, name) => res.status(status).sendFile(path.join(__dirname, `pages/${name}.html`));
router.get('/:code', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { code } = req.params;
  if (!/^[A-Za-z0-9_-]{3,48}$/.test(code)) return page(res,404,'not-found');
  const config = getRedirectConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeout);
  const disconnect = () => { if (!res.writableEnded) controller.abort(); };
  res.on('close', disconnect);
  try {
    // Never forward user cookies, user headers, or automatically follow Location with our token.
    // No retries: a timed-out request may already have committed its click.
    const upstream = await fetch(`${config.origin}/internal/links/${encodeURIComponent(code)}`, {
      method: req.method, redirect: 'manual', signal: controller.signal,
      headers: { Authorization: `Bearer ${config.token}` },
    });
    const status = upstream.status;
    const location = upstream.headers.get('location');
    const state = upstream.headers.get('x-link-state');
    await upstream.body?.cancel();
    if (res.destroyed) return;
    if (controller.signal.aborted) throw new Error('Redirect timeout');
    if (status === 302 && location) {
      const target = new URL(location);
      if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) throw new Error('Invalid redirect destination');
      return res.redirect(302,target.href);
    }
    if (status === 404) return page(res,404,'not-found');
    if (status === 410 && ['expired','deleted'].includes(state)) return page(res,410,state);
    throw new Error('Redirect service unavailable');
  } catch {
    if (!res.destroyed) return page(res,503,'unavailable');
  } finally {
    clearTimeout(timer); res.off('close',disconnect);
  }
});
module.exports = router;
