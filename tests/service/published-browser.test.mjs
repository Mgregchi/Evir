import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import axe from 'axe-core';
import {harness,site,authQuery} from './harness.mjs';
import {hash,random} from '../../packages/service/security.mjs';
import {publisher,route,form,exchange} from './published-fixtures.mjs';

test('Published consent shows its hostname, recovers from document failure, and completes a port-bound native callback',{timeout:120000},async()=>{
 const mock=publisher(),doc=JSON.parse(await readFile('research/cimd/claude-code-metadata.json','utf8'));let available=false;
 route(mock,doc.client_id,()=>available?{data:doc}:{status:404,data:{error:'Synthetic publisher unavailable'}});
 const h=await harness({oauthClients:[],fetchMock:mock}),browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});const folder='research/results/cimd';await mkdir(folder,{recursive:true});
 try{
  const owner=await h.account(),context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await context.addCookies([{name:'__Host-evir-session',value:owner.token,url:site,secure:true,httpOnly:true,sameSite:'Lax'}]);
  await context.route(site+'/**',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.pathname.startsWith('/assets/')||['/account/app.mjs','/account/styles.css'].includes(url.pathname)){
    const file=path.join('apps/web/dist',url.pathname);await route.fulfill({status:200,body:await readFile(file),headers:{'Content-Type':file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':'image/png'}});return;
   }
   const r=await h.mf.dispatchFetch(req.url(),{method:req.method(),headers:req.headers(),...(req.postDataBuffer()?{body:req.postDataBuffer()}:{})}),headers=Object.fromEntries(r.headers);if(r.headers.getSetCookie().length)headers['set-cookie']=r.headers.getSetCookie().join('\n');await route.fulfill({status:r.status,headers,body:Buffer.from(await r.arrayBuffer())});
  });
  const page=await context.newPage(),errors=[],dialogs=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{dialogs.push(d.type());d.dismiss();});
  const verifier=random(),query=authQuery(await hash(verifier)),redirect='http://localhost:49152/callback';query.set('client_id',doc.client_id);query.set('redirect_uri',redirect);
  const failure=await page.goto(site+'/oauth/authorize?'+query);assert.equal(failure.status(),503);await page.getByRole('link',{name:'Retry this connection',exact:true}).waitFor();assert.match(await page.getByRole('alert').innerText(),/published client document/);await page.screenshot({path:`${folder}/retry-390.png`,fullPage:true});
  available=true;await page.getByRole('link',{name:'Retry this connection',exact:true}).click();await page.getByRole('button',{name:'Allow connection',exact:true}).waitFor();
  assert.match(await page.locator('#client-name').innerText(),/Application at claude.ai requests/);assert.match(await page.locator('#client-registration').innerText(),/not the caller/);assert.equal(await page.locator('#client-destination').innerText(),redirect);
  for(const width of [320,390,1440]){
   await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.evaluate(axe.source);assert.deepEqual(await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.map(v=>v.id)),[]);await page.screenshot({path:`${folder}/consent-${width}.png`,fullPage:true});
  }
  await context.route('http://localhost:49152/**',async route=>{assert(!route.request().headers().cookie);await route.fulfill({status:200,body:'Synthetic native client callback'});});
  await page.getByRole('button',{name:'Allow connection',exact:true}).click();await page.waitForURL('http://localhost:49152/**');const destination=new URL(page.url());assert.equal(destination.searchParams.get('state'),'opaque-state');assert.equal(destination.searchParams.get('iss'),site);
  const code={code:destination.searchParams.get('code'),verifier,redirect};const token=await h.request('/oauth/token',form(exchange(code,undefined,doc.client_id)));assert.equal(token.status,200);assert((await token.json()).access_token);
  assert.equal((await h.db.prepare('SELECT COUNT(*) AS n FROM oauth_clients').first()).n,0);assert.equal((await h.db.prepare('SELECT COUNT(*) AS n FROM live_sessions').first()).n,0);assert.deepEqual(errors,[]);assert.deepEqual(dialogs,[]);
  await writeFile(`${folder}/browser.json`,JSON.stringify({checkedAt:new Date().toISOString(),browser:browser.version(),scope:'Synthetic native-client callback with observed public Claude Code metadata, cloud Chromium and real local workerd/D1. No real Claude Code/ChatGPT/Claude pairing or physical/human evidence.',widths:[320,390,1440],automatedAccessibilityViolations:0,checks:['Branded publisher-failure page with manual Retry','Uncached failed document recovers','Consent names the publisher hostname and distinguishes document from caller identity','Actual native callback port is visible','Responsive consent and automated accessibility','Callback receives state/issuer/code but no Evir cookie','PKCE exchange binds the actual callback URI','No DCR registration or Studio share is created']},null,2)+'\n');
 }finally{await browser.close();await h.dispose();await mock.close();}
});
