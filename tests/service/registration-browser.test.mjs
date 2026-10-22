import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import axe from 'axe-core';
import {harness,site,authQuery} from './harness.mjs';
import {hash,random} from '../../packages/service/security.mjs';

test('Registered-client consent shows the exact destination, escapes names, and supports cancel/approve without sharing artwork',{timeout:120000},async()=>{
  const h=await harness({oauthClients:[]});
  const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  const folder='research/results/mcp-registration';await mkdir(folder,{recursive:true});
  try{
    const owner=await h.account(),context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
    await context.addCookies([{name:'__Host-evir-session',value:owner.token,url:site,httpOnly:true,secure:true,sameSite:'Lax'}]);
    await context.route(site+'/**',async route=>{
      const req=route.request(),url=new URL(req.url());
      if(url.pathname.startsWith('/assets/')||['/account/app.mjs','/account/styles.css'].includes(url.pathname)){
        const file=path.join('apps/web/dist',url.pathname);await route.fulfill({status:200,body:await readFile(file),headers:{'Content-Type':file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':'image/png'}});return;
      }
      const r=await h.mf.dispatchFetch(req.url(),{method:req.method(),headers:req.headers(),...(req.postDataBuffer()?{body:req.postDataBuffer()}:{})});
      const headers=Object.fromEntries(r.headers);if(r.headers.getSetCookie().length)headers['set-cookie']=r.headers.getSetCookie().join('\n');
      await route.fulfill({status:r.status,headers,body:Buffer.from(await r.arrayBuffer())});
    });
    const page=await context.newPage(),errors=[],dialogs=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{dialogs.push(d.type());d.dismiss();});
    await page.goto(site+'/account/');await page.locator('#connector-guide summary').click();assert.match(await page.locator('#connector-guide').innerText(),/Register automatically/);
    await page.screenshot({path:`${folder}/connect-390.png`,fullPage:true});
    const redirectUri='https://agent.example/callback?context='+'x'.repeat(220),name='<img src=x onerror=alert(1)>'+'x'.repeat(80);
    const registration=await h.request('/oauth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_name:name,redirect_uris:[redirectUri],token_endpoint_auth_method:'client_secret_post',grant_types:['authorization_code','refresh_token']})});
    assert.equal(registration.status,201);const client=await registration.json(),verifier=random(),query=authQuery(await hash(verifier));query.set('client_id',client.client_id);query.set('redirect_uri',redirectUri);
    await page.goto(site+'/oauth/authorize?'+query);await page.getByRole('button',{name:'Allow connection',exact:true}).waitFor();
    assert((await page.locator('#client-name').innerText()).includes(name));assert.match(await page.locator('#client-registration').innerText(),/not verified by Evir/);assert.equal(await page.locator('#client-destination').innerText(),redirectUri);assert.equal(await page.locator('img').count(),1);
    for(const width of [320,390,1440]){
      await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.evaluate(axe.source);const violations=await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.map(v=>v.id));assert.deepEqual(violations,[]);
      await page.screenshot({path:`${folder}/consent-${width}.png`,fullPage:true});
    }
    await context.route('https://agent.example/**',route=>route.fulfill({status:200,body:'Synthetic connector callback'}));
    await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.waitForURL('https://agent.example/**');assert.equal(new URL(page.url()).searchParams.get('error'),'access_denied');
    assert.equal((await h.db.prepare('SELECT COUNT(*) AS n FROM codes').first()).n,0);assert.equal((await h.db.prepare('SELECT COUNT(*) AS n FROM grants').first()).n,0);
    await page.goto(site+'/oauth/authorize?'+query);await page.getByRole('button',{name:'Allow connection',exact:true}).click();await page.waitForURL('https://agent.example/**');
    const destination=new URL(page.url());assert.equal(destination.searchParams.get('state'),'opaque-state');assert.equal(destination.searchParams.get('iss'),site);assert.equal(destination.searchParams.get('context'),'x'.repeat(220));
    const exchange=await h.request('/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:client.client_id,client_secret:client.client_secret,grant_type:'authorization_code',redirect_uri:redirectUri,resource:site+'/mcp',code:destination.searchParams.get('code'),code_verifier:verifier}).toString()});
    assert.equal(exchange.status,200);assert((await exchange.json()).access_token);assert.equal((await h.db.prepare('SELECT COUNT(*) AS n FROM live_sessions').first()).n,0);
    assert.deepEqual(errors,[]);assert.deepEqual(dialogs,[]);
    await writeFile(`${folder}/browser.json`,JSON.stringify({checkedAt:new Date().toISOString(),browser:browser.version(),scope:'Synthetic registered connector, local workerd/D1 and cloud Chromium. Not named-client pairing, physical-device or human-accessibility evidence.',widths:[320,390,1440],automatedAccessibilityViolations:0,checks:['In-account connector guidance','Exact long callback is visible and wraps','Client-provided markup renders as text with no browser dialogs','Unverified identity is disclosed','Cancel issues no code/grant','Approve preserves callback parameters, state and issuer','PKCE/confidential-client token exchange completes','Account connection alone shares no Studio project']},null,2)+'\n');
  }finally{await browser.close();await h.dispose();}
});
