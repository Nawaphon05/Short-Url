const express = require('express');
const { randomBytes } = require('node:crypto');
const pool = require('./db');
const router = express.Router();
router.use(require('./auth').requireUser);
const codePattern = /^[A-Za-z0-9_-]{3,48}$/;
function validateUrl(value) {
  if (typeof value !== 'string' || value.length > 4096) return null;
  try {
    const url = new URL(value.trim());
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
function present(link) {
  return { ...link, short_url: `${process.env.PUBLIC_BASE_URL.replace(/\/+$/, '')}/r/${link.code}` };
}
router.post('/', async (req, res) => {
  const originalUrl = validateUrl(req.body?.url);
  if (!originalUrl) return res.status(400).json({ error: 'กรุณาใส่ URL แบบ HTTP หรือ HTTPS ที่ไม่มีชื่อผู้ใช้หรือรหัสผ่าน' });
  const { title = '', custom_code = '', expires_at = null } = req.body;
  if (typeof title !== 'string' || title.trim().length > 120) return res.status(400).json({ error: 'ชื่อลิงก์ต้องไม่เกิน 120 ตัวอักษร' });
  if (typeof custom_code !== 'string' || (custom_code && !codePattern.test(custom_code))) return res.status(400).json({ error: 'รหัสลิงก์ใช้ A–Z, a–z, 0–9, - และ _ ความยาว 3–48 ตัวอักษร' });
  // Require an explicit timezone so local browser time is never mistaken for server time.
  const expiry = expires_at === null ? null : typeof expires_at === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(expires_at) ? new Date(expires_at) : new Date(NaN);
  if (expiry && (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now())) return res.status(400).json({ error: 'วันหมดอายุต้องเป็นวันและเวลาในอนาคต' });
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = custom_code || randomBytes(6).toString('base64url');
      try {
        const result = await pool.query(`INSERT INTO links(code,original_url,user_id,title,expires_at) VALUES($1,$2,$3,$4,$5) RETURNING *`, [code, originalUrl, req.user.id, title.trim(), expiry]);
        return res.status(201).json(present(result.rows[0]));
      } catch (err) {
        if (err.code !== '23505') throw err;
        if (custom_code) return res.status(409).json({ error: 'รหัสลิงก์นี้ถูกใช้แล้ว กรุณาเลือกรหัสอื่น' });
      }
    }
    throw new Error('Code collision retry limit');
  } catch (err) {
    console.error('Create link failed:', err.code || 'internal');
    res.status(500).json({ error: 'สร้างลิงก์ไม่สำเร็จ กรุณาลองใหม่' });
  }
});
router.patch('/:id', async (req, res) => {
  if (!/^\d{1,18}$/.test(req.params.id)) return res.status(404).json({ error: 'ไม่พบลิงก์นี้' });
  if (typeof req.body?.title !== 'string' || req.body.title.trim().length > 120) return res.status(400).json({ error: 'ชื่อลิงก์ต้องไม่เกิน 120 ตัวอักษร' });
  try {
    const result = await pool.query('UPDATE links SET title=$1 WHERE id=$2 AND user_id=$3 AND deleted_at IS NULL RETURNING *', [req.body.title.trim(), req.params.id, req.user.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'ไม่พบลิงก์นี้' });
    res.json(present(result.rows[0]));
  } catch (err) {
    console.error('Rename failed:', err.code || 'internal');
    res.status(500).json({ error: 'บันทึกชื่อไม่สำเร็จ กรุณาลองใหม่' });
  }
});
// Keep the row and unique code reserved so an old QR can never point to a new owner.
router.delete('/:id', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!/^\d{1,18}$/.test(req.params.id)) return res.status(404).json({ error: 'ไม่พบลิงก์นี้' });
  try {
    const result = await pool.query('UPDATE links SET deleted_at=now() WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL RETURNING id', [req.params.id, req.user.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'ไม่พบลิงก์นี้' });
    res.status(204).end();
  } catch (err) {
    console.error('Delete link failed:', err.code || 'internal');
    res.status(500).json({ error: 'ลบลิงก์ไม่สำเร็จ กรุณาลองอีกครั้ง' });
  }
});
router.get('/', async (req, res) => {
  const page = Number(req.query.page || 1), limit = 10;
  const q = req.query.q ?? '';
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) return res.status(400).json({ error: 'เลขหน้าไม่ถูกต้อง' });
  if (typeof q !== 'string' || q.length > 200) return res.status(400).json({ error: 'คำค้นต้องไม่เกิน 200 ตัวอักษร' });
  try {
    // position() treats %, _ and backslashes literally; scope to owner before pagination.
    const result = await pool.query(`SELECT id,code,original_url,clicks,created_at,title,expires_at FROM links
      WHERE user_id=$3 AND deleted_at IS NULL AND ($4='' OR position(lower($4) in lower(title))>0 OR position(lower($4) in lower(original_url))>0 OR position(lower($4) in lower(code))>0)
      ORDER BY created_at DESC,id DESC LIMIT $1 OFFSET $2`, [limit + 1, (page - 1) * limit, req.user.id, q.trim()]);
    res.set('Cache-Control', 'no-store').json({ items: result.rows.slice(0,limit).map(present), page, hasMore: result.rows.length > limit });
  } catch (err) {
    console.error('History failed:', err.code || 'internal');
    res.status(500).json({ error: 'โหลดประวัติไม่สำเร็จ กรุณาลองใหม่' });
  }
});
module.exports = router;
