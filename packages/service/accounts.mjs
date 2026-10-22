import {closeGrants} from './live.mjs';
import {HttpError, now, random, hash, json, body, session, sameOrigin, newSession, cookie, setCookie, limit} from './security.mjs';
export function fresh(s) { if(s.expires_at - 604800 < now()-300)throw new HttpError(401,'Sign in again before changing account security.'); }
export async function accounts(req,env,path) {
  if(req.method==='POST')sameOrigin(req,env);
  if(path==='/api/account/recover'&&req.method==='POST') {
    await limit(req,env,'recovery',10);const data=await body(req);if(typeof data.code!=='string'||data.code.length>100)throw new HttpError(400,'Enter a recovery code.');
    const c=await env.DB.prepare('DELETE FROM recovery_codes WHERE token_hash = ? RETURNING account_id').bind(await hash(data.code.trim())).first();
    if(!c)throw new HttpError(400,'Recovery code is invalid or already used.');
    await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE account_id = ?').bind(c.account_id),env.DB.prepare('UPDATE grants SET revoked_at = ? WHERE account_id = ?').bind(now(),c.account_id)]);
    await closeGrants(env,c.account_id);
    return json({ok:true},200,{'Set-Cookie':await newSession(env,c.account_id)});
  }
  const s=await session(req,env);
  if(path==='/api/account'&&req.method==='GET') {
    const credentials=(await env.DB.prepare('SELECT id, label, created_at FROM credentials WHERE account_id = ? ORDER BY created_at').bind(s.account_id).all()).results;
    const connections=(await env.DB.prepare('SELECT id, client_name, scope, created_at, expires_at FROM grants WHERE account_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY created_at DESC').bind(s.account_id,now()).all()).results;
    const recovery=await env.DB.prepare('SELECT COUNT(*) AS count FROM recovery_codes WHERE account_id = ?').bind(s.account_id).first();
    return json({accountId:s.account_id,credentials,connections,recoveryCodesRemaining:recovery.count,sessionExpiresAt:s.expires_at});
  }
  if(req.method!=='POST')throw new HttpError(404,'Not found.');
  if(path==='/api/account/logout') {
    await closeGrants(env,s.account_id);
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await hash(cookie(req,'__Host-evir-session'))).run();
    return json({ok:true},200,{'Set-Cookie':setCookie('__Host-evir-session','',0)});
  }
  if(path==='/api/account/revoke') {
    const data=await body(req);if(typeof data.id!=='string')throw new HttpError(400,'Choose a connection.');
    await env.DB.prepare('UPDATE grants SET revoked_at = ? WHERE id = ? AND account_id = ?').bind(now(),data.id,s.account_id).run();await closeGrants(env,s.account_id,data.id);return json({ok:true});
  }
  fresh(s);
  if(path==='/api/account/recovery-codes') {
    const codes=Array.from({length:8},random);
    await env.DB.batch([env.DB.prepare('DELETE FROM recovery_codes WHERE account_id = ?').bind(s.account_id),...await Promise.all(codes.map(async c=>env.DB.prepare('INSERT INTO recovery_codes VALUES (?, ?)').bind(await hash(c),s.account_id)))]);
    return json({codes});
  }
  if(path==='/api/account/remove-passkey') {
    const data=await body(req);if(typeof data.id!=='string')throw new HttpError(400,'Choose a passkey.');
    const deleted=await env.DB.prepare('DELETE FROM credentials WHERE id = ? AND account_id = ? AND (SELECT COUNT(*) FROM credentials WHERE account_id = ?) > 1').bind(data.id,s.account_id,s.account_id).run();
    if(!deleted.meta.changes)throw new HttpError(400,'Add another passkey before removing this one.');return json({ok:true});
  }
  throw new HttpError(404,'Not found.');
}
