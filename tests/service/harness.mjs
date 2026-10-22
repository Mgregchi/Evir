import {build} from 'esbuild';
import {Miniflare,Log,LogLevel} from 'miniflare';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
export const site='https://evir.test';
export const callback='https://agent.example/callback';
export const client={client_id:'test-agent',client_name:'Test agent',redirect_uris:[callback]};
export async function harness() {
  const temp=await mkdtemp(path.join(tmpdir(),'evir-service-'));
  const output=await build({entryPoints:['apps/web/worker.mjs'],bundle:true,format:'esm',platform:'browser',target:'es2022',write:false});
  const mf=new Miniflare({modules:true,script:output.outputFiles[0].text,compatibilityDate:'2026-07-14',d1Databases:['DB'],serviceBindings:{ASSETS:async req=>{
    const pathname=new URL(req.url).pathname;
    const file=pathname==='/'?'index.html':pathname==='/editor/studio/'?'editor/studio/index.html':null;
    if(!file)return new Response('Not found',{status:404});
    return new Response(await readFile(path.join('apps/web/dist',file)),{headers:{'Content-Type':'text/html'}});
  }},bindings:{SITE_URL:site,OAUTH_CLIENTS:JSON.stringify([client])},log:new Log(LogLevel.ERROR)});
  const db=await mf.getD1Database('DB');
  // workerd D1 exec expects each SQL statement on a single line.
  const sql=await readFile('packages/service/migrations/0001_identity.sql','utf8');
  await db.exec(sql.replace(/^--.*$/gm,'').split(';').map(s=>s.trim().replace(/\s+/g,' ')).filter(Boolean).join(';\n')+';');
  const request=(pathname,options={})=>mf.dispatchFetch(site+pathname,options);
  async function account() {
    const {random,hash,now}=await import('../../packages/service/security.mjs');
    const id=random(),token=random();await db.prepare('INSERT INTO accounts VALUES (?, ?)').bind(id,now()).run();await db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').bind(await hash(token),id,now()+604800).run();
    return {id,token,cookie:'__Host-evir-session='+token};
  }
  return {mf,db,request,account,dispose:async()=>{await mf.dispose();await rm(temp,{recursive:true,force:true});}};
}
export function authQuery(challenge,state='opaque-state') {
  return new URLSearchParams({client_id:client.client_id,redirect_uri:callback,response_type:'code',resource:site+'/mcp',scope:'account:read',state,code_challenge:challenge,code_challenge_method:'S256'});
}
