import {matchesRedirect} from './oauth-published.mjs';
import {closeGrants} from './live.mjs';
import {HttpError, now, random, hash, json, raw, origin, session, sameOrigin, body, limit} from './security.mjs';
import {authenticateClient,findClient,scopes,parseScopes,clientAuthMethods} from './oauth-clients.mjs';
export {clients,scope,scopes,parseScopes} from './oauth-clients.mjs';
export const permits=(grant,permission)=>grant.scope.split(' ').includes(permission);
export async function authorize(params,env) {
  const one=k=>{if(params.getAll(k).length!==1)throw new HttpError(400,`Expected one ${k}.`);return params.get(k);};
  const client=await findClient(env,one('client_id'));
  if(!client||!matchesRedirect(client,one('redirect_uri')))throw new HttpError(400,'Unknown client or callback. Register this connector or check its configured callback.');
  if(one('response_type')!=='code'||one('code_challenge_method')!=='S256'||!/^[A-Za-z0-9_-]{43}$/.test(one('code_challenge')))throw new HttpError(400,'Authorization code with S256 PKCE is required.');
  if(one('resource')!==origin(env)+'/mcp')throw new HttpError(400,'Incorrect MCP resource.');
  if(params.getAll('scope').length>1)throw new HttpError(400,'Expected one scope value.');const wanted=parseScopes(params.get('scope')||client.scope);
  if(wanted.split(' ').some(p=>!permits(client,p)))throw new HttpError(400,'The requested permissions exceed this client registration.');
  const state=one('state');if(!state||state.length>2048)throw new HttpError(400,'A bounded OAuth state value is required.');
  return {client,redirect:params.get('redirect_uri'),challenge:params.get('code_challenge'),resource:params.get('resource'),scope:wanted,state};
}
export function metadata(env) {
  const o=origin(env);return {issuer:o,authorization_endpoint:o+'/oauth/authorize',token_endpoint:o+'/oauth/token',revocation_endpoint:o+'/oauth/revoke',response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],code_challenge_methods_supported:['S256'],registration_endpoint:o+'/oauth/register',client_id_metadata_document_supported:true,token_endpoint_auth_methods_supported:[...clientAuthMethods,'private_key_jwt'],token_endpoint_auth_signing_alg_values_supported:['RS256','ES256'],scopes_supported:scopes,authorization_response_iss_parameter_supported:true};
}
export async function consent(req,env) {
  sameOrigin(req,env);const account=await session(req,env);await limit(req,env,'consent',60);
  const data=await body(req);if(typeof data.query!=='string'||data.query.length>8192)throw new HttpError(400,'Invalid consent request.');
  const a=await authorize(new URLSearchParams(data.query),env);const dest=new URL(a.redirect);dest.searchParams.set('state',a.state);dest.searchParams.set('iss',origin(env));
  if(data.approved===false){dest.searchParams.set('error','access_denied');return json({redirect:dest.href});}
  if(data.approved!==true)throw new HttpError(400,'Approval is required.');
  const code=random();await env.DB.prepare('INSERT INTO codes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(await hash(code),account.account_id,a.client.client_id,a.client.client_name,a.redirect,a.resource,a.scope,a.challenge,now()+120).run();
  dest.searchParams.set('code',code);return json({redirect:dest.href});
}
async function tokenPair(env,grantId,expires,grantedScope,extra=[],allowRefresh=true) {
  const access=random(),refresh=random();const t=now();
  await env.DB.batch([...extra,env.DB.prepare('INSERT INTO tokens VALUES (?, ?, ?, ?)').bind(await hash(access),grantId,'access',Math.min(t+600,expires)),...(allowRefresh?[env.DB.prepare('INSERT INTO tokens VALUES (?, ?, ?, ?)').bind(await hash(refresh),grantId,'refresh',expires)]:[])]);
  return json({access_token:access,token_type:'Bearer',expires_in:Math.min(600,expires-t),...(allowRefresh?{refresh_token:refresh}:{}),scope:grantedScope});
}
export async function token(req,env) {
  await limit(req,env,'token',120);
  const p=await oauthForm(req);if(!p)return json({error:'invalid_request'},400);
  const client=await authenticateClient(req,env,p);if(!client)return clientFailure(req);
  if(['authorization_code','refresh_token'].includes(p.get('grant_type'))&&!client.grant_types.includes(p.get('grant_type')))return json({error:'unauthorized_client'},400);
  if(p.get('resource')!==origin(env)+'/mcp')return json({error:'invalid_target'},400);
  if(p.get('grant_type')==='authorization_code'){
    if(!matchesRedirect(client,p.get('redirect_uri')))return json({error:'invalid_grant'},400);
    if(!/^[A-Za-z0-9._~-]{43,128}$/.test(p.get('code_verifier')||''))return json({error:'invalid_grant'},400);
    const row=await env.DB.prepare('DELETE FROM codes WHERE token_hash = ? AND client_id = ? AND redirect_uri = ? AND resource = ? AND challenge = ? AND expires_at > ? RETURNING *').bind(await hash(p.get('code')||''),client.client_id,p.get('redirect_uri')||'',p.get('resource'),await hash(p.get('code_verifier')),now()).first();
    if(!row||row.scope.split(' ').some(s=>!permits(client,s)))return json({error:'invalid_grant'},400);
    const id=random(),expires=now()+2592000;
    return tokenPair(env,id,expires,row.scope,[env.DB.prepare('INSERT INTO grants VALUES (?, ?, ?, ?, ?, ?, ?, NULL)').bind(id,row.account_id,client.client_id,client.client_name,row.scope,now(),expires)],client.grant_types.includes('refresh_token'));
  }
  if(p.get('grant_type')==='refresh_token'){
    const h=await hash(p.get('refresh_token')||'');
    const g=await env.DB.prepare('SELECT g.* FROM grants g JOIN tokens t ON t.grant_id = g.id WHERE t.token_hash = ? AND t.kind = ? AND t.expires_at > ? AND g.client_id = ? AND g.revoked_at IS NULL AND g.expires_at > ?').bind(h,'refresh',now(),client.client_id,now()).first();
    if(!g||g.scope.split(' ').some(s=>!permits(client,s)))return json({error:'invalid_grant'},400);
    if(p.has('scope')){let wanted;try{wanted=parseScopes(p.get('scope'));}catch{return json({error:'invalid_scope'},400);}if(wanted!==g.scope)return json({error:'invalid_scope'},400);}
    const used=await env.DB.prepare('DELETE FROM tokens WHERE token_hash = ? RETURNING token_hash').bind(h).first();
    if(!used)return json({error:'invalid_grant'},400);
    return tokenPair(env,g.id,g.expires_at,g.scope);
  }
  return json({error:'unsupported_grant_type'},400);
}
export async function bearer(req,env) {
  const h=req.headers.get('Authorization')||'';if(!/^Bearer [A-Za-z0-9_-]{43}$/.test(h))return null;
  return env.DB.prepare('SELECT g.id, g.account_id, g.client_id, g.scope FROM grants g JOIN tokens t ON t.grant_id = g.id WHERE t.token_hash = ? AND t.kind = ? AND t.expires_at > ? AND g.revoked_at IS NULL AND g.expires_at > ?').bind(await hash(h.slice(7)),'access',now(),now()).first();
}
export async function revoke(req,env) {
  await limit(req,env,'revoke',60);const p=await oauthForm(req);if(!p)return json({error:'invalid_request'},400);
  const client=await authenticateClient(req,env,p);if(!client)return clientFailure(req);
  const owned=await env.DB.prepare('SELECT g.account_id,g.id FROM grants g JOIN tokens t ON t.grant_id = g.id WHERE g.client_id = ? AND t.token_hash = ?').bind(client.client_id,await hash(p.get('token')||'')).first();
  await env.DB.prepare('UPDATE grants SET revoked_at = ? WHERE client_id = ? AND id IN (SELECT grant_id FROM tokens WHERE token_hash = ?)').bind(now(),client.client_id,await hash(p.get('token')||'')).run();
  if(owned)await closeGrants(env,owned.account_id,owned.id);
  return json({});
}

async function oauthForm(req){
  if(!req.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded'))return null;
  const p=new URLSearchParams(await raw(req,8192));
  for(const k of new Set(p.keys()))if(p.getAll(k).length!==1)return null;
  return p;
}
function clientFailure(req){return json({error:'invalid_client'},401,req.headers.has('Authorization')?{'WWW-Authenticate':'Basic realm="Evir OAuth"'}:{});}
