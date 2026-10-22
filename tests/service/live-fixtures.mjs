import {site,client} from './harness.mjs';
import {random,hash,now} from '../../packages/service/security.mjs';
const post=(value,cookie)=>({method:'POST',headers:{Origin:site,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(value)});
export async function liveGrant(h,account,scope='account:read scene:read scene:write scene:control') {
 const id=random(),access=random();await h.db.prepare('INSERT INTO grants VALUES (?, ?, ?, ?, ?, ?, ?, NULL)').bind(id,account.id,client.client_id,'Test agent',scope,now(),now()+3600).run();await h.db.prepare('INSERT INTO tokens VALUES (?, ?, ?, ?)').bind(await hash(access),id,'access',now()+600).run();return {id,access};
}
export const rpc=async(h,grant,name,args={})=>{
 const r=await h.request('/mcp',{method:'POST',headers:{Authorization:'Bearer '+grant.access,Accept:'application/json, text/event-stream','Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})});return r.json();
};
export const pair=async(h,account,grant,permissions=['scene:read','scene:write','scene:control'])=>{
 const r=await h.request('/api/live',post({grantId:grant.id,projectId:'project-a',artboardId:'board-a',label:'Live test',duration:900,permissions},account.cookie));return {response:r,...await r.json()};
};
export const socket=async(h,account,p,changes={})=>h.request(`/api/live/${p.sessionId}/socket`,{headers:{Cookie:account.cookie,Origin:site,Upgrade:'websocket','Sec-WebSocket-Protocol':`evir-live, ${p.key}`,...changes}});
