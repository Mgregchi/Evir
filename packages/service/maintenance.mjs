import {cleanup,now} from './security.mjs';

// Reuse the existing expiring-record table: this reserved ID cannot collide
// with rate-limit IDs (which are base64url hashes). count=0 marks a lease.
const leaseId='maintenance:expired-records:v1';
const retrySeconds=300,dailySeconds=86400;
const local=new WeakMap();

// Request-driven housekeeping, not an authorization check. All credential and
// grant expiry checks remain on the request path, independently of deletion.
export function queueMaintenance(env,ctx){
  if(!env.DB||!ctx?.waitUntil)return;
  let state=local.get(env.DB);
  if(!state){state={until:0,pending:null};local.set(env.DB,state);}
  if(state.pending||state.until>now())return;
  state.until=now()+retrySeconds;
  const task=maintain(env,state).finally(()=>{state.pending=null;});
  state.pending=task;
  ctx.waitUntil(task);
}
async function maintain(env,state){
  const t=now();
  const current=await env.DB.prepare('SELECT expires_at FROM rate_limits WHERE id = ?').bind(leaseId).first();
  if(current?.expires_at>t){state.until=current.expires_at;return;}
  // D1 arbitrates across isolates. A failed/interrupted task leaves a short
  // lease; future service traffic retries rather than waiting a full day.
  const lease=t+retrySeconds;
  const claimed=await env.DB.prepare('INSERT INTO rate_limits VALUES (?, 0, ?) ON CONFLICT(id) DO UPDATE SET count = 0, expires_at = excluded.expires_at WHERE rate_limits.expires_at <= ? RETURNING expires_at').bind(leaseId,lease,t).first();
  if(!claimed)return;
  await cleanup(env);
  const until=now()+dailySeconds;
  const result=await env.DB.prepare('UPDATE rate_limits SET expires_at = ? WHERE id = ? AND count = 0 AND expires_at = ?').bind(until,leaseId,lease).run();
  if(result.meta.changes===1)state.until=until;
}
