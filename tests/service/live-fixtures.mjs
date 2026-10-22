import {site,client} from './harness.mjs';
import assert from 'node:assert/strict';
import {random,hash,now} from '../../packages/service/security.mjs';
const post=(value,cookie)=>({method:'POST',headers:{Origin:site,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(value)});
export async function liveGrant(h,account,scope='account:read scene:read scene:write scene:control') {
 const id=random(),access=random();await h.db.prepare('INSERT INTO grants VALUES (?, ?, ?, ?, ?, ?, ?, NULL)').bind(id,account.id,client.client_id,'Test agent',scope,now(),now()+3600).run();await h.db.prepare('INSERT INTO tokens VALUES (?, ?, ?, ?)').bind(await hash(access),id,'access',now()+600).run();return {id,access};
}
export async function registeredLiveGrant(h,account){
 const metadata=await h.request('/oauth/register',post({client_name:'Test agent',redirect_uris:['https://agent.example/callback'],token_endpoint_auth_method:'client_secret_post',grant_types:['authorization_code','refresh_token']}));assert.equal(metadata.status,201);const registered=await metadata.json();
 const verifier=random(),query=new URLSearchParams({client_id:registered.client_id,redirect_uri:registered.redirect_uris[0],response_type:'code',code_challenge_method:'S256',code_challenge:await hash(verifier),resource:site+'/mcp',scope:'account:read scene:read scene:write scene:control',state:'live-registration-test'});
 const consent=await h.request('/api/oauth/consent',post({query:query.toString(),approved:true},account.cookie));assert.equal(consent.status,200);const code=new URL((await consent.json()).redirect).searchParams.get('code');
 const token=await h.request('/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:registered.client_id,client_secret:registered.client_secret,grant_type:'authorization_code',redirect_uri:registered.redirect_uris[0],resource:site+'/mcp',code,code_verifier:verifier}).toString()});assert.equal(token.status,200);const tokens=await token.json();
 const grant=await h.db.prepare('SELECT id FROM grants WHERE client_id = ? AND account_id = ?').bind(registered.client_id,account.id).first();return {id:grant.id,access:tokens.access_token};
}
export const rpc=async(h,grant,name,args={})=>{
 const r=await h.request('/mcp',{method:'POST',headers:{Authorization:'Bearer '+grant.access,Accept:'application/json, text/event-stream','Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})});return r.json();
};
export const pair=async(h,account,grant,permissions=['scene:read','scene:write','scene:control'])=>{
 const r=await h.request('/api/live',post({grantId:grant.id,projectId:'project-a',artboardId:'board-a',label:'Live test',duration:900,permissions},account.cookie));return {response:r,...await r.json()};
};
export const socket=async(h,account,p,changes={})=>h.request(`/api/live/${p.sessionId}/socket`,{headers:{Cookie:account.cookie,Origin:site,Upgrade:'websocket','Sec-WebSocket-Protocol':`evir-live, ${p.key}`,...changes}});
