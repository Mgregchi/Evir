import {HttpError} from './security.mjs';
import {scopes,parseScopes,validRedirect} from './oauth-policy.mjs';

// Curated publisher policy: never follow a client-controlled URL to arbitrary
// DNS, redirects, IP literals, subdomains or other origins. DCR stays available.
export function publishedURL(value){
  if(typeof value!=='string'||value.length>512||!/^https:\/\/(chatgpt\.com|claude\.ai)\/oauth\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(value))return false;
  try{return new URL(value).href===value;}catch{return false;}
}
const nativeId='https://claude.ai/oauth/claude-code-client-metadata';
const cache=new Map(),pending=new Map();
const fail=()=>new HttpError(503,'The published client document or keys are unavailable or unsupported. Retry later or use automatic registration.');
function loopback(value){
  if(typeof value!=='string'||value.length>2048||/[\u0000-\u0020\u007f*#]/.test(value)||!/^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?\//i.test(value))return null;
  try{const u=new URL(value);return u.protocol==='http:'&&u.port!=='0'&&!u.username&&!u.password&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)?u:null;}catch{return null;}
}
export function matchesRedirect(client,value){
  if(client.redirect_uris.includes(value))return true;
  if(!client.allowLoopback)return false;
  const request=loopback(value);return !!request&&client.redirect_uris.some(uri=>{const declared=loopback(uri);return declared&&declared.hostname===request.hostname&&declared.pathname===request.pathname&&declared.search===request.search;});
}
function lifetime(headers){
  const control=headers.get('Cache-Control')||'';
  if(/(?:no-store|no-cache|private)/i.test(control)||headers.get('Vary')==='*')return 0;
  const age=Math.max(0,Number(headers.get('Age'))||0),max=control.match(/(?:^|,)\s*max-age\s*=\s*"?(\d+)/i);
  const seconds=max?+max[1]-age:headers.has('Expires')?(Date.parse(headers.get('Expires'))-Date.parse(headers.get('Date')||new Date().toUTCString()))/1000-age:60;
  return Math.max(0,Math.min(300,Number.isFinite(seconds)?seconds:0))*1000;
}
async function readDocument(url,validate,force=false,kind='client'){
  if(!publishedURL(url))throw fail();
  const key=kind+':'+url,previous=cache.get(key),time=Date.now();
  if(previous&&previous.expires>time&&(!force||time-previous.fetched<5000))return previous.value;
  if(pending.has(key))return pending.get(key);
  if(pending.size>=16)throw fail();
  const request=fetchDocument(url,validate,key);pending.set(key,request);
  try{return await request;}finally{pending.delete(key);}
}
async function fetchDocument(url,validate,key){
  let response;
  try{response=await fetch(url,{redirect:'manual',headers:{Accept:'application/json'},signal:AbortSignal.timeout(3000)});}catch{throw fail();}
  if(response.status!==200||response.url&&response.url!==url||!/^application\/(?:[A-Za-z0-9.+-]+\+)?json\s*(?:;|$)/i.test(response.headers.get('Content-Type')||'')){await response.body?.cancel();throw fail();}
  const reader=response.body?.getReader();if(!reader)throw fail();let text='',size=0;const decoder=new TextDecoder('utf-8',{fatal:true});
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();throw fail();}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}catch{throw fail();}
  let value;try{value=validate(JSON.parse(text));}catch{throw fail();}
  const ttl=lifetime(response.headers);
  if(ttl){cache.delete(key);if(cache.size>=32)cache.delete(cache.keys().next().value);cache.set(key,{value,fetched:Date.now(),expires:Date.now()+ttl});}
  else cache.delete(key);
  return value;
}
function array(value,fallback,allowed){
  const selected=value===undefined?fallback:value;
  if(!Array.isArray(selected)||!selected.length||new Set(selected).size!==selected.length||selected.some(v=>!allowed.includes(v)))throw fail();
  return selected;
}
export function publicKeys(value){
  if(!value||!Array.isArray(value.keys)||!value.keys.length||value.keys.length>16)throw fail();const ids=new Set();
  for(const k of value.keys){
    if(!k||typeof k!=='object'||typeof k.kid!=='string'||!k.kid||k.kid.length>128||ids.has(k.kid)||['d','p','q','dp','dq','qi','oth','k'].some(field=>field in k))throw fail();
    ids.add(k.kid);
  }
  return value;
}
export async function publishedClient(id){
  if(!publishedURL(id))return null;
  return readDocument(id,data=>{
    if(!data||data.client_id!==id||typeof data.client_name!=='string'||!data.client_name.trim()||data.client_name.length>120||/[\u0000-\u001f\u007f]/.test(data.client_name)||'client_secret'in data||'client_secret_expires_at'in data)throw fail();
    const allowLoopback=id===nativeId;
    if(!Array.isArray(data.redirect_uris)||!data.redirect_uris.length||data.redirect_uris.length>16||new Set(data.redirect_uris).size!==data.redirect_uris.length||data.redirect_uris.some(r=>!(validRedirect(r)||(allowLoopback&&loopback(r)))))throw fail();
    const legacy=data.token_endpoint_auth_method,forbidden=['client_secret_post','client_secret_basic','client_secret_jwt'];
    if(legacy!==undefined&&(typeof legacy!=='string'||forbidden.includes(legacy)))throw fail();
    const advertised=data.token_endpoint_auth_methods_supported===undefined?(legacy===undefined?['none']:[legacy]):data.token_endpoint_auth_methods_supported;
    if(!Array.isArray(advertised)||!advertised.length||advertised.length>8||new Set(advertised).size!==advertised.length||advertised.some(m=>typeof m!=='string'||m.length>100||forbidden.includes(m)))throw fail();
    const methods=advertised.filter(m=>['none','private_key_jwt'].includes(m));if(!methods.length)throw fail();
    const grant_types=array(data.grant_types,['authorization_code'],['authorization_code','refresh_token']);
    if(!grant_types.includes('authorization_code'))throw fail();array(data.response_types,['code'],['code']);
    const client={client_id:id,client_name:data.client_name,redirect_uris:data.redirect_uris,grant_types,scope:parseScopes(data.scope===undefined?scopes.join(' '):data.scope),token_endpoint_auth_method:methods[0],authMethods:methods,registration:'published',publisher:new URL(id).hostname,allowLoopback};
    if(data.token_endpoint_auth_signing_alg!==undefined&&!['RS256','ES256'].includes(data.token_endpoint_auth_signing_alg))throw fail();
    client.signingAlg=data.token_endpoint_auth_signing_alg;
    if(methods.includes('private_key_jwt')){
      if(!!data.jwks===!!data.jwks_uri)throw fail();
      if(data.jwks)client.jwks=publicKeys(data.jwks);
      else{if(!publishedURL(data.jwks_uri)||new URL(data.jwks_uri).origin!==new URL(id).origin)throw fail();client.jwks_uri=data.jwks_uri;}
    }
    return client;
  });
}
export async function signingKeys(client,force=false){if(force&&!cache.has('keys:'+client.jwks_uri))throw fail();return client.jwks||readDocument(client.jwks_uri,publicKeys,force,'keys');}
