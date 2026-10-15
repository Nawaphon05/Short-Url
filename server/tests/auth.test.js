const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const { Pool } = require('pg');

test('auth, ownership, migration and public redirects against isolated local PostgreSQL schema', { timeout: 60000 }, async () => {
  const pool = new Pool(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {});
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(new (require('pg').Client)(pool.options).connectionParameters.host), 'Tests only run against local PostgreSQL');
  const schema = `auth_test_${Date.now()}`;
  const origin = 'http://localhost:3057';
  let child;
  let logs = '';
  try {
    await pool.query(`CREATE SCHEMA ${schema}`);
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO ${schema}`);
      await client.query(`CREATE TABLE links (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, code varchar(8) NOT NULL UNIQUE, original_url text NOT NULL, clicks bigint NOT NULL DEFAULT 0 CHECK(clicks >= 0), created_at timestamptz NOT NULL DEFAULT now())`);
      await client.query("INSERT INTO links(code,original_url) VALUES ('legacy01','https://example.com/legacy')");
      const migration = await fs.readFile(path.join(__dirname, '../migrations/001_auth.sql'), 'utf8');
      await client.query(migration);
      await client.query(migration); // Reapplying must preserve existing data.
    } finally { await client.query('SET search_path TO public'); client.release(); }
    child = spawn(process.execPath, ['index.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, NODE_ENV: 'test', PORT: '3057', PUBLIC_BASE_URL: origin, PGOPTIONS: `-c search_path=${schema}` },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', d => { logs += d; });
    child.stderr.on('data', d => { logs += d; });
    for (let n = 0; n < 100; n++) {
      if (logs.includes('Server is running')) break;
      if (child.exitCode !== null) throw new Error('Test server exited');
      await new Promise(r => setTimeout(r,100));
    }
    assert.match(logs, /Server is running/);
    const call = (url, { method = 'GET', body, cookie, headers = {} } = {}) => fetch(origin + url, {
      method, redirect: 'manual', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Short-URL-Client': 'web', ...(cookie ? { Cookie: cookie } : {}), ...headers },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const password = 'Testpass123';
    for (const invalid of ['Abc12', 'Abcdefghijk12', 'abcdef12']) {
      assert.equal((await call('/api/auth/signup', { method:'POST', body:{email:'invalid@example.com',password:invalid} })).status,400);
    }
    assert.equal((await call('/api/links')).status, 401);
    assert.equal((await call('/api/links', { method:'POST', body:{url:'https://example.com'} })).status,401);
    assert.equal((await call('/api/auth/signup', {method:'POST',body:{email:'a@example.com',password},headers:{Origin:'https://evil.example'}})).status,403);
    assert.equal((await call('/api/auth/signup', {method:'POST',body:{email:'a@example.com',password},headers:{'X-Short-URL-Client':''}})).status,403);
    for (const email of ['a@example.com','b@example.com']) assert.equal((await call('/api/auth/signup',{method:'POST',body:{email,password}})).status,201);
    assert.equal((await call('/api/auth/signup',{method:'POST',body:{email:' A@EXAMPLE.COM ',password}})).status,409);
    assert.equal((await call('/api/auth/login',{method:'POST',body:{email:'a@example.com',password:'Wrong passphrase 12345'}})).status,401);
    const login = async (email, remember = false) => {
      const r = await call('/api/auth/login',{method:'POST',body:{email,password,remember}});
      assert.equal(r.status,200);
      const cookie = r.headers.get('set-cookie');
      assert.match(cookie,/HttpOnly/); assert.match(cookie,/SameSite=Lax/);
      if (remember) assert.match(cookie,/Max-Age=604800/);
      else assert.doesNotMatch(cookie,/Max-Age|Expires=/);
      const data = await r.json(); assert.equal(data.user.password_hash,undefined);
      return {cookie:cookie.split(';')[0],user:data.user};
    };
    const a = await login('a@example.com'), b = await login('b@example.com', true);
    const expiry = await pool.query(`SELECT user_id, EXTRACT(EPOCH FROM (expires_at-created_at)) AS seconds FROM ${schema}.sessions`);
    assert.ok(Math.abs(Number(expiry.rows.find(s=>s.user_id===a.user.id).seconds)-43200)<10);
    assert.ok(Math.abs(Number(expiry.rows.find(s=>s.user_id===b.user.id).seconds)-604800)<10);
    const created = await call('/api/links',{method:'POST',cookie:a.cookie,body:{url:'https://example.com/product',user_id:b.user.id}});
    assert.equal(created.status,201);
    const link = await created.json(); assert.equal(link.user_id,a.user.id);
    assert.equal((await (await call('/api/links',{cookie:a.cookie})).json()).items.length,1);
    assert.equal((await (await call(`/api/links?user_id=${a.user.id}`,{cookie:b.cookie})).json()).items.length,0);
    const route = new URL(link.short_url).pathname;
    assert.equal((await call(route,{method:'HEAD'})).status,302);
    assert.equal((await (await call('/api/links',{cookie:a.cookie})).json()).items[0].clicks,'0');
    const redirect = await call(route); assert.equal(redirect.status,302); assert.equal(redirect.headers.get('location'),'https://example.com/product');
    assert.equal((await (await call('/api/links',{cookie:a.cookie})).json()).items[0].clicks,'1');
    assert.equal((await call('/r/legacy01',{method:'HEAD'})).status,302);
    assert.equal((await call('/api/auth/logout',{method:'POST',cookie:a.cookie,body:{}})).status,204);
    assert.equal((await call('/api/auth/me',{cookie:a.cookie})).status,401);
    await pool.query(`UPDATE ${schema}.sessions SET expires_at=now()-interval '1 second',created_at=now()-interval '2 days' WHERE user_id=$1`,[b.user.id]);
    assert.equal((await call('/api/auth/me',{cookie:b.cookie})).status,401);
    const stored = await pool.query(`SELECT password_hash FROM ${schema}.users`);
    assert.ok(stored.rows.every(x=>x.password_hash.startsWith('scrypt$') && !x.password_hash.includes(password)));
    assert.notEqual(stored.rows[0].password_hash,stored.rows[1].password_hash);
    let limited = false;
    for (let n=0;n<16;n++) { const r=await call('/api/auth/login',{method:'POST',body:{}}); if(r.status===429){ limited=true; assert.ok(r.headers.get('retry-after'));break; } }
    assert.ok(limited);
  } finally {
    if (child && child.exitCode === null) { const closed=once(child,'exit'); child.kill(); await closed; }
    await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await pool.end();
  }
});
