import {HttpError,body,hash,json,limit,now,random} from './security.mjs';

import {clientAuthMethods,scopes,parseScopes,validRedirect} from './oauth-policy.mjs';
import {publishedClient} from './oauth-published.mjs';
import {verifyClientAssertion} from './oauth-assertions.mjs';
export {scope,scopes,parseScopes,clientAuthMethods} from './oauth-policy.mjs';
// Dashboard-defined clients retain the public/PKCE contract from the account release.
export function clients(env){
  let list;try{list=typeof env.OAUTH_CLIENTS==='string'?JSON.parse(env.OAUTH_CLIENTS):(env.OAUTH_CLIENTS||[]);}catch{throw new HttpError(503,'Connection configuration is invalid.');}
  if(!Array.isArray(list)||list.length>32)throw new HttpError(503,'Connection configuration is invalid.');
  const ids=new Set();
  for(const c of list){
    if(!c||typeof c.client_id!=='string'||!c.client_id||c.client_id.length>200||ids.has(c.client_id)||typeof c.client_name!=='string'||!c.client_name||c.client_name.length>100||!Array.isArray(c.redirect_uris)||!c.redirect_uris.length||c.redirect_uris.length>10||!c.redirect_uris.every(validRedirect))throw new HttpError(503,'Connections need a unique client ID, name and exact HTTPS callback URLs.');
    ids.add(c.client_id);
  }
  return list.map(c=>({...c,token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],scope:scopes.join(' '),registration:'predefined'}));
}
export async function findClient(env,id){
  if(typeof id!=='string'||!id||id.length>512)return null;
  const predefined=clients(env).find(c=>c.client_id===id);if(predefined)return predefined;
  const row=await env.DB.prepare('SELECT metadata,secret_hash FROM oauth_clients WHERE id = ?').bind(id).first();
  return row?{...JSON.parse(row.metadata),secret_hash:row.secret_hash,registration:'dynamic'}:publishedClient(id);
}
function invalid(message,code='invalid_client_metadata'){const e=new HttpError(400,message);e.oauthError=code;throw e;}
function choices(value,fallback,allowed){
  const list=value===undefined?fallback:value;
  if(!Array.isArray(list)||!list.length||new Set(list).size!==list.length||list.some(v=>!allowed.includes(v)))invalid('Only authorization-code and optional refresh grants with code responses are supported.');
  return list;
}
export async function registerClient(req,env){
  try{
    await limit(req,env,'oauth-registration',10);
    if(!req.headers.get('Content-Type')?.startsWith('application/json'))invalid('Send client metadata as application/json.');
    const data=await body(req,16384);
    if(!Array.isArray(data.redirect_uris)||!data.redirect_uris.length||data.redirect_uris.length>8||new Set(data.redirect_uris).size!==data.redirect_uris.length||!data.redirect_uris.every(validRedirect))invalid('Register one to eight distinct, exact HTTPS callbacks without fragments, credentials or wildcards.','invalid_redirect_uri');
    const name=data.client_name===undefined?'Unnamed connector':data.client_name;
    if(typeof name!=='string'||!name.trim()||name.length>120||/[\u0000-\u001f\u007f]/.test(name))invalid('Use a client name of 1–120 characters without control characters.');
    const method=data.token_endpoint_auth_method===undefined?'client_secret_basic':data.token_endpoint_auth_method;
    if(!clientAuthMethods.includes(method))invalid('Choose none, client_secret_post or client_secret_basic.');
    const grants=choices(data.grant_types,['authorization_code'],['authorization_code','refresh_token']);
    if(!grants.includes('authorization_code'))invalid('An authorization-code grant is required.');
    const responses=choices(data.response_types,['code'],['code']);
    let allowedScope;try{allowedScope=parseScopes(data.scope===undefined?scopes.join(' '):data.scope);}catch{invalid('Choose supported account/scene scopes.');}
    const id='dyn_'+random(),secret=method==='none'?null:random();
    const metadata={client_id:id,client_id_issued_at:now(),client_name:name.trim(),redirect_uris:data.redirect_uris,token_endpoint_auth_method:method,grant_types:grants,response_types:responses,scope:allowedScope};
    // Unknown metadata is ignored. No client-supplied URL is fetched and no supplied
    // secret/client ID is trusted. Credentials remain stable across deployments.
    const result=await env.DB.prepare('INSERT INTO oauth_clients SELECT ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM oauth_clients) < 10000').bind(id,JSON.stringify(metadata),secret?await hash(secret):null,now()).run();
    if(!result.meta.changes)throw new HttpError(429,'Client registration capacity reached. Existing connections remain available.');
    return json({...metadata,...(secret?{client_secret:secret,client_secret_expires_at:0}:{})},201);
  }catch(e){if(!(e instanceof HttpError))throw e;return json({error:e.oauthError||(e.status===429?'temporarily_unavailable':'invalid_client_metadata'),error_description:e.message},e.status);}
}
export async function authenticateClient(req,env,params){
  const authorization=req.headers.get('Authorization');let id=params.get('client_id'),secret=params.get('client_secret'),method=secret===null?'none':'client_secret_post';
  if(params.has('client_assertion')||params.has('client_assertion_type')){
    if(authorization!==null||secret!==null||params.get('client_assertion_type')!=='urn:ietf:params:oauth:client-assertion-type:jwt-bearer'||!params.get('client_assertion'))return null;
    method='private_key_jwt';
  }
  if(authorization!==null){
    if(secret!==null||authorization.length>2048||!/^Basic [A-Za-z0-9+/]+={0,2}$/i.test(authorization))return null;
    try{
      const decoded=atob(authorization.slice(6)),at=decoded.indexOf(':');if(at<0)return null;
      const unform=s=>decodeURIComponent(s.replaceAll('+',' '));
      const basicId=unform(decoded.slice(0,at));secret=unform(decoded.slice(at+1));
      if(id!==null&&id!==basicId)return null;id=basicId;method='client_secret_basic';
    }catch{return null;}
  }
  const client=await findClient(env,id);
  if(!client||!(client.authMethods||[client.token_endpoint_auth_method]).includes(method))return null;
  if(method==='private_key_jwt')return await verifyClientAssertion(req,env,client,params.get('client_assertion'))?client:null;
  if(method!=='none'&&(!secret||await hash(secret)!==client.secret_hash))return null;
  return client;
}
