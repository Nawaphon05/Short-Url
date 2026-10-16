const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { once } = require('node:events');
const { getRedirectConfig } = require('../redirectConfig');
test('gateway timeout, upstream failure, safe forwarding and configuration', async () => {
  const old = { ...process.env };
  let mode='ok', calls=0, secretSeen='', cookieSeen='';
  const upstream=http.createServer((req,res)=>{
    calls++;secretSeen=req.headers.authorization;cookieSeen=req.headers.cookie;
    if(mode==='timeout'){setTimeout(()=>{res.statusCode=302;res.setHeader('Location','https://example.com');res.end();},350);return;}
    if(mode==='redirect'){res.statusCode=307;res.setHeader('Location','https://example.com');return res.end();}
    if(mode==='unsafe'){res.statusCode=302;res.setHeader('Location','javascript:alert(1)');return res.end();}
    if(mode==='bad-auth'){res.statusCode=401;return res.end();}
    if(mode==='invalid-state'){res.statusCode=410;res.setHeader('X-Link-State','other');return res.end();}
    res.statusCode=302;res.setHeader('Location','https://example.com/target');res.end();
  });
  const app=express();app.use('/r',require('../redirectRoutes'));
  let server;
  try {
    upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
    process.env.NODE_ENV='test';process.env.REDIRECT_SERVICE_URL=`http://127.0.0.1:${upstream.address().port}`;
    process.env.REDIRECT_SERVICE_TOKEN='test-token-at-least-32-characters-long';process.env.REDIRECT_SERVICE_TIMEOUT_MS='100';
    server=app.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${server.address().port}`;
    const call=()=>fetch(origin+'/r/legacy01',{redirect:'manual',headers:{Cookie:'user-secret=should-not-forward',Authorization:'user-supplied'}});
    assert.equal((await call()).status,302);assert.equal(secretSeen,`Bearer ${process.env.REDIRECT_SERVICE_TOKEN}`);assert.equal(cookieSeen,undefined);
    for(const failure of ['redirect','unsafe','bad-auth','invalid-state']){mode=failure;const response=await call();assert.equal(response.status,503);assert.equal(response.headers.get('location'),null);assert.equal(response.headers.get('cache-control'),'no-store');assert.ok(!(await response.text()).includes(process.env.REDIRECT_SERVICE_TOKEN));}
    mode='timeout';const before=calls;assert.equal((await call()).status,503);await new Promise(r=>setTimeout(r,400));assert.equal(calls-before,1,'Timeout must never cause an automatic retry');
    await new Promise(resolve=>upstream.close(resolve));assert.equal((await call()).status,503);
    process.env.REDIRECT_SERVICE_URL='https://user:secret@example.com';assert.throws(()=>getRedirectConfig());
    process.env.REDIRECT_SERVICE_URL='http://example.com';assert.throws(()=>getRedirectConfig());
    process.env.REDIRECT_SERVICE_URL='https://example.com/path';assert.throws(()=>getRedirectConfig());
    process.env.REDIRECT_SERVICE_URL='https://example.com';process.env.REDIRECT_SERVICE_TOKEN='short';assert.throws(()=>getRedirectConfig());
    delete process.env.REDIRECT_SERVICE_URL;assert.equal(getRedirectConfig(),null);
  } finally {
    if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    upstream.closeAllConnections();if(upstream.listening)await new Promise(resolve=>upstream.close(resolve));
    for(const key of ['NODE_ENV','REDIRECT_SERVICE_URL','REDIRECT_SERVICE_TOKEN','REDIRECT_SERVICE_TIMEOUT_MS']){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}
  }
});
