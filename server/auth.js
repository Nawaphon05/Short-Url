const { randomBytes, createHash, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const express = require('express');
const pool = require('./db');
const derive = promisify(scrypt);
const router = express.Router();
const secure = process.env.NODE_ENV === 'production';
const cookieName = secure ? '__Host-short_session' : 'short_session';
const cookieOptions = { httpOnly: true, secure, sameSite: 'lax', path: '/' };
const rememberedLifetime = 7 * 24 * 60 * 60 * 1000;
const normalLifetime = 12 * 60 * 60 * 1000;
const digest = value => createHash('sha256').update(value).digest('hex');
const params = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const attempts = new Map();

function sessionToken(req) {
  const value = (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  return /^[a-f0-9]{64}$/.test(value || '') ? value : null;
}

// A non-simple custom header plus strict Origin checking prevents cross-site form submissions.
function protectMutation(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const allowed = new Set([new URL(process.env.PUBLIC_BASE_URL).origin]);
  if (!secure) {
    allowed.add('http://localhost:5173');
    allowed.add('http://127.0.0.1:5173');
  }
  if (!allowed.has(req.get('origin')) || req.get('x-short-url-client') !== 'web' || !req.is('application/json')) {
    return res.status(403).json({ error: 'คำขอไม่ถูกต้อง กรุณารีเฟรชหน้าแล้วลองใหม่' });
  }
  next();
}

async function requireUser(req, res, next) {
  try {
    const token = sessionToken(req);
    if (!token) return res.status(401).json({ error: 'กรุณา Login อีกครั้ง' });
    const result = await pool.query(`SELECT u.id, u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at > now()`, [digest(token)]);
    if (!result.rows.length) {
      res.clearCookie(cookieName, cookieOptions);
      return res.status(401).json({ error: 'Session หมดอายุ กรุณา Login อีกครั้ง' });
    }
    req.user = result.rows[0];
    res.set('Cache-Control', 'no-store');
    next();
  } catch (error) { next(error); }
}

// Bounded in-memory limiter for this single-instance deployment; resets on restart.
function rateLimit(req, res, next) {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const key = req.ip;
  const entry = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
  if (entry.count >= 15 || (!attempts.has(key) && attempts.size >= 10000)) {
    res.set('Retry-After', String(Math.max(1, Math.ceil((entry.until - now) / 1000))));
    return res.status(429).json({ error: 'ลองบ่อยเกินไป กรุณารอประมาณ 15 นาที' });
  }
  entry.count++;
  attempts.set(key, entry);
  next();
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64, params);
  return `scrypt$32768$8$3$${salt}$${key.toString('hex')}`;
}
async function verifyPassword(password, stored) {
  const [algorithm, n, r, p, salt, key] = stored.split('$');
  if (algorithm !== 'scrypt' || n !== '32768' || r !== '8' || p !== '3' || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(key)) return false;
  const actual = await derive(password, salt, 64, params);
  return timingSafeEqual(actual, Buffer.from(key, 'hex'));
}
function credentials(body) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = body?.password;
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && typeof password === 'string' && password.length >= 1 && password.length <= 128 ? { email, password } : null;
}

router.post('/signup', rateLimit, async (req, res, next) => {
  const input = credentials(req.body);
  if (!input || input.password.length < 6 || input.password.length > 12 || !/[A-Z]/.test(input.password)) return res.status(400).json({ error: 'กรอก Email ให้ถูกต้อง และ Password ยาว 6–12 ตัวอักษร พร้อมตัวพิมพ์ใหญ่ A–Z อย่างน้อย 1 ตัว' });
  try {
    const hash = await hashPassword(input.password);
    await pool.query('INSERT INTO users(email, password_hash) VALUES ($1,$2)', [input.email, hash]);
    res.status(201).json({ message: 'สมัครสำเร็จ กรุณา Login เพื่อเริ่มใช้งาน' });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'ไม่สามารถสมัครด้วย Email นี้ได้ ลอง Login หรือใช้ Email อื่น' });
    next(error);
  }
});
router.post('/login', rateLimit, async (req, res, next) => {
  const input = credentials(req.body);
  if (!input) return res.status(401).json({ error: 'Email หรือ Password ไม่ถูกต้อง' });
  try {
    const result = await pool.query('SELECT id,email,password_hash FROM users WHERE email=$1', [input.email]);
    const user = result.rows[0];
    // Do equivalent password work even when no account exists.
    const dummy = `scrypt$32768$8$3$${'0'.repeat(32)}$${'0'.repeat(128)}`;
    const valid = await verifyPassword(input.password, user?.password_hash || dummy);
    if (!user || !valid) return res.status(401).json({ error: 'Email หรือ Password ไม่ถูกต้อง' });
    const token = randomBytes(32).toString('hex');
    const remember = req.body.remember === true;
    const lifetime = remember ? rememberedLifetime : normalLifetime;
    const old = sessionToken(req);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (old) await client.query('DELETE FROM sessions WHERE token_hash=$1', [digest(old)]);
      await client.query('DELETE FROM sessions WHERE expires_at <= now()');
      await client.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ($1,$2,$3)', [digest(token), user.id, new Date(Date.now() + lifetime)]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
    res.cookie(cookieName, token, { ...cookieOptions, ...(remember ? { maxAge: lifetime } : {}) });
    res.json({ user: { id: user.id, email: user.email } });
  } catch (error) { next(error); }
});
router.get('/me', requireUser, (req, res) => res.json({ user: req.user }));
router.post('/logout', async (req, res, next) => {
  try {
    const token = sessionToken(req);
    if (token) await pool.query('DELETE FROM sessions WHERE token_hash=$1', [digest(token)]);
    res.clearCookie(cookieName, cookieOptions);
    res.status(204).end();
  } catch (error) { next(error); }
});
module.exports = { router, requireUser, protectMutation, hashPassword, verifyPassword };
