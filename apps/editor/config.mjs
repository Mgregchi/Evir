export function readEditorConfig(env = process.env) {
  const rawBase=(env.EDITOR_BASE_PATH||'').trim();
  if(rawBase && rawBase!=='/' && !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\/?$/.test(rawBase)) throw Error('EDITOR_BASE_PATH must be a simple subdirectory path');
  const url = new URL(env.EDITOR_PUBLIC_SITE_URL || 'http://127.0.0.1:8787/');
  if(!['http:','https:'].includes(url.protocol) || url.username || url.password) throw Error('EDITOR_PUBLIC_SITE_URL must be a public HTTP(S) URL without credentials');
  return {basePath:rawBase.replace(/\/$/,'')||'',publicSiteUrl:url.href};
}
