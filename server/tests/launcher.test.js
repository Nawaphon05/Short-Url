const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const dotenv = require('dotenv');

test('local launcher prevents service .env from changing the checked database', () => {
  const launches = [];
  const run = host => {
    const fakeProcess = new EventEmitter();
    fakeProcess.env = {};
    fakeProcess.stdout = fakeProcess.stderr = { write() {} };
    const deps = {
      'node:path': path,
      dotenv: { config() {} },
      pg: { Client: class { constructor() { this.connectionParameters = { host, port: 5432, database: 'local_check', user: 'local_user', password: null }; } } },
      'node:crypto': require('node:crypto'),
      'node:child_process': { spawn(command, args, options) {
        launches.push(options);
        const child = new EventEmitter();
        child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
        return child;
      } },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../devServices.js'), 'utf8'), {
      require: name => deps[name], __dirname: path.join(__dirname, '..'),
      process: fakeProcess, console: { log() {}, error() {} },
    });
  };
  run('localhost');
  assert.equal(launches.length, 2);
  for (const child of launches) {
    const env = { ...child.env };
    // Simulate dotenv loading an old redirect-service/.env without override.
    dotenv.populate(env, { DATABASE_URL: 'postgresql://example.invalid/remote', PGHOST: 'example.invalid', PGDATABASE: 'remote', PGPASSWORD: 'old-placeholder' });
    assert.equal(env.DATABASE_URL, '');
    assert.equal(env.PGHOST, 'localhost');
    assert.equal(env.PGDATABASE, 'local_check');
    assert.equal(env.PGPASSWORD, '');
  }
  assert.equal(launches[0].env.REDIRECT_SERVICE_TOKEN, launches[1].env.REDIRECT_SERVICE_TOKEN);
  assert.throws(() => run('example.invalid'), /Local launcher only/);
  assert.equal(launches.length, 2, 'Reject a remote database before spawning children');
});
