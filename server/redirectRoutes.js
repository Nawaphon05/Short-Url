const express = require('express');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { getRedirectConfig } = require('./redirectConfig');
const router = express.Router();
const page = (res, status, name) => res.status(status).sendFile(path.join(__dirname, `pages/${name}.html`));
async function waitUntilReady(config, signal) {
  // Hosting can return a loading page before the process is ready. Probe only
  // this read-only endpoint; never retry the request that increments clicks.
  const started = Date.now();
  let attempts = 0, last = 'not-started';
  while (!signal.aborted) {
    attempts++;
    try {
      // A stalled connection/body must not consume the entire readiness budget.
      const probeSignal = AbortSignal.any([signal, AbortSignal.timeout(5000)]);
      const response = await fetch(`${config.origin}/healthz`, { redirect: 'manual', signal: probeSignal });
      last = `http-${response.status}`;
      if (response.status === 200 && response.headers.get('content-type')?.includes('application/json')) {
        const health = await response.json();
        if (health.status === 'ok' && health.service === 'redirect') {
          if (attempts > 1) console.info('Redirect readiness recovered:', JSON.stringify({ attempts, elapsedMs: Date.now() - started }));
          return;
        }
        last = 'invalid-health';
      } else {
        if (response.status === 200) last = 'non-json-health';
        await response.body?.cancel();
      }
    } catch (error) {
      const code = error.cause?.code;
      last = signal.aborted ? last : error.name === 'TimeoutError' ? 'probe-timeout' : /^[A-Z0-9_]+$/.test(code || '') ? code : 'probe-error';
      if (signal.aborted) break;
    }
    try { await delay(1000, undefined, { signal }); }
    catch { break; }
  }
  console.error('Redirect readiness exhausted:', JSON.stringify({ attempts, elapsedMs: Date.now() - started, last }));
  throw new Error('Redirect readiness timeout');
}
router.get('/:code', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { code } = req.params;
  if (!/^[A-Za-z0-9_-]{3,48}$/.test(code)) return page(res,404,'not-found');
  const config = getRedirectConfig();
  // Let the visitor's browser reach the hosting wake-up page directly. This
  // hop never resolves/increments a link or exposes service credentials.
  if (config.mode === 'browser') return res.redirect(302, `${config.origin}/r/${encodeURIComponent(code)}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeout);
  const disconnect = () => { if (!res.writableEnded) controller.abort(); };
  res.on('close', disconnect);
  let stage = 'readiness';
  try {
    await waitUntilReady(config, controller.signal);
    stage = 'resolve';
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
    console.error('Redirect upstream status:', status);
    throw new Error('Redirect service unavailable');
  } catch {
    if (!res.destroyed) {
      console.error('Redirect request failed:', stage, controller.signal.aborted ? 'timeout' : 'upstream');
      return page(res,503,'unavailable');
    }
  } finally {
    clearTimeout(timer); res.off('close',disconnect);
  }
});
module.exports = router;
