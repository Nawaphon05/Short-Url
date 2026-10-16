function getRedirectConfig() {
  if (!process.env.REDIRECT_SERVICE_URL) return null;
  const url = new URL(process.env.REDIRECT_SERVICE_URL);
  const local = ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local && process.env.NODE_ENV !== 'production')) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('REDIRECT_SERVICE_URL must be an HTTPS origin (HTTP loopback is allowed locally)');
  }
  const token = process.env.REDIRECT_SERVICE_TOKEN;
  if (!token || token.startsWith('replace-with-') || !/^[A-Za-z0-9_-]{32,256}$/.test(token)) throw new Error('REDIRECT_SERVICE_TOKEN must contain 32-256 URL-safe characters');
  const timeout = Number(process.env.REDIRECT_SERVICE_TIMEOUT_MS || 70000);
  if (!Number.isInteger(timeout) || timeout < 100 || timeout > 90000) throw new Error('Redirect timeout must be 100-90000 ms');
  return { origin:url.origin, token, timeout };
}
module.exports = { getRedirectConfig };
