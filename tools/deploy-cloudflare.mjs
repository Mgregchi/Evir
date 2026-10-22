// Invoked by Cloudflare Workers Builds, never required on the owner's computer.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
export function deployConfig(base,env,root) {
  if(Object.hasOwn(base,'vars')||Object.hasOwn(base,'env'))throw Error('Runtime variables belong to the Cloudflare dashboard; remove vars/env value overrides from repository configuration.');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(env.D1_DATABASE_ID||''))throw Error('Set D1_DATABASE_ID in Cloudflare Build variables to your existing D1 database UUID. No database is created automatically.');
  if(env.WORKERS_CI_BRANCH&&env.WORKERS_CI_BRANCH!=='main')throw Error('Production migrations run only from main. Disable non-production builds, or configure an isolated preview Worker and database.');
  return {...base,main:path.join(root,'apps/web/worker.mjs'),assets:{...base.assets,directory:path.join(root,'apps/web/dist')},d1_databases:[{binding:'DB',database_name:'evir-accounts',database_id:env.D1_DATABASE_ID,migrations_dir:path.join(root,'packages/service/migrations')}],keep_vars:true};
}
export function deploySteps(configPath) {
  return [['d1','migrations','apply','DB','--remote','--config',configPath],['deploy','--config',configPath,'--keep-vars']];
}
export async function deploy(env=process.env,run=spawnSync) {
  const root=fileURLToPath(new URL('../',import.meta.url));
  const base=JSON.parse(await readFile(path.join(root,'apps/web/wrangler.jsonc'),'utf8'));
  const config=deployConfig(base,env,root),dir=path.join(root,'apps/web/.deploy');await mkdir(dir,{recursive:true});
  const configPath=path.join(dir,'wrangler.json');await writeFile(configPath,JSON.stringify(config,null,2)+'\n');
  const cli=path.join(root,'node_modules/wrangler/bin/wrangler.js');
  for(const args of deploySteps(configPath)) {
    const result=run(process.execPath,[cli,...args],{cwd:root,env:{...env,CI:'true'},stdio:'inherit'});
    if(result.error||result.status!==0)throw Error(args[0]==='d1'?'D1 migration failed; the Worker was not deployed. Check the Cloudflare build log.':'Worker deployment failed. Applied migrations remain recorded; retry after fixing the build error.');
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))deploy().catch(e=>{console.error(e.message);process.exitCode=1;});
