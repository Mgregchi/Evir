import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createProject} from '@evir/project-model';
import {compassLesson} from '@evir/commands/example';
test('stdio MCP initialization, typed tools, patch/retry/conflict, bounded recovery and stop',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'evir-mcp-')),file=join(dir,'project.evir-project'),p=createProject();await writeFile(file,JSON.stringify(p));
  const child=spawn(process.execPath,['tools/mcp-local.mjs','--project',file,'--session','protocol-test'],{stdio:['pipe','pipe','pipe']});
  let line='',stderr='',next=0;const waiting=new Map();child.stderr.on('data',c=>stderr+=c);child.stdout.on('data',c=>{line+=c;for(let n;(n=line.indexOf('\n'))>=0;){const r=JSON.parse(line.slice(0,n));line=line.slice(n+1);waiting.get(r.id)?.resolve(r);waiting.delete(r.id);}});
  const call=(method,params)=>new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{waiting.delete(id);reject(Error('Timeout: '+stderr));},5000);waiting.set(id,{resolve:r=>{clearTimeout(timer);resolve(r);}});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,...(params?{params}:{})})+'\n');});
  const tool=(name,args)=>call('tools/call',{name,arguments:args});
  try{
    assert((await call('tools/list')).error);const init=await call('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'evir-protocol-test',version:'1'}});assert.equal(init.result.protocolVersion,'2025-11-25');
    child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
    const list=(await call('tools/list')).result.tools;assert.equal(list.length,9);assert(!list.some(t=>t.name==='capture_frame'));assert(list.every(t=>t.inputSchema.additionalProperties===false));
    const info=(await tool('inspect_scene',{})).result.structuredContent;assert.equal(info.context.sessionId,'protocol-test');
    const envelope={schemaVersion:1,context:info.context,requestId:'patch',expectedRevision:0,payload:{commands:compassLesson(p.artboards[0].id).commands}};
    const patch=(await tool('apply_scene_patch',envelope)).result;assert(patch.structuredContent.ok);assert.equal(patch.content[0].text,JSON.stringify(patch.structuredContent));assert.deepEqual((await tool('apply_scene_patch',envelope)).result,patch);
    assert.equal((await tool('apply_scene_patch',{...envelope,requestId:'stale'})).result.structuredContent.error.code,'CONFLICT');
    const snapshot=(await tool('get_scene_snapshot',{context:info.context})).result.structuredContent;assert.equal(snapshot.project.nodes.length,18);assert.deepEqual(snapshot.project.editor,p.editor);
    assert.equal((await tool('inspect_scene',{context:{...info.context,sessionId:'wrong'}})).result.isError,true);
    assert.equal((await tool('apply_scene_patch',{...envelope,requestId:'large',payload:{commands:[],label:'x'.repeat(70000)}})).result.isError,true);
    const malformed=new Promise(resolve=>waiting.set(null,{resolve}));child.stdin.write('{broken\n');assert.equal((await malformed).error.code,-32700);
    const oversized=new Promise(resolve=>waiting.set(null,{resolve}));child.stdin.write('x'.repeat(270000)+'\n');assert.match((await oversized).error.message,/256 KiB/);assert.deepEqual((await call('ping')).result,{});
    assert((await tool('stop_session',{context:info.context})).result.structuredContent.closed);assert.equal((await tool('apply_scene_patch',envelope)).result.structuredContent.error.code,'SESSION_CLOSED');
    assert.deepEqual(JSON.parse(await (await import('node:fs/promises')).readFile(file,'utf8')),p,'No source file writes');assert.equal(stderr,'');
  }finally{child.kill();await rm(dir,{recursive:true,force:true});}
});
