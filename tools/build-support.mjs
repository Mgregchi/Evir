import path from 'node:path';
import { access, lstat, rm, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
export const root=fileURLToPath(new URL('../',import.meta.url));
export async function loadEnvironment(app) {
  const file=path.join(root,'apps',app,'.env');
  try {await access(file);process.loadEnvFile(file);}catch(error){if(error.code!=='ENOENT')throw error;}
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
