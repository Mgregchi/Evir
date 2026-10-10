import path from 'node:path';
import { access, lstat, rm, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
export const root=fileURLToPath(new URL('../',import.meta.url));
export async function loadEnvironment(app) {
  const file=path.join(root,'apps',app,'.env');
  try {await access(file);process.loadEnvFile(file);}catch(error){if(error.code!=='ENOENT')throw error;}
}
// Hosting has one address. Studio is always a route within the web app.
export function readSiteAddress(env = process.env) {
  const pathPattern = /^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\/?$/;
  const basePath = (value, key) => {
    const raw = (value || '').trim();
    if (raw && raw !== '/' && !pathPattern.test(raw))
      throw Error(`${key} must be a simple subdirectory path`);
    return raw.replace(/\/$/, '');
  };
  const current = (env.SITE_URL || '').trim();
  const legacy = (env.PUBLIC_SITE_URL || '').trim();
  const value = current || legacy || 'http://127.0.0.1:8787/';
  let url;
  try { url = new URL(value); } catch { throw Error('SITE_URL must be a full HTTP(S) URL'); }
  if (!/^https?:\/\//i.test(value) || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || /[?#]/.test(value))
    throw Error('SITE_URL must be a public HTTP(S) URL without credentials, query or fragment');
  const rawPath = value.match(/^https?:\/\/[^/?#]+(.*)$/i)?.[1] || '/';
  let mount = basePath(rawPath, 'SITE_URL');
  if (!current) {
    if (legacy && mount) throw Error('PUBLIC_SITE_URL must be an origin; use SITE_URL for a full address');
    mount = basePath(env.PUBLIC_BASE_PATH, 'PUBLIC_BASE_PATH');
  }
  return { origin: url.origin, basePath: mount, configured: Boolean(current || legacy) };
}
export async function prepareOutput(app, key) {
  const appRoot=path.join(root,'apps',app),normal=path.join(appRoot,'dist'),test=path.join(appRoot,'.test-build');
  const out=path.resolve(root,process.env[key]||normal);
  if(out!==normal && !out.startsWith(test+path.sep)) throw Error(`${key} must be apps/${app}/dist or inside apps/${app}/.test-build/`);
  for(const dir of [appRoot,test,out]) {
    try {if((await lstat(dir)).isSymbolicLink())throw Error('Build paths must not be symbolic links');}
    catch(error){if(error.code!=='ENOENT')throw error;}
  }
  await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});return out;
}
