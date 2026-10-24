import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.mjs';
import {queueMaintenance} from '../../packages/service/maintenance.mjs';
import {now,hash} from '../../packages/service/security.mjs';
const leaseId='maintenance:expired-records:v1';
function context(){const tasks=[];return {tasks,waitUntil:task=>tasks.push(task),drain:()=>Promise.all(tasks)};}
function binding(db,batch){return {prepare:q=>db.prepare(q),batch:batch||((q)=>db.batch(q))};}

test('Concurrent request housekeeping uses one shared D1 lease and preserves live/security records',async()=>{
 const h=await harness();try{
  const a=await h.account(),t=now();
  await h.db.prepare('INSERT INTO credentials VALUES (?, ?, ?, ?, ?, ?, ?)').bind('passkey',a.id,'public-key',0,'[]','Device',t).run();
  await h.db.prepare('INSERT INTO recovery_codes VALUES (?, ?)').bind('recovery-hash',a.id).run();
  for(const [suffix,expiry] of [['expired',t-1],['live',t+3600]]){
   await h.db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').bind('session-'+suffix,a.id,expiry).run();
   await h.db.prepare('INSERT INTO challenges VALUES (?, ?, ?, ?, ?)').bind('challenge-'+suffix,'challenge','login',a.id,expiry).run();
   await h.db.prepare('INSERT INTO codes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind('code-'+suffix,a.id,'client','Agent','https://agent.example/callback','https://evir.test/mcp','account:read','challenge',expiry).run();
   await h.db.prepare('INSERT INTO grants VALUES (?, ?, ?, ?, ?, ?, ?, NULL)').bind('grant-'+suffix,a.id,'client','Agent','account:read',t,expiry).run();
   await h.db.prepare('INSERT INTO tokens VALUES (?, ?, ?, ?)').bind('token-'+suffix,'grant-'+suffix,'access',expiry).run();
   await h.db.prepare('INSERT INTO live_sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)').bind('live-'+suffix,a.id,'grant-'+suffix,'project','artboard','Shared','[]','owner',expiry).run();
   await h.db.prepare('INSERT INTO rate_limits VALUES (?, ?, ?)').bind('limit-'+suffix,1,expiry).run();
  }
  let batches=0;
  const ctx=context(),dbs=Array.from({length:12},()=>binding(h.db,qs=>{batches++;return h.db.batch(qs);}));
  for(const DB of dbs)queueMaintenance({DB},ctx);
  await ctx.drain();assert.equal(batches,1,'Distinct isolate-like bindings share a single database lease');
  for(const table of ['sessions','challenges','codes','tokens','grants','rate_limits','live_sessions'])assert.equal((await h.db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE expires_at <= ?`).bind(t).first()).n,0,table);
  for(const table of ['accounts','credentials','recovery_codes'])assert.equal((await h.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first()).n,1,table);
  for(const table of ['challenges','codes','tokens','grants','live_sessions'])assert.equal((await h.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first()).n,1,table);
  const lease=await h.db.prepare('SELECT * FROM rate_limits WHERE id = ?').bind(leaseId).first();assert.equal(lease.count,0);assert(lease.expires_at>=t+86400);
  const cached=context();for(let i=0;i<20;i++)queueMaintenance({DB:dbs[0]},cached);assert.equal(cached.tasks.length,0,'Warm binding avoids repeated D1 checks');
  const cold=context();queueMaintenance({DB:binding(h.db)},cold);await cold.drain();assert.equal(batches,1);
 }finally{await h.dispose();}
});

test('Failed or interrupted housekeeping retries after a short lease, not a full day',async()=>{
 const h=await harness(),realNow=Date.now;let clock=realNow();Date.now=()=>clock;
 try{
  let attempts=0;const DB=binding(h.db,qs=>{attempts++;if(attempts===1)throw Error('Synthetic D1 failure');return h.db.batch(qs);});
  const failed=context();queueMaintenance({DB},failed);await assert.rejects(failed.drain(),/Synthetic D1 failure/);
  const retry=context();queueMaintenance({DB:binding(h.db)},retry);await retry.drain();assert.equal(attempts,1);
  clock+=301000;const recovered=context();queueMaintenance({DB},recovered);await recovered.drain();assert.equal(attempts,2);
  assert((await h.db.prepare('SELECT expires_at FROM rate_limits WHERE id = ?').bind(leaseId).first()).expires_at>=now()+86400);
  // Simulate a previous Worker stopping after acquiring its lease.
  await h.db.prepare('UPDATE rate_limits SET expires_at = ? WHERE id = ?').bind(now()-1,leaseId).run();
  const restarted=context();queueMaintenance({DB:binding(h.db,qs=>{attempts++;return h.db.batch(qs);})},restarted);await restarted.drain();assert.equal(attempts,3);
 }finally{Date.now=realNow;await h.dispose();}
});

test('The real Worker schedules housekeeping only for service traffic; expiry rejects without deletion',async()=>{
 const h=await harness();try{
  assert.equal((await h.request('/')).status,200);
  assert.equal(await h.db.prepare('SELECT id FROM rate_limits WHERE id = ?').bind(leaseId).first(),null,'Static traffic does not touch housekeeping');
  const ready=await h.request('/api/service');assert.equal(ready.status,200);
  let lease;
  for(let i=0;i<100;i++){
   lease=await h.db.prepare('SELECT expires_at FROM rate_limits WHERE id = ?').bind(leaseId).first();
   if(lease?.expires_at>now()+3600)break;
   await new Promise(resolve=>setTimeout(resolve,20));
  }
  assert(lease?.expires_at>now()+3600,'waitUntil completes the cleanup and daily lease');
  const a=await h.account();await h.db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').bind(await hash('expired-test-token'),a.id,now()-1).run();
  assert.equal((await h.request('/api/account',{headers:{Cookie:'__Host-evir-session=expired-test-token'}})).status,401);
  assert(await h.db.prepare('SELECT token_hash FROM sessions WHERE token_hash = ?').bind(await hash('expired-test-token')).first(),'Expiry is enforced even while the row awaits later deletion');
  const ctx=context();queueMaintenance({},ctx);assert.equal(ctx.tasks.length,0);
 }finally{await h.dispose();}
});
