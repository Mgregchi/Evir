import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';import path from 'node:path';
import {chromium} from 'playwright';import axe from 'axe-core';
import {harness,site} from './harness.mjs';import {registeredLiveGrant,rpc} from './live-fixtures.mjs';
const folder='research/results/mcp-registration/live';
test('A dynamically registered MCP caller edits the real Studio history, retries safely and binds live audience controls',{timeout:180000},async()=>{
 const h=await harness({oauthClients:[]}),browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});await mkdir(folder,{recursive:true});const checks=[];
 try{
  const owner=await h.account(),g=await registeredLiveGrant(h,owner);checks.push('Dynamic confidential-client registration, consent and S256 exchange with no predefined OAUTH_CLIENTS');const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'__Host-evir-session',value:owner.token,url:site,secure:true,httpOnly:true,sameSite:'Lax'}]);
  const sockets=new Set();
  await context.routeWebSocket('wss://evir.test/**',async route=>{
    const url=new URL(route.url());const row=await h.db.prepare('SELECT id,owner_hash FROM live_sessions WHERE id = ?').bind(url.pathname.split('/')[3]).first();
    // Read the tab key from Chromium's actual outgoing handshake, never from D1.
    const key=handshakes.get(route.url());assert(row&&key,'The browser sent a session ownership key');
    const r=await h.mf.dispatchFetch(route.url().replace('wss:','https:'),{headers:{Cookie:owner.cookie,Origin:site,Upgrade:'websocket','Sec-WebSocket-Protocol':key}});assert.equal(r.status,101);
    const ws=r.webSocket;ws.accept();sockets.add(ws);ws.addEventListener('message',e=>route.send(e.data));ws.addEventListener('close',()=>{route.close();sockets.delete(ws);});route.onMessage(data=>ws.send(data));route.onClose(()=>{try{ws.close();}catch{}sockets.delete(ws);});
  });
  await context.route(site+'/**',async route=>{
    const req=route.request(),u=new URL(req.url());
    if(u.pathname.startsWith('/api/')||u.pathname.startsWith('/oauth/')||u.pathname.startsWith('/.well-known/')){const r=await h.mf.dispatchFetch(req.url(),{method:req.method(),headers:req.headers(),...(req.postDataBuffer()?{body:req.postDataBuffer()}:{})});const headers=Object.fromEntries(r.headers);if(r.headers.getSetCookie().length)headers['set-cookie']=r.headers.getSetCookie().join('\n');await route.fulfill({status:r.status,headers,body:Buffer.from(await r.arrayBuffer())});return;}
    const file=path.join('apps/web/dist',u.pathname.endsWith('/')?u.pathname+'index.html':u.pathname);const type=file.endsWith('.html')?'text/html':file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.wasm')?'application/wasm':'image/png';try{await route.fulfill({status:200,body:await readFile(file),headers:{'Content-Type':type}});}catch{await route.fulfill({status:404});}
  });
  const handshakes=new Map();await context.exposeBinding('recordLiveHandshake',(_,url,protocols)=>handshakes.set(url,protocols.join(', ')));
  // Playwright's WS route API does not expose handshake headers. Record constructor arguments,
  // then pass every frame to the actual workerd Durable Object; no scene operation is mocked.
  await context.addInitScript(()=>{const Native=WebSocket;window.WebSocket=class extends Native{constructor(url,protocols){window.recordLiveHandshake(String(url),protocols);super(url,protocols);}};});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(site+'/editor/studio/');await page.waitForFunction(()=>window.evirStudio);
  const original=await page.evaluate(()=>evirStudio.snapshot());
  async function share(){await page.getByRole('button',{name:'Project menu',exact:true}).click();await page.getByRole('button',{name:'Live agent connection…',exact:true}).click();await page.getByRole('button',{name:'Share this project',exact:true}).waitFor();await page.getByRole('checkbox',{name:'Allow edits to the selected artboard'}).check();await page.getByRole('checkbox',{name:'Allow animation and audience controls'}).check();await page.getByRole('button',{name:'Share this project',exact:true}).click();await page.locator('#remote-live-dock strong').filter({hasText:'sharing live'}).waitFor();return (await rpc(h,g,'list_live_sessions')).result.structuredContent.sessions[0];}
  const lease=await share();const get=async(name,args={})=>(await rpc(h,g,name,{sessionId:lease.sessionId,...args})).result.structuredContent;
  let info=await get('inspect_scene');assert.equal(info.context.projectId,original.id);
  const target=info.nodes.find(n=>n.kind==='rectangle'),envelope={schemaVersion:1,context:info.context,requestId:'remote-rename',expectedRevision:info.revision,payload:{label:'Agent label',commands:[{op:'update_node',nodeId:target.id,changes:{name:'Agent changed this layer'}}]}};
  let result=await get('apply_scene_patch',envelope);assert.equal(result.ok,true);assert.equal(result.cue.ready,true);assert.equal(result.motionAllowed,false);assert.equal(await page.evaluate(id=>evirStudio.snapshot().nodes.find(n=>n.id===id).name,target.id),'Agent changed this layer');
  const retry=await get('apply_scene_patch',envelope);assert.equal(retry.revision,result.revision);
  await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await page.evaluate(()=>evirStudio.snapshot()),original);const superseded=await get('apply_scene_patch',envelope);assert.equal(superseded.presentationSuperseded,true);assert.equal(superseded.cue.ready,false);assert.equal(superseded.cue.id,'remote-rename');checks.push('Actual MCP → Worker → Durable Object → browser command path, rendered cue, identical retry and one shared Undo');
  const stale=await get('apply_scene_patch',{...envelope,requestId:'stale-revision'});assert.equal(stale.error.code,'CONFLICT');
  info=await get('inspect_scene');
  const arm=info.nodes.find(n=>n.name==='Right arm'),animation={id:'live-wave',name:'An agent says hello',artboardId:info.context.artboardId,fps:60,duration:120,playback:{mode:'loop',iterations:0,speed:1},tracks:[{targetId:arm.id,property:'rotation',keys:[{frame:0,value:-.3,easing:{type:'linear',curve:null}},{frame:60,value:.3,easing:{type:'linear',curve:null}},{frame:120,value:-.3,easing:{type:'linear',curve:null}}]}]};
  result=await get('apply_scene_patch',{schemaVersion:1,context:info.context,requestId:'create-wave',expectedRevision:info.revision,payload:{label:'An agent says hello',commands:[{op:'create_animation',animation}]}});assert.equal(result.ok,true);info=await get('inspect_scene');
  await writeFile(`${folder}/live-wave.evir-project`,JSON.stringify(await page.evaluate(()=>evirStudio.snapshot()),null,2)+'\n');
  const controls=[{id:'live-speed',label:'Narration speed',type:'slider',min:.5,max:2,step:.5,value:1,binding:{kind:'speed',animationId:animation.id}}];
  result=await get('expose_controls',{schemaVersion:1,context:info.context,requestId:'show-control',expectedRevision:info.revision,payload:{controls}});assert.equal(result.ok,true);await page.getByRole('slider',{name:'Narration speed'}).waitFor();
  await page.getByRole('slider',{name:'Narration speed'}).focus();await page.getByRole('slider',{name:'Narration speed'}).press('ArrowRight');info=await get('inspect_scene');assert.equal(info.controls[0].value,1.5);assert((await get('get_session_events',{context:info.context,since:0})).events.some(e=>e.type==='control'));
  checks.push('Agent-defined speed slider updates locally and produces sequenced input events without changing source');
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:1000});await page.evaluate(axe.source);const violations=await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>v.id));assert.deepEqual(violations,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${folder}/sharing-${width}.png`,fullPage:true});}
  await page.getByRole('button',{name:'Minimize live preview'}).click();info=await get('inspect_scene');result=await get('play_animation',{schemaVersion:1,context:info.context,requestId:'collapsed-motion',expectedRevision:info.revision,payload:{animationId:animation.id,playing:true}});assert.equal(result.cue.ready,false);await page.getByRole('button',{name:'Show live preview'}).click();info=await get('inspect_scene');assert.equal(info.cue.ready,true);assert.equal(info.playing,true);assert.equal(await page.getByRole('checkbox',{name:'Allow live preview motion'}).isChecked(),false);
  await page.getByRole('button',{name:'Stop sharing',exact:true}).click();await page.locator('#remote-live-dock').waitFor({state:'detached'});assert.equal((await rpc(h,g,'inspect_scene',{sessionId:lease.sessionId})).result.isError,true);checks.push('Responsive/automated accessibility; minimized preview does not claim readiness; motion opt-in; Stop rejects later calls');
  const secondLease=await share();
  await page.locator('#file').setInputFiles(path.resolve('apps/web/assets/examples/compass.evir-project'));await page.locator('#replace-confirm').click();await page.waitForFunction(()=>evirStudio.snapshot().id==='compass-project');await page.locator('#remote-live-dock').waitFor({state:'detached'});assert.equal((await rpc(h,g,'inspect_scene',{sessionId:secondLease.sessionId})).result.isError,true);checks.push('Replacing a project stops sharing; the old agent context cannot read the replacement');
  assert.deepEqual(errors,[]);for(const ws of sockets)try{ws.close();}catch{}
  await writeFile(`${folder}/browser.json`,JSON.stringify({checkedAt:new Date().toISOString(),browser:browser.version(),scope:'Cloud Chromium with real workerd/D1/Durable Object transport. Synthetic OAuth client, not a paired commercial agent or physical device.',checks},null,2)+'\n');
 }finally{await browser.close();await h.dispose();}
});
