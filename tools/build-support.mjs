import path from 'node:path';
import { access, lstat, rm, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
export const root=fileURLToPath(new URL('../',import.meta.url));
export async function loadEnvironment(app) {
  const file=path.join(root,'apps',app,'.env');
  try {await access(file);process.loadEnvFile(file);}catch(error){if(error.code!=='ENOENT')throw error;}
}
// Both frontend builds use the same two addresses. Paths come from the URLs.
export function readDeploymentConfig(env = process.env, app = 'site') {
  const pathPattern = /^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\/?$/;
  const basePath = (value, key) => {
    const raw = (value || '').trim();
    if (raw && raw !== '/' && !pathPattern.test(raw))
      throw Error(`${key} must be a simple subdirectory path`);
    return raw.replace(/\/$/, '');
  };
  const address = (value, key) => {
    let url;
    try { url = new URL(value); } catch { throw Error(`${key} must be a full HTTP(S) URL`); }
    if (!/^https?:\/\//i.test(value) || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || /[?#]/.test(value))
      throw Error(`${key} must be a public HTTP(S) URL without credentials, query or fragment`);
    // Check the original path too: URL parsing would silently remove /../.
    const rawPath = value.match(/^https?:\/\/[^/?#]+(.*)$/i)?.[1] || '/';
    const path = basePath(rawPath, key);
    url.pathname = path + '/';
    return { url: url.href, origin: url.origin, basePath: path };
  };
  // Old launch/home settings were links, so retain their query/path semantics.
  const legacyLink = (value, key) => {
    let url;
    try { url = new URL(value); } catch { throw Error(`${key} must be an absolute URL`); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      throw Error(`${key} must be a public HTTP(S) URL without credentials`);
    return { url: url.href, origin: url.origin, basePath: '' };
  };
  const siteUrl = (env.SITE_URL || '').trim();
  const studioUrl = (env.STUDIO_URL || '').trim();
  let site, studio;
  if (siteUrl) site = address(siteUrl, 'SITE_URL');
  else if (app === 'site') {
    const origin = (env.PUBLIC_SITE_URL || '').trim();
    const legacySite = address(origin || 'http://127.0.0.1:8787/', 'PUBLIC_SITE_URL');
    if (origin && legacySite.basePath)
      throw Error('PUBLIC_SITE_URL must be an origin; use SITE_URL for a full address');
    site = address(legacySite.origin + basePath(env.PUBLIC_BASE_PATH, 'PUBLIC_BASE_PATH') + '/', 'PUBLIC_SITE_URL');
  } else site = legacyLink((env.EDITOR_PUBLIC_SITE_URL || 'http://127.0.0.1:8787/').trim(), 'EDITOR_PUBLIC_SITE_URL');
  if (studioUrl) studio = address(studioUrl, 'STUDIO_URL');
  else if (app === 'site') studio = legacyLink((env.PUBLIC_EDITOR_URL || 'http://127.0.0.1:8788/').trim(), 'PUBLIC_EDITOR_URL');
  else studio = address('http://127.0.0.1:8788' + basePath(env.EDITOR_BASE_PATH, 'EDITOR_BASE_PATH') + '/', 'EDITOR_BASE_PATH');
  return { site, studio, siteConfigured: Boolean(siteUrl || (app === 'site' && (env.PUBLIC_SITE_URL || '').trim())) };
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
