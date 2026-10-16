// Local-only launcher. Service token exists only in child process environments.
const path = require('node:path');
require('dotenv').config({path:path.join(__dirname,'.env'),quiet:true});
const { Client } = require('pg');
const { randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const config = new Client(process.env.DATABASE_URL ? {connectionString:process.env.DATABASE_URL} : {});
if (!['localhost','127.0.0.1','::1'].includes(config.connectionParameters.host)) throw new Error('Local launcher only: configure a localhost PostgreSQL database');
const webPort=Number(process.env.LOCAL_WEB_PORT || 3062), redirectPort=Number(process.env.LOCAL_REDIRECT_PORT || 3063);
if (![webPort,redirectPort].every(n=>Number.isInteger(n)&&n>1024&&n<65536) || webPort===redirectPort) throw new Error('Choose two distinct local ports between 1025 and 65535');
// Pin the resolved database for both children. An existing service .env must not
// introduce a DATABASE_URL (or missing PG* value) after the localhost check.
const db=config.connectionParameters;
const common={...process.env,DATABASE_URL:process.env.DATABASE_URL || '',
 PGHOST:db.host,PGPORT:String(db.port),PGDATABASE:db.database,PGUSER:db.user,PGPASSWORD:db.password || '',
 NODE_ENV:'development',REDIRECT_SERVICE_TOKEN:randomBytes(32).toString('hex')};
const children=[];let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const child of children)if(child.exitCode===null)child.kill();process.exitCode=code;}
for(const [name,env,cwd] of [
 ['redirect',{...common,PORT:String(redirectPort)},path.join(__dirname,'../redirect-service')],
 ['web',{...common,PORT:String(webPort),PUBLIC_BASE_URL:`http://localhost:${webPort}`,REDIRECT_SERVICE_URL:`http://localhost:${redirectPort}`,REDIRECT_SERVICE_TIMEOUT_MS:'70000'},__dirname],
]){
 const child=spawn(process.execPath,['index.js'],{cwd,env,stdio:['ignore','pipe','pipe']});children.push(child);
 child.stdout.on('data',data=>process.stdout.write(`[${name}] ${data}`));
 child.stderr.on('data',data=>process.stderr.write(`[${name}] ${data}`));
 child.on('error',()=>{console.error(`${name} could not start`);stop(1);});
 child.on('exit',code=>{if(!stopping){console.error(`${name} stopped`);stop(code || 1);}});
}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
console.log(`Local preview: http://localhost:${webPort} (two services, local database)`);
