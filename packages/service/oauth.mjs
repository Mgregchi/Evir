import {HttpError, now, random, hash, json, raw, origin, session, sameOrigin, body, limit} from './security.mjs';
export const scope = 'account:read';
export function clients(env) {
  let list; try {list=typeof env.OAUTH_CLIENTS==='string'?JSON.parse(env.OAUTH_CLIENTS):(env.OAUTH_CLIENTS||[]);} catch {throw new HttpError(503,'Connection configuration is invalid.');}
  if(!Array.isArray(list)||list.length>32)throw new HttpError(503,'Connection configuration is invalid.');
  const ids=new Set();
  for(const c of list) {
    if(!c||typeof c.client_id!=='string'||!c.client_id||c.client_id.length>200||ids.has(c.client_id)||typeof c.client_name!=='string'||!c.client_name||c.client_name.length>100||!Array.isArray(c.redirect_uris)||!c.redirect_uris.length||c.redirect_uris.length>10)throw new HttpError(503,'Connection configuration is invalid.');
    ids.add(c.client_id);
    for(const r of c.redirect_uris){if(typeof r!=='string'||r.length>2048)throw new HttpError(503,'Connections need exact HTTPS callback URLs.');let u;try{u=new URL(r);}catch{}if(!u||u.protocol!=='https:'||u.username||u.password||u.hash)throw new HttpError(503,'Connections need exact HTTPS callback URLs.');}
  }return list;
}
export function authorize(params,env) {
  const one=k=>{if(params.getAll(k).length!==1)throw new HttpError(400,`Expected one ${k}.`);return params.get(k);};
  const client=clients(env).find(c=>c.client_id===one('client_id'));
  if(!client||!client.redirect_uris.includes(one('redirect_uri')))throw new HttpError(400,'Unknown client or callback. Ask the site owner to configure this connection.');
  if(one('response_type')!=='code'||one('code_challenge_method')!=='S256'||!/^[A-Za-z0-9_-]{43}$/.test(one('code_challenge')))throw new HttpError(400,'Authorization code with S256 PKCE is required.');
  if(one('resource')!==origin(env)+'/mcp')throw new HttpError(400,'Incorrect MCP resource.');
  const wanted=params.get('scope')||scope;if(wanted!==scope||params.getAll('scope').length>1)throw new HttpError(400,'Only account:read is available in this release.');
  const state=one('state');if(!state||state.length>2048)throw new HttpError(400,'A bounded OAuth state value is required.');
  return {client,redirect:params.get('redirect_uri'),challenge:params.get('code_challenge'),resource:params.get('resource'),scope:wanted,state};
}
export function metadata(env) {
  const o=origin(env);return {issuer:o,authorization_endpoint:o+'/oauth/authorize',token_endpoint:o+'/oauth/token',revocation_endpoint:o+'/oauth/revoke',response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['none'],scopes_supported:[scope],authorization_response_iss_parameter_supported:true};
}
export async function consent(req,env) {
  sameOrigin(req,env);const account=await session(req,env);await limit(req,env,'consent',60);
  const data=await body(req);if(typeof data.query!=='string'||data.query.length>8192)throw new HttpError(400,'Invalid consent request.');
  const a=authorize(new URLSearchParams(data.query),env);const dest=new URL(a.redirect);dest.searchParams.set('state',a.state);dest.searchParams.set('iss',origin(env));
  if(data.approved===false){dest.searchParams.set('error','access_denied');return json({redirect:dest.href});}
  if(data.approved!==true)throw new HttpError(400,'Approval is required.');
  const code=random();await env.DB.prepare('INSERT INTO codes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(await hash(code),account.account_id,a.client.client_id,a.client.client_name,a.redirect,a.resource,a.scope,a.challenge,now()+120).run();
  dest.searchParams.set('code',code);return json({redirect:dest.href});
}
async function tokenPair(env,grantId,expires,extra=[]) {
  const access=random(),refresh=random();const t=now();
  await env.DB.batch([...extra,env.DB.prepare('INSERT INTO tokens VALUES (?, ?, ?, ?)').bind(await hash(access),grantId,'access',Math.min(t+600,expires)),env.DB.prepare('INSERT INTO tokens VALUES (?, ?, ?, ?)').bind(await hash(refresh),grantId,'refresh',expires)]);
  return json({access_token:access,token_type:'Bearer',expires_in:Math.min(600,expires-t),refresh_token:refresh,scope});
}
export async function token(req,env) {
  await limit(req,env,'token',120);
  if(!req.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded'))return json({error:'invalid_request'},400);
  const p=new URLSearchParams(await raw(req,8192));
  for(const k of new Set(p.keys()))if(p.getAll(k).length!==1)return json({error:'invalid_request'},400);
  const client=clients(env).find(c=>c.client_id===p.get('client_id'));
  if(!client||req.headers.has('Authorization')||p.has('client_secret'))return json({error:'invalid_client'},401);
  if(p.get('resource')!==origin(env)+'/mcp')return json({error:'invalid_target'},400);
  if(p.get('grant_type')==='authorization_code'){
    if(!/^[A-Za-z0-9._~-]{43,128}$/.test(p.get('code_verifier')||''))return json({error:'invalid_grant'},400);
    const row=await env.DB.prepare('DELETE FROM codes WHERE token_hash = ? AND client_id = ? AND redirect_uri = ? AND resource = ? AND challenge = ? AND expires_at > ? RETURNING *').bind(await hash(p.get('code')||''),client.client_id,p.get('redirect_uri')||'',p.get('resource'),await hash(p.get('code_verifier')),now()).first();
    if(!row)return json({error:'invalid_grant'},400);
    const id=random(),expires=now()+2592000;
    return tokenPair(env,id,expires,[env.DB.prepare('INSERT INTO grants VALUES (?, ?, ?, ?, ?, ?, ?, NULL)').bind(id,row.account_id,client.client_id,client.client_name,row.scope,now(),expires)]);
  }
  if(p.get('grant_type')==='refresh_token'){
    if(p.has('scope')&&p.get('scope')!==scope)return json({error:'invalid_scope'},400);
    const h=await hash(p.get('refresh_token')||'');
    const g=await env.DB.prepare('SELECT g.* FROM grants g JOIN tokens t ON t.grant_id = g.id WHERE t.token_hash = ? AND t.kind = ? AND t.expires_at > ? AND g.client_id = ? AND g.revoked_at IS NULL AND g.expires_at > ?').bind(h,'refresh',now(),client.client_id,now()).first();
    if(!g)return json({error:'invalid_grant'},400);
    const used=await env.DB.prepare('DELETE FROM tokens WHERE token_hash = ? RETURNING token_hash').bind(h).first();
    if(!used)return json({error:'invalid_grant'},400);
    return tokenPair(env,g.id,g.expires_at);
  }
  return json({error:'unsupported_grant_type'},400);
}
export async function bearer(req,env) {
  const h=req.headers.get('Authorization')||'';if(!/^Bearer [A-Za-z0-9_-]{43}$/.test(h))return null;
  return env.DB.prepare('SELECT g.id, g.account_id, g.client_id, g.scope FROM grants g JOIN tokens t ON t.grant_id = g.id WHERE t.token_hash = ? AND t.kind = ? AND t.expires_at > ? AND g.revoked_at IS NULL AND g.expires_at > ?').bind(await hash(h.slice(7)),'access',now(),now()).first();
}
export async function revoke(req,env) {
  await limit(req,env,'revoke',60);const p=new URLSearchParams(await raw(req,8192));
  const client=clients(env).find(c=>c.client_id===p.get('client_id'));if(!client)return json({error:'invalid_client'},401);
  await env.DB.prepare('UPDATE grants SET revoked_at = ? WHERE client_id = ? AND id IN (SELECT grant_id FROM tokens WHERE token_hash = ?)').bind(now(),client.client_id,await hash(p.get('token')||'')).run();
  return json({});
}
