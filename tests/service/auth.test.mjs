import test from 'node:test';import assert from 'node:assert/strict';
import {harness,site,callback,client,authQuery} from './harness.mjs';
import {hash,random,now} from '../../packages/service/security.mjs';
const post=(value,cookie)=>({method:'POST',headers:{Origin:site,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(value)});
const form=p=>({method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(p).toString()});
const mcp=(access,method='tools/list',params)=>({method:'POST',headers:{Authorization:'Bearer '+access,Accept:'application/json, text/event-stream','Content-Type':'application/json','MCP-Protocol-Version':'2025-11-25'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
test('Passkey challenges, origin isolation, recovery and account ownership run against real D1',async()=>{
 const h=await harness();try {
  let r=await h.request('/api/passkeys/register/options',post({}));assert.equal(r.status,200);const options=await r.json();assert.equal(options.rp.id,'evir.test');assert.equal(options.authenticatorSelection.residentKey,'required');assert.equal(options.authenticatorSelection.userVerification,'required');
  const challengeCookie=r.headers.get('set-cookie').split(';')[0];r=await h.request('/api/passkeys/register/verify',post({id:'fake'},challengeCookie));assert.equal(r.status,400);r=await h.request('/api/passkeys/register/verify',post({id:'fake'},challengeCookie));assert.match((await r.json()).error,/expired/);assert.equal((await h.db.prepare('SELECT COUNT(*) AS n FROM accounts').first()).n,0);
  r=await h.request('/api/passkeys/register/options',{...post({}),headers:{Origin:'https://attacker.test'}});assert.equal(r.status,403);
  assert.equal((await h.request('/api/account')).status,401);
  const a=await h.account(),b=await h.account();
  r=await h.request('/api/account/recovery-codes',post({},a.cookie));assert.equal(r.status,200);const codes=(await r.json()).codes;assert.equal(codes.length,8);
  const stored=await h.db.prepare('SELECT token_hash FROM recovery_codes').all();assert(!stored.results.some(x=>codes.includes(x.token_hash)));
  r=await h.request('/api/account/recover',post({code:codes[0]}));assert.equal(r.status,200);const recoveredCookie=r.headers.get('set-cookie').split(';')[0];assert.equal((await h.request('/api/account',{headers:{Cookie:a.cookie}})).status,401);assert.equal((await h.request('/api/account',{headers:{Cookie:recoveredCookie}})).status,200);
  assert.equal((await h.request('/api/account/recover',post({code:codes[0]}))).status,400);
  assert.equal((await h.request('/api/account/recovery-codes',post({},b.cookie))).status,200);
  await h.db.prepare('UPDATE sessions SET expires_at = ? WHERE account_id = ?').bind(now()+604000,b.id).run();assert.equal((await h.request('/api/account/recovery-codes',post({},b.cookie))).status,401);
  assert.equal((await h.request('/api/account',{headers:{Origin:'https://attacker.test'}})).headers.get('access-control-allow-origin'),null);
 }finally{await h.dispose();}
});
test('OAuth PKCE, exact redirects, single-use codes, refresh rotation and revocation protect MCP',async()=>{
 const h=await harness();try {
  const a=await h.account(),b=await h.account();const verifier=random(),challenge=await hash(verifier),query=authQuery(challenge);
  const metadata=await (await h.request('/.well-known/oauth-authorization-server')).json();assert.deepEqual(metadata.code_challenge_methods_supported,['S256']);assert.equal(metadata.registration_endpoint,site+'/oauth/register');assert.deepEqual(metadata.token_endpoint_auth_methods_supported,['none','client_secret_post','client_secret_basic','private_key_jwt']);assert.equal(metadata.client_id_metadata_document_supported,true);
  assert.equal((await h.request('/mcp')).status,401);assert.match((await h.request('/mcp')).headers.get('www-authenticate'),/resource_metadata/);
  const evil=new URLSearchParams(query);evil.set('redirect_uri','https://attacker.test/');const invalid=await h.request('/oauth/authorize?'+evil);assert.equal(invalid.status,400);assert(!invalid.headers.get('Location'));
  const deny=await (await h.request('/api/oauth/consent',post({query:query.toString(),approved:false},a.cookie))).json();assert.equal(new URL(deny.redirect).searchParams.get('error'),'access_denied');
  const consent=await (await h.request('/api/oauth/consent',post({query:query.toString(),approved:true},a.cookie))).json();const redirect=new URL(consent.redirect);assert.equal(redirect.origin,new URL(callback).origin);assert.equal(redirect.searchParams.get('state'),'opaque-state');assert.equal(redirect.searchParams.get('iss'),site);const code=redirect.searchParams.get('code');
  const expired=await (await h.request('/api/oauth/consent',post({query:query.toString(),approved:true},a.cookie))).json();
  const expiredCode=new URL(expired.redirect).searchParams.get('code');await h.db.prepare('UPDATE codes SET expires_at = ? WHERE token_hash = ?').bind(now()-1,await hash(expiredCode)).run();
  assert.equal((await h.request('/oauth/token',form({grant_type:'authorization_code',client_id:client.client_id,redirect_uri:callback,resource:site+'/mcp',code_verifier:verifier,code:expiredCode}))).status,400);
  const params={grant_type:'authorization_code',client_id:client.client_id,redirect_uri:callback,code,code_verifier:verifier,resource:site+'/mcp'};
  assert.equal((await h.request('/oauth/token',form({...params,code_verifier:random()}))).status,400);
  assert.equal((await h.request('/oauth/token',form({...params,resource:site+'/different-server'}))).status,400);
  const badScope=new URLSearchParams(query);badScope.set('scope','scene:write');assert.equal((await h.request('/oauth/authorize?'+badScope)).status,400);
  const exchange=await h.request('/oauth/token',form(params));assert.equal(exchange.status,200);const tokens=await exchange.json();assert.equal(tokens.expires_in,600);assert.equal((await h.request('/oauth/token',form(params))).status,400);
  const tool=await (await h.request('/mcp',mcp(tokens.access_token,'tools/call',{name:'get_connection_status',arguments:{}}))).json();assert.equal(tool.result.structuredContent.accountId,a.id);assert.equal(tool.result.structuredContent.liveStudioPairing,true);
  const refresh={grant_type:'refresh_token',client_id:client.client_id,resource:site+'/mcp',refresh_token:tokens.refresh_token};const renewed=await (await h.request('/oauth/token',form(refresh))).json();assert(renewed.access_token);assert.equal((await h.request('/oauth/token',form(refresh))).status,400);
  const g=(await h.db.prepare('SELECT id FROM grants WHERE account_id = ?').bind(a.id).first()).id;
  await h.request('/api/account/revoke',post({id:g},b.cookie));assert.equal((await h.request('/mcp',mcp(renewed.access_token))).status,200);
  await h.request('/api/account/revoke',post({id:g},a.cookie));assert.equal((await h.request('/mcp',mcp(renewed.access_token))).status,401);assert.equal((await h.request('/oauth/token',form({...refresh,refresh_token:renewed.refresh_token}))).status,400);
  const stored=await h.db.prepare('SELECT token_hash FROM tokens').all();assert(!stored.results.some(x=>[tokens.access_token,tokens.refresh_token].includes(x.token_hash)));
 }finally{await h.dispose();}
});
test('Oversized input, expired codes, rate limits and unsafe origins fail closed',async()=>{
 const h=await harness();try {
  assert.equal((await h.request('/api/account/recover',post({code:'a'.repeat(40000)}))).status,413);
  assert.equal((await h.request('/api/account/recover',post(null))).status,400);
  for(let i=0;i<10;i++)await h.request('/api/account/recover',post({code:'invalid'}));assert.equal((await h.request('/api/account/recover',post({code:'invalid'}))).status,429);
  const home=await h.request('/');assert.match(await home.text(),/href="\/account\/">Connections/);
  const studio=await h.request('/editor/studio/');assert.match(await studio.text(),/Account &amp; agent connections/);
  assert.equal((await h.request('/mcp',{headers:{Origin:'https://attacker.test'}})).status,403);
  const r=await h.request('/account/');assert.equal(r.headers.get('cache-control'),'no-store');assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.match(await r.text(),/No email or password/);
  const other=await h.mf.dispatchFetch('https://other.test/account/');assert.equal(other.status,421);
  const preflight=await h.request('/oauth/token',{method:'OPTIONS'});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'*');
 }finally{await h.dispose();}
});
