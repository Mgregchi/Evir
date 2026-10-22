import test from 'node:test';import assert from 'node:assert/strict';
import {harness,site,client,authQuery,callback} from './harness.mjs';
import {random,hash,now} from '../../packages/service/security.mjs';
const post=(value,cookie)=>({method:'POST',headers:{Origin:site,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(value)});
import {liveGrant,rpc,pair,socket} from './live-fixtures.mjs';
test('Live sharing binds one account, grant and tab key; broker relays once and stops on revocation',async()=>{
 const h=await harness();try{
  const a=await h.account(),other=await h.account(),g=await liveGrant(h,a),og=await liveGrant(h,other),p=await pair(h,a,g);assert.equal(p.response.status,200);
  assert.equal((await socket(h,other,p)).status,403);assert.equal((await socket(h,a,p,{'Sec-WebSocket-Protocol':'evir-live, wrong'})).status,403);assert.equal((await socket(h,a,p,{Origin:'https://attacker.test'})).status,403);
  assert.equal((await rpc(h,og,'list_live_sessions')).result.structuredContent.sessions.length,0);assert.equal((await rpc(h,og,'inspect_scene',{sessionId:p.sessionId})).result.isError,true);
  const upgraded=await socket(h,a,p);assert.equal(upgraded.status,101);const ws=upgraded.webSocket;ws.accept();
  const frames=[];ws.addEventListener('message',e=>{const m=JSON.parse(e.data);frames.push(m);if(m.type!=='heartbeat')ws.send(JSON.stringify({id:m.id,value:{ok:true,revision:1,marker:'actual-browser-ack'}}));});
  const reply=await rpc(h,g,'inspect_scene',{sessionId:p.sessionId});assert.equal(reply.result.structuredContent.marker,'actual-browser-ack');assert.equal(frames.length,1);
  assert.equal((await h.db.prepare('SELECT COUNT(*) AS n FROM live_sessions').first()).n,1);const row=await h.db.prepare('SELECT * FROM live_sessions').first();assert.notEqual(row.owner_hash,p.key);assert(!JSON.stringify(row).includes('actual-browser-ack'));
  let closed;const close=new Promise(resolve=>ws.addEventListener('close',()=>{closed=true;resolve();}));await h.request('/api/account/revoke',post({id:g.id},a.cookie));await close;assert(closed);assert.match((await rpc(h,g,'inspect_scene',{sessionId:p.sessionId})).error,/Sign in/);
  const denied=await h.request('/mcp',{headers:{Authorization:'Bearer '+g.access}});assert.equal(denied.status,401);
 }finally{await h.dispose();}
});
test('OAuth scene scopes cannot escalate, and Studio can grant a smaller capability set',async()=>{
 const h=await harness();try{
  const a=await h.account(),g=await liveGrant(h,a,'account:read scene:read'),p=await pair(h,a,g,['scene:read']);assert.equal(p.response.status,200);
  assert.equal((await pair(h,a,g,['scene:read','scene:write'])).response.status,403);
  assert.equal((await rpc(h,g,'apply_scene_patch',{sessionId:p.sessionId})).error.code,-32602);
  const listed=await rpc(h,g,'list_live_sessions');assert.deepEqual(listed.result.structuredContent.sessions[0].permissions,['scene:read']);
  const offline=await rpc(h,g,'inspect_scene',{sessionId:p.sessionId});assert.equal(offline.result.structuredContent.error.code,'STUDIO_OFFLINE');
  const query=authQuery(await hash(random()));query.set('scope','account:read scene:write');assert.equal((await h.request('/oauth/authorize?'+query)).status,400);
  const verifier=random();query.set('scope','account:read scene:read scene:write');query.set('code_challenge',await hash(verifier));
  const consent=await (await h.request('/api/oauth/consent',post({query:query.toString(),approved:true},a.cookie))).json();const code=new URL(consent.redirect).searchParams.get('code');
  const exchange=await h.request('/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:client.client_id,grant_type:'authorization_code',resource:site+'/mcp',redirect_uri:callback,code,code_verifier:verifier}).toString()});const t=await exchange.json();assert.equal(t.scope,'account:read scene:read scene:write');
  const refreshed=await h.request('/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:client.client_id,grant_type:'refresh_token',resource:site+'/mcp',refresh_token:t.refresh_token,scope:'account:read scene:read scene:write scene:control'}).toString()});assert.equal(refreshed.status,400);
  const reordered=await h.request('/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:client.client_id,grant_type:'refresh_token',resource:site+'/mcp',refresh_token:t.refresh_token,scope:'scene:write account:read scene:read'}).toString()});assert.equal(reordered.status,200);assert.equal((await reordered.json()).scope,'account:read scene:read scene:write');
  await h.db.prepare('UPDATE live_sessions SET expires_at = ? WHERE id = ?').bind(now()-1,p.sessionId).run();assert.equal((await socket(h,a,p)).status,403);
 }finally{await h.dispose();}
});
test('The broker does not queue offline work and bounds in-flight delivery; timeout is explicitly uncertain',{timeout:30000},async()=>{
 const h=await harness();try{
  const a=await h.account(),g=await liveGrant(h,a),p=await pair(h,a,g);
  const offline=await rpc(h,g,'inspect_scene',{sessionId:p.sessionId});assert.equal(offline.result.structuredContent.error.code,'STUDIO_OFFLINE');
  const r=await socket(h,a,p);const ws=r.webSocket;ws.accept();const frames=[];ws.addEventListener('message',e=>frames.push(JSON.parse(e.data)));
  assert.equal((await socket(h,a,p)).status,409);
  const first=rpc(h,g,'inspect_scene',{sessionId:p.sessionId});
  await new Promise(resolve=>{if(frames.length)resolve();else ws.addEventListener('message',resolve,{once:true});});
  const second=await rpc(h,g,'inspect_scene',{sessionId:p.sessionId});assert.equal(second.result.structuredContent.error.code,'BUSY');
  const timedOut=await first;assert.equal(timedOut.result.structuredContent.error.code,'DELIVERY_UNKNOWN');assert.equal(frames.length,1,'No queued or automatically replayed request');
  ws.send(JSON.stringify({id:frames[0].id,value:{ok:true,late:true}}));
  const closed=new Promise(resolve=>ws.addEventListener('close',resolve,{once:true}));await h.request('/api/account/logout',post({},a.cookie));await closed;
  assert.equal((await rpc(h,g,'inspect_scene',{sessionId:p.sessionId})).result.isError,true);
 }finally{await h.dispose();}
});
test('Studio permissions narrow a fully authorized agent and another grant on the same account cannot inherit the share',async()=>{
 const h=await harness();try{
  const a=await h.account(),g=await liveGrant(h,a),other=await liveGrant(h,a),p=await pair(h,a,g,['scene:read']);
  const rejected=await rpc(h,g,'apply_scene_patch',{sessionId:p.sessionId});assert.equal(rejected.result.isError,true);assert.match(rejected.result.content[0].text,/did not grant/);
  assert.equal((await rpc(h,other,'list_live_sessions')).result.structuredContent.sessions.length,0);assert.equal((await rpc(h,other,'inspect_scene',{sessionId:p.sessionId})).result.isError,true);
  const hidden=await h.request('/api/live/connections',{headers:{Cookie:a.cookie}});assert.equal((await hidden.json()).connections.length,2);
 }finally{await h.dispose();}
});
