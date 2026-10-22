export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const now = () => Math.floor(Date.now() / 1000);
export const bytes = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
export const base64 = b => btoa(String.fromCharCode(...b)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
export const random = () => base64(crypto.getRandomValues(new Uint8Array(32)));
export const hash = async s => base64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))));
export const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {status, headers: {'Content-Type': 'application/json', ...headers}});
export function origin(env) {
  let u;try{u=new URL(env.SITE_URL || 'https://evir.idey.click/');}catch{throw new HttpError(503,'Set a valid HTTPS SITE_URL in Worker runtime variables.');}
  if (u.protocol !== 'https:' || u.username || u.password || u.pathname !== '/' || u.search || u.hash) throw new HttpError(503, 'Account hosting requires an HTTPS root-domain SITE_URL.');
  return u.origin;
}
export function sameOrigin(req, env) {
  if (req.headers.get('Origin') !== origin(env)) throw new HttpError(403, 'Open this action from the Evir account page.');
}
export function cookie(req, name) {
  return (req.headers.get('Cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith(name + '='))?.slice(name.length + 1) || '';
}
export const setCookie = (name, value, age) => `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;
export async function raw(req, max = 32768) {
  if (+req.headers.get('Content-Length') > max) throw new HttpError(413, 'Request is too large.');
  const reader = req.body?.getReader(); if (!reader) throw new HttpError(400, 'A request body is required.');
  const chunks = []; let length = 0;
  while (true) { const {done, value} = await reader.read(); if (done) break; length += value.length; if (length > max) { await reader.cancel(); throw new HttpError(413, 'Request is too large.'); } chunks.push(value); }
  const all = new Uint8Array(length); let offset = 0; for (const c of chunks) { all.set(c, offset); offset += c.length; }
  return new TextDecoder().decode(all);
}
export async function body(req, max = 32768) {
  try { const value=JSON.parse(await raw(req,max));if(!value||typeof value!=='object'||Array.isArray(value))throw new HttpError(400,'Expected a JSON object.');return value; } catch (e) { if(e instanceof HttpError) throw e; throw new HttpError(400, 'Expected JSON.'); }
}
export async function session(req, env, required = true) {
  const token = cookie(req, '__Host-evir-session');
  const row = token ? await env.DB.prepare('SELECT account_id, expires_at FROM sessions WHERE token_hash = ? AND expires_at > ?').bind(await hash(token), now()).first() : null;
  if (!row && required) throw new HttpError(401, 'Sign in with a passkey to continue.');
  return row;
}
export async function newSession(env, accountId) {
  const token = random(); await env.DB.prepare('INSERT INTO sessions VALUES (?, ?, ?)').bind(await hash(token), accountId, now() + 604800).run();
  return setCookie('__Host-evir-session', token, 604800);
}
export async function limit(req, env, bucket, max = 30) {
  // Fixed ten-minute windows. No raw IP addresses are stored.
  const window = Math.floor(now() / 600);
  const id = await hash(`${bucket}:${req.headers.get('CF-Connecting-IP') || 'unknown'}:${window}`);
  const row = await env.DB.prepare('INSERT INTO rate_limits VALUES (?, 1, ?) ON CONFLICT(id) DO UPDATE SET count = count + 1 RETURNING count').bind(id, (window + 1) * 600).first();
  if (row.count > max) throw new HttpError(429, 'Too many attempts. Please try again in a few minutes.');
}
export async function cleanup(env) {
  const t = now();
  await env.DB.batch([...['sessions', 'challenges', 'codes', 'tokens', 'rate_limits', 'live_sessions'].map(table => env.DB.prepare(`DELETE FROM ${table} WHERE expires_at <= ?`).bind(t)), env.DB.prepare('DELETE FROM grants WHERE expires_at <= ?').bind(t)]);
}
export function secure(response) {
  const r = new Response(response.body, response);
  for (const [k, v] of Object.entries({'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'", 'Strict-Transport-Security': 'max-age=31536000', 'X-Robots-Tag': 'noindex'})) r.headers.set(k,v);
  return r;
}
