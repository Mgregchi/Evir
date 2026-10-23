import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SignJWT} from 'jose';
import {harness,site,callback,authQuery} from './harness.mjs';
import {random,hash,now,cleanup} from '../../packages/service/security.mjs';
import {clientId,keyURL,publisher,route,document,keys,codeFor,assertion,exchange,form} from './published-fixtures.mjs';

for(const alg of ['ES256','RS256'])test(`Published ${alg} assertions authenticate tokens, rotate refresh and reject replay atomically`,async()=>{
 const mock=publisher(),key=await keys(alg),doc=document({token_endpoint_auth_method:'private_key_jwt',jwks_uri:keyURL});let fetches=0;
 route(mock,clientId,()=>({data:doc}));route(mock,keyURL,()=>{fetches++;return {data:{keys:[key.jwk]}};});
 const h=await harness({oauthClients:[],fetchMock:mock});try{
  const owner=await h.account(),c=await codeFor(h,owner),proof=await assertion(key);
  const results=await Promise.all([h.request('/oauth/token',form(exchange(c,proof))),h.request('/oauth/token',form(exchange(c,proof)))]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,401]);const token=await results.find(r=>r.status===200).json();assert(token.access_token&&token.refresh_token);assert.equal(fetches,1);
  assert.equal((await h.request('/oauth/token',form(exchange(c,proof)))).status,401);
  const refresh={client_id:clientId,grant_type:'refresh_token',resource:site+'/mcp',refresh_token:token.refresh_token,client_assertion_type:'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',client_assertion:await assertion(key,{aud:site})};
  const renewed=await h.request('/oauth/token',form(refresh));assert.equal(renewed.status,200);const next=await renewed.json();assert(next.refresh_token);
  assert.equal((await h.request('/oauth/token',form({...refresh,client_assertion:await assertion(key)}))).status,400);
  const revoke={client_id:clientId,token:next.access_token,client_assertion_type:refresh.client_assertion_type,client_assertion:await assertion(key,{aud:site+'/oauth/revoke'})};assert.equal((await h.request('/oauth/revoke',form(revoke))).status,200);
  assert.equal((await h.db.prepare('SELECT COUNT(*) AS n FROM oauth_clients').first()).n,0,'Published identity does not create a dynamic registration');
  const used=await h.db.prepare('SELECT token_hash FROM oauth_assertions').all();assert(used.results.length>=3);assert(!JSON.stringify(used).includes(proof));
  await h.db.prepare('INSERT INTO oauth_assertions VALUES (?, ?)').bind('expired-nonce',now()-1).run();await cleanup({DB:h.db});assert.equal(await h.db.prepare('SELECT * FROM oauth_assertions WHERE token_hash = ?').bind('expired-nonce').first(),null);assert((await h.db.prepare('SELECT COUNT(*) AS n FROM oauth_assertions').first()).n>=3);
 }finally{await h.dispose();await mock.close();}
});

test('Assertions reject wrong keys, algorithms, audiences, identities, lifetime, headers, missing nonce and mixed credentials',async()=>{
 const mock=publisher(),key=await keys(),wrong=await keys('ES256',key.kid);route(mock,clientId,()=>({data:document({token_endpoint_auth_method:'private_key_jwt',jwks:{keys:[key.jwk]}})}));
 const h=await harness({oauthClients:[],fetchMock:mock});try{
  const c=await codeFor(h,await h.account());
  const invalid=[await assertion(wrong),await assertion(key,{aud:site+'/mcp'}),await assertion(key,{iss:'https://other.example/client'}),await assertion(key,{sub:'different-client'}),await assertion(key,{exp:now()-60,iat:now()-180}),await assertion(key,{iat:now()+90,exp:now()+180}),await assertion(key,{exp:now()+600}),await assertion(key,{jti:''}),await assertion(key,{}, {jku:'https://attacker.example/keys'}),await assertion(key,{}, {kid:'unknown'})];
  const missing=new SignJWT({iss:clientId,sub:clientId,aud:site,exp:now()+60}).setProtectedHeader({alg:key.alg,kid:key.kid});invalid.push(await missing.sign(key.privateKey));
  invalid.push(await new SignJWT({iss:clientId,sub:clientId,aud:site,iat:now(),exp:now()+60,jti:random()}).setProtectedHeader({alg:'HS256',kid:key.kid}).sign(new TextEncoder().encode('x'.repeat(32))));
  for(const proof of invalid)assert.equal((await h.request('/oauth/token',form(exchange(c,proof)))).status,401);
  const good=await assertion(key);assert.equal((await h.request('/oauth/token',form({...exchange(c,good),client_secret:'not-allowed'}))).status,401);
  const badType={...exchange(c,good),client_assertion_type:'jwt'};assert.equal((await h.request('/oauth/token',form(badType))).status,401);
  assert.equal((await h.db.prepare('SELECT COUNT(*) AS n FROM oauth_assertions').first()).n,0,'Invalid signatures/claims and mixed credentials consume no nonce');
  assert.equal((await h.request('/oauth/token',form(exchange(c,good)))).status,200);
 }finally{await h.dispose();await mock.close();}
});

