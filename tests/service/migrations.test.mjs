import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,mkdir,copyFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const execute=promisify(execFile);
test('Pinned Wrangler upgrades existing accounts, then repeats migrations without resetting client credentials',{timeout:180000},async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'evir-migrations-'));
 try{
  const migrations=path.join(dir,'migrations');await mkdir(migrations);
  for(const file of ['0001_identity.sql','0002_live_sessions.sql'])await copyFile(path.join('packages/service/migrations',file),path.join(migrations,file));
  const config=path.join(dir,'wrangler.json');await writeFile(config,JSON.stringify({name:'evir-migration-test',compatibility_date:'2026-10-09',d1_databases:[{binding:'DB',database_name:'evir-accounts',database_id:'12345678-1234-1234-1234-123456789abc',migrations_dir:migrations}]}));
  const cli=path.resolve('node_modules/wrangler/bin/wrangler.js');
  const run=async args=>(await execute(process.execPath,[cli,...args,'--local','--config',config,'--persist-to',path.join(dir,'state')],{env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:path.join(dir,'log'),XDG_CONFIG_HOME:path.join(dir,'config')},encoding:'utf8',timeout:60000})).stdout;
  const first=await run(['d1','migrations','apply','DB']);assert.match(first,/0001_identity.sql/);
  await run(['d1','execute','DB','--command',"INSERT INTO accounts VALUES ('retained-account', 1)"]);
  for(const file of ['0003_oauth_clients.sql','0004_oauth_assertions.sql'])await copyFile(path.join('packages/service/migrations',file),path.join(migrations,file));
  const upgrade=await run(['d1','migrations','apply','DB']);assert.match(upgrade,/0003_oauth_clients.sql/);assert.match(upgrade,/0004_oauth_assertions.sql/);
  await run(['d1','execute','DB','--command',"INSERT INTO oauth_clients VALUES ('retained-client', '{}', 'retained-secret-hash', 1)"]);
  const second=await run(['d1','migrations','apply','DB']);assert.match(second,/No migrations to apply/);
  const data=JSON.parse(await run(['d1','execute','DB','--command','SELECT id FROM accounts','--json']));assert.equal(data[0].results[0].id,'retained-account');
  const clients=JSON.parse(await run(['d1','execute','DB','--command','SELECT id,secret_hash FROM oauth_clients','--json']));assert.deepEqual(clients[0].results,[{id:'retained-client',secret_hash:'retained-secret-hash'}]);
 }finally{await rm(dir,{recursive:true,force:true});}
});
