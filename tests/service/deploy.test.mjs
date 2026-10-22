import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,rm} from 'node:fs/promises';
import {deploy,deployConfig,deploySteps} from '../../tools/deploy-cloudflare.mjs';
const id='12345678-1234-1234-1234-123456789abc';
test('Cloudflare configuration preserves dashboard values and binds only an explicit existing D1 database',()=>{
  const base={name:'evir',assets:{directory:'./dist',binding:'ASSETS'}};
  const config=deployConfig(base,{D1_DATABASE_ID:id,WORKERS_CI_BRANCH:'main',SECRET:'never-serialize'},'/checkout');
  assert.equal(config.keep_vars,true);assert.equal(config.d1_databases[0].database_id,id);assert.equal(config.d1_databases[0].binding,'DB');assert(!('vars'in config));assert(!JSON.stringify(config).includes('never-serialize'));
  assert.throws(()=>deployConfig(base,{},'/checkout'),/D1_DATABASE_ID/);
  assert.throws(()=>deployConfig(base,{D1_DATABASE_ID:id,WORKERS_CI_BRANCH:'feature'},'/checkout'),/only from main/);
  assert.deepEqual(deploySteps('/config').map(s=>s[0]),['d1','deploy']);assert(deploySteps('/config')[0].includes('--remote'));
});
test('Migration failure stops publication; repeat deployment uses the migration ledger without destructive resets',async()=>{
  const calls=[];const env={D1_DATABASE_ID:id,WORKERS_CI_BRANCH:'main'};
  await assert.rejects(deploy(env,(_exe,args)=>{calls.push(args);return {status:1};}),/migration failed/);assert.equal(calls.length,1);
  calls.length=0;await deploy(env,(_exe,args,opts)=>{calls.push({args,opts});return {status:0};});assert.equal(calls.length,2);assert(calls[1].args.includes('--keep-vars'));assert.equal(calls[0].opts.env.CI,'true');
  const generated=JSON.parse(await readFile('apps/web/.deploy/wrangler.json','utf8'));assert.equal(generated.d1_databases[0].database_id,id);assert(!('vars'in generated));
  await rm('apps/web/.deploy',{recursive:true,force:true});
});
