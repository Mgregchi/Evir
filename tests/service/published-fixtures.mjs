import assert from 'node:assert/strict';
import {createFetchMock} from 'miniflare';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {site,callback,authQuery} from './harness.mjs';
import {random,hash,now} from '../../packages/service/security.mjs';
export const clientId='https://chatgpt.com/oauth/evir-test/client.json';
export const keyURL='https://chatgpt.com/oauth/jwks.json';
export function publisher(){const mock=createFetchMock();mock.disableNetConnect();return mock;}
export function route(mock,url,handler){const u=new URL(url);return mock.get(u.origin).intercept({path:u.pathname,method:'GET'}).reply(options=>{
  const result=handler(options);return {statusCode:result.status||200,data:typeof result.data==='string'?result.data:JSON.stringify(result.data),responseOptions:{headers:{'content-type':'application/json','cache-control':'max-age=60',...result.headers}}};
}).persist();}
export const document=(extra={})=>({client_id:clientId,client_name:'Published test connector',redirect_uris:[callback],grant_types:['authorization_code','refresh_token'],token_endpoint_auth_method:'none',...extra});
export async function keys(alg='ES256',kid='key-a'){
  const pair=await generateKeyPair(alg,{extractable:true}),jwk={...await exportJWK(pair.publicKey),kid,alg,use:'sig'};return {...pair,jwk,alg,kid};
}
export const form=params=>({method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params).toString()});
export const post=(data,cookie)=>({method:'POST',headers:{'Content-Type':'application/json',Origin:site,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});
export async function codeFor(h,owner,id=clientId,redirect=callback,scope='account:read'){
  const verifier=random(),query=authQuery(await hash(verifier));query.set('client_id',id);query.set('redirect_uri',redirect);query.set('scope',scope);
  const r=await h.request('/api/oauth/consent',post({query:query.toString(),approved:true},owner.cookie));assert.equal(r.status,200,await r.clone().text());
  return {query,verifier,code:new URL((await r.json()).redirect).searchParams.get('code'),redirect};
}
export async function assertion(key,claims={},header={}){
  const value={iss:clientId,sub:clientId,aud:site+'/oauth/token',iat:now(),exp:now()+180,jti:random(),...claims};
  return new SignJWT(value).setProtectedHeader({alg:key.alg,kid:key.kid,typ:'JWT',...header}).sign(key.privateKey);
}
export const exchange=(c,proof,id=clientId)=>({client_id:id,resource:site+'/mcp',grant_type:'authorization_code',code:c.code,code_verifier:c.verifier,redirect_uri:c.redirect,...(proof?{client_assertion_type:'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',client_assertion:proof}:{})});
