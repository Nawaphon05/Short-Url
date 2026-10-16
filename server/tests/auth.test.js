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
      const management = (await fs.readFile(path.join(__dirname, '../migrations/002_link_management.sql'), 'utf8')).replace(/^\uFEFF/, '');
      await client.query(management);
      await client.query(management);
      const softDelete = await fs.readFile(path.join(__dirname, '../migrations/003_soft_delete.sql'), 'utf8');
      await client.query(softDelete);
      await client.query(softDelete);
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
    // Verify the exact page boundary and no duplicates across pages.
    for (let n = 1; n <= 9; n++) await pool.query(`INSERT INTO ${schema}.links(code,original_url,user_id) VALUES($1,$2,$3)`, [`page${String(n).padStart(4,'0')}`,'https://example.com/pagination',a.user.id]);
    const ten = await (await call('/api/links',{cookie:a.cookie})).json();
    assert.equal(ten.items.length,10); assert.equal(ten.hasMore,false);
    await pool.query(`INSERT INTO ${schema}.links(code,original_url,user_id) VALUES('page0010','https://example.com/last',$1)`,[a.user.id]);
    const first = await (await call('/api/links?page=1',{cookie:a.cookie})).json();
    const second = await (await call('/api/links?page=2',{cookie:a.cookie})).json();
    assert.equal(first.items.length,10); assert.equal(first.hasMore,true);
    assert.equal(second.items.length,1); assert.equal(second.hasMore,false); assert.equal(second.page,2);
    assert.equal(new Set([...first.items,...second.items].map(x=>x.id)).size,11);
    assert.equal((await (await call('/api/links',{cookie:b.cookie})).json()).items.length,0);
    for (const page of ['0','-1','1.5','bad','10001']) assert.equal((await call(`/api/links?page=${page}`,{cookie:a.cookie})).status,400);
    // Link management: preserve legacy routes, isolate owners, and search across pages.
    const createManaged = body => call('/api/links', { method: 'POST', cookie: a.cookie, body: { url: 'https://example.com/campaign', ...body } });
    for (const custom_code of ['ab', 'has space', 'ไทย', 'a'.repeat(49), 123]) assert.equal((await createManaged({custom_code})).status,400);
    for (const expires_at of ['not-a-date', '2020-01-01T00:00:00Z', '2030-01-01T00:00:00', 123]) assert.equal((await createManaged({expires_at})).status,400);
    assert.equal((await createManaged({title:'x'.repeat(121)})).status,400);
    const future = new Date(Date.now()+3600000).toISOString();
    const managedResponse = await createManaged({title:'  สมัครงานบริษัท A  ',custom_code:'summer-sale',expires_at:future});
    assert.equal(managedResponse.status,201);
    const managed = await managedResponse.json();
    assert.equal(managed.title,'สมัครงานบริษัท A'); assert.equal(managed.expires_at,future);
    assert.equal((await createManaged({custom_code:'summer-sale'})).status,409);
    assert.equal((await createManaged({custom_code:'legacy01'})).status,409);
    assert.equal((await call('/api/links',{method:'POST',cookie:b.cookie,body:{url:'https://example.com',custom_code:'summer-sale'}})).status,409);
    assert.equal((await call('/r/summer-sale',{method:'HEAD'})).status,302);
    assert.equal((await call('/r/summer-sale')).status,302);
    assert.equal((await call(`/api/links/${managed.id}`,{method:'PATCH',cookie:b.cookie,body:{title:'stolen'}})).status,404);
    assert.equal((await call(`/api/links/${managed.id}`,{method:'PATCH',body:{title:'no session'}})).status,401);
    assert.equal((await call(`/api/links/${managed.id}`,{method:'PATCH',cookie:a.cookie,body:{title:'x'.repeat(121)}})).status,400);
    assert.equal((await call(`/api/links/${managed.id}`,{method:'PATCH',cookie:a.cookie,body:{title:'no origin'},headers:{Origin:'https://evil.example'}})).status,403);
    const rename=await call(`/api/links/${managed.id}`,{method:'PATCH',cookie:a.cookie,body:{title:'New name',custom_code:'cannot-change'}});
    assert.equal(rename.status,200); assert.equal((await rename.json()).code,'summer-sale');
    const search = async(q,cookie=a.cookie) => (await (await call(`/api/links?q=${encodeURIComponent(q)}`,{cookie})).json()).items;
    assert.equal((await search('NEW NAME')).length,1);
    assert.equal((await search('summer-sale')).length,1);
    assert.equal((await search('example.com/campaign')).length,1);
    assert.equal((await search('summer-sale',b.cookie)).length,0);
    assert.equal((await search('%')).length,0);
    assert.equal((await search('page')).length,10);
    assert.equal((await search('legacy01')).length,0);
    assert.equal((await call('/api/links?q='+ 'x'.repeat(201),{cookie:a.cookie})).status,400);
    const expiredResult=await pool.query(`UPDATE ${schema}.links SET expires_at=now()-interval '1 second' WHERE id=$1 RETURNING clicks`,[managed.id]);
    for(const method of ['GET','HEAD']) { const response=await call('/r/summer-sale',{method}); assert.equal(response.status,410); assert.equal(response.headers.get('location'),null); assert.equal(response.headers.get('cache-control'),'no-store'); }
    const unchanged=await pool.query(`SELECT clicks FROM ${schema}.links WHERE id=$1`,[managed.id]);
    assert.equal(unchanged.rows[0].clicks,expiredResult.rows[0].clicks);
    assert.equal((await call('/r/does-not-exist')).status,404);
    assert.equal((await call('/r/legacy01')).status,302);
    assert.equal((await createManaged({custom_code:'a'.repeat(48)})).status,201);
    assert.equal((await call('/r/'+ 'a'.repeat(48))).status,302);
    // Soft deletion: require owner + CSRF, reserve code, and never count deleted redirects.
    const remove = (id,cookie=a.cookie,headers={}) => call(`/api/links/${id}`,{method:'DELETE',cookie,body:{},headers});
    assert.equal((await remove(managed.id,b.cookie)).status,404);
    assert.equal((await remove(managed.id,'')).status,401);
    assert.equal((await remove(managed.id,a.cookie,{Origin:'https://evil.example'})).status,403);
    assert.equal((await remove(managed.id,a.cookie,{'X-Short-URL-Client':''})).status,403);
    assert.equal((await remove('bad')).status,404);
    assert.equal((await remove(managed.id)).status,204);
    assert.equal((await remove(managed.id)).status,404);
    assert.equal((await search('summer-sale')).length,0);
    assert.equal((await search('New name')).length,0);
    assert.equal((await call(`/api/links/${managed.id}`,{method:'PATCH',cookie:a.cookie,body:{title:'cannot restore'}})).status,404);
    for(const method of ['GET','HEAD']) {
      const response=await call('/r/summer-sale',{method});
      assert.equal(response.status,410); assert.equal(response.headers.get('location'),null);
      assert.equal(response.headers.get('cache-control'),'no-store');
      if(method==='GET') assert.match(await response.text(),/ลิงก์นี้ถูกลบแล้ว/);
    }
    const tombstone=(await pool.query(`SELECT clicks,deleted_at,code FROM ${schema}.links WHERE id=$1`,[managed.id])).rows[0];
    assert.ok(tombstone.deleted_at); assert.equal(tombstone.clicks,unchanged.rows[0].clicks);
    assert.equal((await createManaged({custom_code:'summer-sale'})).status,409);
    assert.equal((await call('/api/links',{method:'POST',cookie:b.cookie,body:{url:'https://example.com',custom_code:'summer-sale'}})).status,409);
    const activeForDelete=await (await createManaged({custom_code:'delete-active'})).json();
    assert.equal((await remove(activeForDelete.id)).status,204);
    assert.equal((await call('/r/delete-active')).status,410);
    assert.equal((await search('delete-active')).length,0);
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
