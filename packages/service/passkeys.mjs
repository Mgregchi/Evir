import {fresh} from './accounts.mjs';
import {generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse} from '@simplewebauthn/server';
import {HttpError, now, random, hash, base64, bytes, cookie, setCookie, json, body, origin, sameOrigin, session, newSession, limit} from './security.mjs';
export async function passkeys(req, env, path) {
  sameOrigin(req, env); await limit(req, env, 'passkey');
  const rpID = new URL(origin(env)).hostname;
  if (path.endsWith('/options')) {
    const registering = path.includes('/register/'); const current = await session(req, env, false);
    const accountId = current?.account_id || random();
    let options;
    if (registering) {
      if(current)fresh(current);
      const rows = (await env.DB.prepare('SELECT id, transports FROM credentials WHERE account_id = ?').bind(accountId).all()).results;
      if (rows.length >= 10) throw new HttpError(400, 'This account already has ten passkeys.');
      options = await generateRegistrationOptions({rpName: 'Evir', rpID, userName: `Evir ${accountId.slice(0, 8)}`, userID: bytes(accountId), attestationType: 'none', authenticatorSelection: {residentKey: 'required', userVerification: 'required'}, excludeCredentials: rows.map(r => ({id:r.id,transports:JSON.parse(r.transports)}))});
    } else options = await generateAuthenticationOptions({rpID, userVerification: 'required'});
    const token = random();
    await env.DB.prepare('INSERT INTO challenges VALUES (?, ?, ?, ?, ?)').bind(await hash(token), options.challenge, registering ? 'register' : 'login', accountId, now()+300).run();
    return json(options,200,{'Set-Cookie':setCookie('__Host-evir-challenge',token,300)});
  }
  const registering = path.includes('/register/');
  const value = await body(req); const token = cookie(req,'__Host-evir-challenge');
  // Consume the challenge atomically before verification, including failed ceremonies.
  const challenge = await env.DB.prepare('DELETE FROM challenges WHERE token_hash = ? RETURNING *').bind(await hash(token)).first();
  if (!challenge || challenge.expires_at <= now() || challenge.kind !== (registering?'register':'login')) throw new HttpError(400,'This passkey request expired. Please start again.');
  let accountId;
  try {
    if (registering) {
      const current = await session(req,env,false);
      const existing = await env.DB.prepare('SELECT id FROM accounts WHERE id = ?').bind(challenge.account_id).first();
      if(current)fresh(current);
      if (current && current.account_id !== challenge.account_id || existing && current?.account_id !== existing.id) throw Error('Sign-in changed during registration.');
      const result = await verifyRegistrationResponse({response:value,expectedChallenge:challenge.challenge,expectedOrigin:origin(env),expectedRPID:rpID,requireUserVerification:true});
      if (!result.verified || !result.registrationInfo) throw Error('Not verified');
      const c = result.registrationInfo.credential; accountId = challenge.account_id;
      await env.DB.batch([
        env.DB.prepare('INSERT OR IGNORE INTO accounts VALUES (?, ?)').bind(accountId,now()),
        env.DB.prepare('INSERT INTO credentials VALUES (?, ?, ?, ?, ?, ?, ?)').bind(c.id,accountId,base64(c.publicKey),c.counter,JSON.stringify(c.transports || []),'Passkey',now()),
      ]);
    } else {
      const c = await env.DB.prepare('SELECT * FROM credentials WHERE id = ?').bind(value.id || '').first();
      if (!c) throw Error('Not verified');
      const result = await verifyAuthenticationResponse({response:value,expectedChallenge:challenge.challenge,expectedOrigin:origin(env),expectedRPID:rpID,requireUserVerification:true,credential:{id:c.id,publicKey:bytes(c.public_key),counter:c.counter,transports:JSON.parse(c.transports)}});
      if (!result.verified) throw Error('Not verified');
      // Compare-and-swap prevents overlapping ceremonies from rolling the counter back.
      const update = await env.DB.prepare('UPDATE credentials SET counter = ? WHERE id = ? AND counter = ?').bind(result.authenticationInfo.newCounter,c.id,c.counter).run();
      if (update.meta.changes !== 1) throw Error('Concurrent authentication; retry');
      accountId = c.account_id;
    }
  } catch { throw new HttpError(400,'Passkey verification failed. Please start again.'); }
  const response=json({ok:true},200,{'Set-Cookie':await newSession(env,accountId)});
  response.headers.append('Set-Cookie',setCookie('__Host-evir-challenge','',0)); return response;
}