test('Plural published methods take precedence over the legacy hint without enabling shared secrets',async()=>{
 const mock=publisher(),key=await keys();route(mock,clientId,()=>({data:document({token_endpoint_auth_method:'private_key_jwt',token_endpoint_auth_methods_supported:['none','future_asymmetric_method','private_key_jwt'],jwks:{keys:[key.jwk]}})}));
 const h=await harness({oauthClients:[],fetchMock:mock});try{
  const owner=await h.account(),publicCode=await codeFor(h,owner);assert.equal((await h.request('/oauth/token',form(exchange(publicCode)))).status,200);
  const signedCode=await codeFor(h,owner);assert.equal((await h.request('/oauth/token',form(exchange(signedCode,await assertion(key))))).status,200);
  const sharedCode=await codeFor(h,owner);assert.equal((await h.request('/oauth/token',form({...exchange(sharedCode),client_secret:'fake'}))).status,401);
 }finally{await h.dispose();await mock.close();}
});

test('Published defaults and fresh callback/scope restrictions constrain later token issuance',async()=>{
 const mock=publisher();let doc={client_id:clientId,client_name:'Minimal public client',redirect_uris:[callback]};route(mock,clientId,()=>({data:doc,headers:{'cache-control':'no-store'}}));
 const h=await harness({oauthClients:[],fetchMock:mock});try{
  const owner=await h.account(),minimal=await codeFor(h,owner);const response=await h.request('/oauth/token',form(exchange(minimal)));assert.equal(response.status,200);assert(!(await response.json()).refresh_token);
  doc=document();const issued=await codeFor(h,owner,clientId,callback,'account:read scene:read');const tokens=await (await h.request('/oauth/token',form(exchange(issued)))).json();assert(tokens.refresh_token);
  const pending=await codeFor(h,owner,clientId,callback,'account:read scene:read');doc={...doc,scope:'account:read'};
  assert.equal((await h.request('/oauth/token',form(exchange(pending)))).status,400);
  assert.equal((await h.request('/oauth/token',form({client_id:clientId,grant_type:'refresh_token',refresh_token:tokens.refresh_token,resource:site+'/mcp'}))).status,400);
  doc=document();const moved=await codeFor(h,owner);doc={...doc,redirect_uris:['https://agent.example/new-callback']};assert.equal((await h.request('/oauth/token',form(exchange(moved)))).status,400);
 }finally{await h.dispose();await mock.close();}
});

test('Document fetch policy rejects arbitrary URLs, redirects, mismatches, symmetric metadata, private keys and excess bodies',async()=>{
 const mock=publisher();let hits=0,current={data:document(),headers:{'cache-control':'no-store'}};route(mock,clientId,()=>{hits++;return current;});
 const h=await harness({oauthClients:[],fetchMock:mock});try{
  const q=authQuery(await hash(random()));
  for(const id of ['http://chatgpt.com/oauth/client.json','https://chatgpt.com.evil.test/oauth/client.json','https://127.0.0.1/oauth/client.json','https://chatgpt.com:444/oauth/client.json','https://user@chatgpt.com/oauth/client.json','https://chatgpt.com/oauth/../api','https://chatgpt.com/oauth/a?url=http://localhost','https://other.example/client.json']){q.set('client_id',id);assert.equal((await h.request('/oauth/authorize?'+q)).status,400);}
  assert.equal(hits,0);q.set('client_id',clientId);
  const bad=[{client_id:'https://other.example/client'},{token_endpoint_auth_method:'client_secret_post'},{client_secret:'not-public'},{redirect_uris:['http://localhost/callback']},{jwks_uri:'http://169.254.169.254/keys',token_endpoint_auth_method:'private_key_jwt'},{jwks_uri:'https://claude.ai/oauth/keys.json',token_endpoint_auth_method:'private_key_jwt'},{token_endpoint_auth_methods_supported:['none','client_secret_basic']},{token_endpoint_auth_method:'private_key_jwt',jwks:{keys:[{kid:'private',kty:'RSA',d:'private'}]}}];
  for(const changes of bad){current={data:document(changes),headers:{'cache-control':'no-store'}};assert.equal((await h.request('/oauth/authorize?'+q)).status,503);}
  current={data:document(),status:302,headers:{location:'http://169.254.169.254/keys'}};assert.equal((await h.request('/oauth/authorize?'+q)).status,503);
  current={data:'x'.repeat(65537)};assert.equal((await h.request('/oauth/authorize?'+q)).status,503);
  current={data:document(),headers:{'content-type':'text/html'}};assert.equal((await h.request('/oauth/authorize?'+q)).status,503);
  current={data:document(),headers:{'cache-control':'no-store'}};assert.equal((await h.request('/oauth/authorize?'+q)).status,200,'Invalid documents/errors are not cached');
  const slow='https://chatgpt.com/oauth/slow.json';route(mock,slow,()=>({data:document({client_id:slow})})).delay(3500);q.set('client_id',slow);
  assert.equal((await h.request('/oauth/authorize?'+q)).status,503,'A delayed publisher must hit the three-second request deadline');
 }finally{await h.dispose();await mock.close();}
});

