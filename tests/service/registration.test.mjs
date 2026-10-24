import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,site,callback,authQuery} from './harness.mjs';
import {hash,random} from '../../packages/service/security.mjs';

let ip=0;
const post=(data,cookie)=>({method:'POST',headers:{'Content-Type':'application/json',Origin:site,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});
const form=(params,headers={})=>({method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',...headers},body:new URLSearchParams(params).toString()});
const register=(h,data,extra={})=>h.request('/oauth/register',{...post(data),headers:{'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.'+(++ip),...extra}});
function credentials(client,params={}){
  if(client.token_endpoint_auth_method==='client_secret_basic')return form(params,{Authorization:'Basic '+btoa(encodeURIComponent(client.client_id)+':'+encodeURIComponent(client.client_secret))});
  return form({client_id:client.client_id,...(client.client_secret?{client_secret:client.client_secret}:{}),...params});
}
const mcp=(token,origin)=>({method:'POST',headers:{Authorization:'Bearer '+token,...(origin?{Origin:origin}:{}),Accept:'application/json, text/event-stream','Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})});
async function codeFor(h,owner,client){
  const verifier=random(),query=authQuery(await hash(verifier));query.set('client_id',client.client_id);query.set('scope',client.scope);
  const r=await h.request('/api/oauth/consent',post({query:query.toString(),approved:true},owner.cookie));assert.equal(r.status,200);
  const redirect=new URL((await r.json()).redirect);assert.equal(redirect.searchParams.get('iss'),site);
  return {verifier,query,code:redirect.searchParams.get('code')};
}
for(const method of ['none','client_secret_post','client_secret_basic'])test(`DCR ${method}: consent, PKCE, scope/resource binding, refresh and authenticated revocation`,async()=>{
  const h=await harness({oauthClients:[]});try{
    const r=await register(h,{client_name:'A self-reported agent',redirect_uris:[callback],token_endpoint_auth_method:method,grant_types:['authorization_code','refresh_token'],scope:'account:read scene:read',client_id:'spoofed',client_secret:'never-trust-this',logo_uri:'https://127.0.0.1/private'});
    assert.equal(r.status,201);assert.equal(r.headers.get('cache-control'),'no-store');const client=await r.json();assert.match(client.client_id,/^dyn_[A-Za-z0-9_-]{43}$/);
    assert.equal(client.client_secret_expires_at,method==='none'?undefined:0);assert.equal(!!client.client_secret,method!=='none');assert(!('logo_uri'in client));
    const row=await h.db.prepare('SELECT * FROM oauth_clients WHERE id = ?').bind(client.client_id).first();assert(!JSON.stringify(row).includes('never-trust-this'));if(client.client_secret){assert.equal(row.secret_hash,await hash(client.client_secret));assert(!JSON.stringify(row).includes(client.client_secret));}
    assert.equal((await h.db.prepare('SELECT COUNT(*) AS n FROM accounts').first()).n,0);assert.equal((await h.request('/mcp')).status,401);
    const owner=await h.account(),{verifier,query,code}=await codeFor(h,owner,client);
    const display=await (await h.request('/api/oauth/request?'+query)).json();assert.equal(display.registration,'dynamic');assert.equal(display.redirectUri,callback);
    const wider=new URLSearchParams(query);wider.set('scope','account:read scene:read scene:write');assert.equal((await h.request('/oauth/authorize?'+wider)).status,400);
    const wrongCallback=new URLSearchParams(query);wrongCallback.set('redirect_uri',callback+'?changed=1');assert.equal((await h.request('/oauth/authorize?'+wrongCallback)).status,400);
    const exchange={grant_type:'authorization_code',code,code_verifier:verifier,redirect_uri:callback,resource:site+'/mcp'};
    const badAuth=method==='none'?form({client_id:client.client_id,client_secret:'wrong',...exchange}):credentials({...client,client_secret:'wrong'},exchange);
    assert.equal((await h.request('/oauth/token',badAuth)).status,401);
    assert.equal((await h.request('/oauth/token',credentials(client,{...exchange,code_verifier:random()}))).status,400);
    assert.equal((await h.request('/oauth/token',credentials(client,{...exchange,resource:site+'/other'}))).status,400);
    const tokens=await (await h.request('/oauth/token',credentials(client,exchange))).json();assert(tokens.access_token&&tokens.refresh_token);assert.equal(tokens.scope,client.scope);
    assert.equal((await h.request('/oauth/token',credentials(client,exchange))).status,400);
    assert.equal((await h.request('/mcp',mcp(tokens.access_token,'https://agent.example'))).status,200);assert.equal((await h.request('/mcp',mcp(tokens.access_token,'https://attacker.test'))).status,403);
    const sessions=await h.db.prepare('SELECT COUNT(*) AS n FROM live_sessions').first();assert.equal(sessions.n,0,'OAuth registration and consent do not share a Studio project');
    const other=await (await register(h,{redirect_uris:[callback],token_endpoint_auth_method:method,grant_types:['authorization_code','refresh_token']})).json();
    const refresh={grant_type:'refresh_token',refresh_token:tokens.refresh_token,resource:site+'/mcp'};
    assert.equal((await h.request('/oauth/token',credentials(other,refresh))).status,400);
    const renewed=await (await h.request('/oauth/token',credentials(client,refresh))).json();assert(renewed.access_token);assert.equal((await h.request('/oauth/token',credentials(client,refresh))).status,400);
    const badRevoke=method==='none'?form({client_id:client.client_id,client_secret:'wrong',token:renewed.access_token}):credentials({...client,client_secret:'wrong'},{token:renewed.access_token});
    assert.equal((await h.request('/oauth/revoke',badRevoke)).status,401);assert.equal((await h.request('/mcp',mcp(renewed.access_token))).status,200);
    assert.equal((await h.request('/oauth/revoke',credentials(client,{token:renewed.access_token}))).status,200);assert.equal((await h.request('/mcp',mcp(renewed.access_token))).status,401);
    assert.equal((await h.db.prepare('SELECT secret_hash FROM oauth_clients WHERE id = ?').bind(client.client_id).first()).secret_hash,row.secret_hash,'Grant revocation leaves stable client credentials intact');
  }finally{await h.dispose();}
});

test('RFC defaults, exact redirects, unsupported metadata, and mixed client authentication fail safely',async()=>{
  const h=await harness({oauthClients:[]});try{
    const defaults=await (await register(h,{redirect_uris:[callback]})).json();assert.equal(defaults.token_endpoint_auth_method,'client_secret_basic');assert.deepEqual(defaults.grant_types,['authorization_code']);assert.deepEqual(defaults.response_types,['code']);
    const owner=await h.account(),{verifier,code}=await codeFor(h,owner,defaults),exchange={grant_type:'authorization_code',code,code_verifier:verifier,redirect_uri:callback,resource:site+'/mcp'};
    const mixed=credentials(defaults,{...exchange,client_secret:defaults.client_secret});assert.equal((await h.request('/oauth/token',mixed)).status,401);
    const malformed=form(exchange,{Authorization:'Basic '+btoa('%GG:bad')});const invalid=await h.request('/oauth/token',malformed);assert.equal(invalid.status,401);assert.match(invalid.headers.get('www-authenticate'),/Basic/);
    const tokens=await (await h.request('/oauth/token',credentials(defaults,exchange))).json();assert(tokens.access_token);assert(!tokens.refresh_token);
    for(const requested of ['2025-06-18','2025-11-25','future-version']){
      const init=mcp(tokens.access_token);init.body=JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:requested,capabilities:{},clientInfo:{name:'Registration test',version:'1'}}});
      const response=await (await h.request('/mcp',init)).json();assert.equal(response.result.protocolVersion,requested==='future-version'?'2025-11-25':requested);
    }

    assert.equal((await h.request('/oauth/token',credentials(defaults,{grant_type:'refresh_token',refresh_token:'missing',resource:site+'/mcp'}))).status,400);
    for(const uri of ['http://agent.example/callback','https://agent.example/#fragment','https://agent.example/#','https://user:pass@agent.example/callback','https://agent.example/*',' https://agent.example/callback']){
      const r=await register(h,{redirect_uris:[uri]});assert.equal(r.status,400);assert.equal((await r.json()).error,'invalid_redirect_uri');assert(!r.headers.has('Location'));
    }
    for(const bad of [{redirect_uris:[]},{redirect_uris:[callback,callback]},{client_name:'\npretend'},{token_endpoint_auth_method:'private_key_jwt'},{grant_types:['client_credentials']},{response_types:['token']},{scope:'account:read email'},{scope:['account:read']}])assert.equal((await register(h,{redirect_uris:[callback],...bad})).status,400);
    const preflight=await h.request('/oauth/register',{method:'OPTIONS'});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'*');
    assert.equal((await register(h,{redirect_uris:[callback],client_name:'x'.repeat(17000)})).status,413);
  }finally{await h.dispose();}
});

test('Registration rate and global storage bounds do not create accounts or delete existing clients',async()=>{
  const h=await harness({oauthClients:[]});try{
    for(let i=0;i<10;i++)assert.equal((await register(h,{redirect_uris:[callback]},{'CF-Connecting-IP':'203.0.113.10'})).status,201);
    assert.equal((await register(h,{redirect_uris:[callback]},{'CF-Connecting-IP':'203.0.113.10'})).status,429);
    await h.db.exec("WITH RECURSIVE n(x) AS (SELECT 10 UNION ALL SELECT x+1 FROM n WHERE x<9999) INSERT INTO oauth_clients SELECT 'capacity-'||x,'{}',NULL,1 FROM n;");
    assert.equal((await register(h,{redirect_uris:[callback]})).status,429);assert.equal((await h.db.prepare('SELECT COUNT(*) AS n FROM oauth_clients').first()).n,10000);assert.equal((await h.db.prepare('SELECT COUNT(*) AS n FROM accounts').first()).n,0);
  }finally{await h.dispose();}
});
