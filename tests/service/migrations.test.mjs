import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const execute=promisify(execFile);
test('Pinned Wrangler applies the D1 migration ledger twice without resetting existing account data',{timeout:90000},async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'evir-migrations-'));
 try{
  const config=path.join(dir,'wrangler.json');await writeFile(config,JSON.stringify({name:'evir-migration-test',compatibility_date:'2026-10-09',d1_databases:[{binding:'DB',database_name:'evir-accounts',database_id:'12345678-1234-1234-1234-123456789abc',migrations_dir:path.resolve('packages/service/migrations')}]}));
  const cli=path.resolve('node_modules/wrangler/bin/wrangler.js');
  const run=async args=>(await execute(process.execPath,[cli,...args,'--local','--config',config,'--persist-to',path.join(dir,'state')],{env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:path.join(dir,'log'),XDG_CONFIG_HOME:path.join(dir,'config')},encoding:'utf8',timeout:60000})).stdout;
  const first=await run(['d1','migrations','apply','DB']);assert.match(first,/0001_identity.sql/);
  await run(['d1','execute','DB','--command',"INSERT INTO accounts VALUES ('retained-account', 1)"]);
  const second=await run(['d1','migrations','apply','DB']);assert.match(second,/No migrations to apply/);
  const data=JSON.parse(await run(['d1','execute','DB','--command','SELECT id FROM accounts','--json']));assert.equal(data[0].results[0].id,'retained-account');
 }finally{await rm(dir,{recursive:true,force:true});}
});