test('The observed Claude Code document allows only declared loopback hosts/path, and codes bind the actual port',async()=>{
 const doc=JSON.parse(await readFile('research/cimd/claude-code-metadata.json','utf8')),mock=publisher();let hits=0;route(mock,doc.client_id,()=>{hits++;return {data:doc};});
 const h=await harness({oauthClients:[],fetchMock:mock});try{
  const owner=await h.account(),redirect='http://localhost:49152/callback',c=await codeFor(h,owner,doc.client_id,redirect);
  for(const uri of ['http://localhost.evil.test:49152/callback','http://127.1:49152/callback','http://2130706433:49152/callback','http://127.0.0.2:49152/callback','http://localhost:0/callback','http://localhost:49152/other','http://localhost:49152/callback?extra=1','http://user@localhost:49152/callback']){const q=new URLSearchParams(c.query);q.set('redirect_uri',uri);assert.equal((await h.request('/oauth/authorize?'+q)).status,400);}
  const wrongPort={...exchange(c,undefined,doc.client_id),redirect_uri:'http://localhost:49153/callback'};assert.equal((await h.request('/oauth/token',form(wrongPort))).status,400);
  const wrongVerifier={...exchange(c,undefined,doc.client_id),code_verifier:random()};assert.equal((await h.request('/oauth/token',form(wrongVerifier))).status,400);
  assert.equal((await h.request('/oauth/token',form(exchange(c,undefined,doc.client_id)))).status,200);assert.equal(hits,1);
 }finally{await h.dispose();await mock.close();}
});

test('Unknown kid rotates a cached JWKS once and metadata cache respects no-store, Age and its entry budget',async()=>{
 const mock=publisher(),first=await keys(),second=await keys('ES256','key-b');let jwks={keys:[first.jwk]},keyHits=0;
 route(mock,clientId,()=>({data:document({token_endpoint_auth_method:'private_key_jwt',jwks_uri:keyURL})}));route(mock,keyURL,()=>{keyHits++;return {data:jwks};});
 let ageHits=0;route(mock,'https://claude.ai/oauth/age.json',()=>{ageHits++;return {data:document({client_id:'https://claude.ai/oauth/age.json'}),headers:{'cache-control':'max-age=60',age:'70'}};});
 const counts=new Map();mock.get('https://claude.ai').intercept({method:'GET',path:/^\/oauth\/cache-\d+\.json$/}).reply(o=>{counts.set(o.path,(counts.get(o.path)||0)+1);return {statusCode:200,data:JSON.stringify(document({client_id:'https://claude.ai'+o.path})),responseOptions:{headers:{'content-type':'application/json','cache-control':'max-age=60'}}};}).persist();
 const h=await harness({oauthClients:[],fetchMock:mock});try{
  const owner=await h.account(),a=await codeFor(h,owner);assert.equal((await h.request('/oauth/token',form(exchange(a,await assertion(first))))).status,200);
  jwks={keys:[second.jwk]};await new Promise(r=>setTimeout(r,5100));const b=await codeFor(h,owner);assert.equal((await h.request('/oauth/token',form(exchange(b,await assertion(second))))).status,200);assert.equal(keyHits,2);
  const q=authQuery(await hash(random()));q.set('client_id','https://claude.ai/oauth/age.json');for(let i=0;i<2;i++)assert.equal((await h.request('/api/oauth/request?'+q)).status,200);assert.equal(ageHits,2,'Already-aged documents are not cached');
  for(let i=0;i<33;i++){q.set('client_id',`https://claude.ai/oauth/cache-${i}.json`);assert.equal((await h.request('/api/oauth/request?'+q)).status,200);}q.set('client_id','https://claude.ai/oauth/cache-0.json');assert.equal((await h.request('/api/oauth/request?'+q)).status,200);assert.equal(counts.get('/oauth/cache-0.json'),2,'Cache budget evicts older documents');
 }finally{await h.dispose();await mock.close();}
});

test('The observed ChatGPT document supports public and RS256 methods with its exact declared callback',async()=>{
 const doc=JSON.parse(await readFile('research/cimd/chatgpt-metadata.json','utf8')),mock=publisher(),key=await keys('RS256','rotating-test-key');
 route(mock,doc.client_id,()=>({data:doc}));route(mock,doc.jwks_uri,()=>({data:{keys:[key.jwk]}}));
 const h=await harness({oauthClients:[],fetchMock:mock});try{
  const owner=await h.account(),redirect=doc.redirect_uris[0];
  for(const signed of [false,true]){
   const c=await codeFor(h,owner,doc.client_id,redirect);
   const proof=signed?await assertion(key,{iss:doc.client_id,sub:doc.client_id}):undefined;
   const r=await h.request('/oauth/token',form(exchange(c,proof,doc.client_id)));assert.equal(r.status,200);assert((await r.json()).refresh_token);
  }
  assert.equal((await h.db.prepare('SELECT COUNT(*) AS n FROM oauth_clients').first()).n,0);
 }finally{await h.dispose();await mock.close();}
});
