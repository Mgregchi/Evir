import {HttpError,now,random,hash,json,body,sameOrigin,session,origin,limit} from './security.mjs';
import {permits} from './oauth.mjs';
export const livePermissions=['scene:read','scene:write','scene:control'];
export const toolPermission=name=>['apply_scene_patch'].includes(name)?'scene:write':['expose_controls','play_animation','set_input','set_control'].includes(name)?'scene:control':'scene:read';
export async function activeSession(env,id,grantId) {
  if(typeof id!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(id))throw new HttpError(400,'Choose a valid shared Studio session.');
  const row=await env.DB.prepare('SELECT l.* FROM live_sessions l JOIN grants g ON g.id = l.grant_id WHERE l.id = ? AND l.revoked_at IS NULL AND l.expires_at > ? AND g.revoked_at IS NULL AND g.expires_at > ?').bind(id,now(),now()).first();
  if(!row||grantId&&row.grant_id!==grantId)throw new HttpError(403,'This live session is unavailable or not shared with this connection.');
  return row;
}
export const broker=(env,id)=>env.LIVE_SESSIONS.get(env.LIVE_SESSIONS.idFromName(id));
export async function closeLive(env,id) {
  await env.DB.prepare('UPDATE live_sessions SET revoked_at = ? WHERE id = ?').bind(now(),id).run();
  // D1 revocation is authoritative even if transport shutdown cannot be signalled.
  if(env.LIVE_SESSIONS)try{await broker(env,id).fetch('https://live.internal/stop');}catch{}
}
export async function closeGrants(env,accountId,grantId) {
  const rows=(await env.DB.prepare('SELECT id FROM live_sessions WHERE account_id = ? AND revoked_at IS NULL'+(grantId?' AND grant_id = ?':'')).bind(...(grantId?[accountId,grantId]:[accountId])).all()).results;
  await Promise.all(rows.map(row=>closeLive(env,row.id)));
}
export async function liveApi(req,env,path) {
  if(req.method==='POST')sameOrigin(req,env);
  const owner=await session(req,env);
  if(!env.LIVE_SESSIONS)throw new HttpError(503,'Live pairing is not configured on this deployment.');
  if(path==='/api/live/connections'&&req.method==='GET') {
    const rows=(await env.DB.prepare('SELECT id,client_name,scope FROM grants WHERE account_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 100').bind(owner.account_id,now()).all()).results;
    return json({connections:rows.filter(g=>permits(g,'scene:read')).map(g=>({id:g.id,name:g.client_name,permissions:livePermissions.filter(p=>permits(g,p))}))});
  }
  if(path==='/api/live'&&req.method==='POST') {
    await limit(req,env,'pair',30);const data=await body(req);
    for(const key of ['projectId','artboardId','label','grantId'])if(typeof data[key]!=='string'||!data[key]||data[key].length>160)throw new HttpError(400,'Choose a project, artboard and connection.');
    if(!Array.isArray(data.permissions)||!data.permissions.includes('scene:read')||new Set(data.permissions).size!==data.permissions.length||data.permissions.some(p=>!livePermissions.includes(p)))throw new HttpError(400,'Choose supported session permissions.');
    if(![900,3600].includes(data.duration))throw new HttpError(400,'Choose a fifteen-minute or one-hour session.');
    const grant=await env.DB.prepare('SELECT * FROM grants WHERE id = ? AND account_id = ? AND revoked_at IS NULL AND expires_at > ?').bind(data.grantId,owner.account_id,now()).first();
    if(!grant||data.permissions.some(p=>!permits(grant,p)))throw new HttpError(403,'Reconnect the agent with the required scene permissions first.');
    const id=random(),key=random(),expires=Math.min(now()+data.duration,owner.expires_at,grant.expires_at);
    const result=await env.DB.prepare('INSERT INTO live_sessions SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL WHERE (SELECT COUNT(*) FROM live_sessions WHERE account_id = ? AND revoked_at IS NULL AND expires_at > ?) < 3').bind(id,owner.account_id,grant.id,data.projectId,data.artboardId,data.label,JSON.stringify(data.permissions),await hash(key),expires,owner.account_id,now()).run();
    if(!result.meta.changes)throw new HttpError(409,'Stop an existing live session before opening another (maximum three).');
    return json({sessionId:id,key,expiresAt:expires,permissions:data.permissions});
  }
  const match=path.match(/^\/api\/live\/([A-Za-z0-9_-]{43})\/(socket|stop)$/);
  if(!match)throw new HttpError(404,'Not found.');
  const [,id,action]=match;
  if(action==='stop'&&req.method==='POST'){
    const row=await env.DB.prepare('SELECT account_id FROM live_sessions WHERE id = ?').bind(id).first();
    if(!row||row.account_id!==owner.account_id)throw new HttpError(403,'This session belongs to another account.');
    await closeLive(env,id);return json({ok:true});
  }
  if(action==='socket'&&req.method==='GET') {
    if(req.headers.get('Origin')!==origin(env)||req.headers.get('Upgrade')?.toLowerCase()!=='websocket')throw new HttpError(403,'Open the Studio connection on the Evir origin.');
    const row=await activeSession(env,id);const protocols=(req.headers.get('Sec-WebSocket-Protocol')||'').split(',').map(s=>s.trim());
    if(row.account_id!==owner.account_id||protocols.length!==2||protocols[0]!=='evir-live'||await hash(protocols[1])!==row.owner_hash)throw new HttpError(403,'This browser tab does not own the session.');
    return broker(env,id).fetch(new Request('https://live.internal/connect',{headers:{Upgrade:'websocket','Sec-WebSocket-Protocol':'evir-live','X-Evir-Session':id}}));
  }
  throw new HttpError(405,'Unsupported live-session action.');
}
export async function routeLiveTool(env,grant,name,args) {
  if(!permits(grant,toolPermission(name)))throw new HttpError(403,'Reconnect the agent with the required OAuth scene permission.');
  if(name==='list_live_sessions') {
    return {sessions:(await env.DB.prepare('SELECT id AS sessionId, project_id AS projectId, artboard_id AS artboardId, label, permissions, expires_at AS expiresAt FROM live_sessions WHERE grant_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY expires_at DESC LIMIT 3').bind(grant.id,now()).all()).results.map(r=>({...r,permissions:JSON.parse(r.permissions)}))};
  }
  const row=await activeSession(env,args.sessionId,grant.id);
  if(!JSON.parse(row.permissions).includes(toolPermission(name)))throw new HttpError(403,'This Studio session did not grant that permission.');
  if(name==='stop_session'){await closeLive(env,row.id);return {ok:true,stopped:true};}
  if(args.context&&(args.context.sessionId!==row.id||args.context.projectId!==row.project_id||args.context.artboardId!==row.artboard_id))throw new HttpError(403,'Command context does not match the shared project and artboard.');
  const result=await broker(env,row.id).fetch('https://live.internal/call',{method:'POST',body:JSON.stringify({sessionId:row.id,grantId:grant.id,name,args})});
  return result.json();
}
