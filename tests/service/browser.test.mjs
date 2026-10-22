import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import axe from 'axe-core';
import {harness,site,authQuery} from './harness.mjs';
import {hash,random} from '../../packages/service/security.mjs';
test('A virtual authenticator creates and signs into an email-free account, with responsive consent and recovery',{timeout:120000},async()=>{
 const h=await harness();const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const folder='research/results/cloudflare-auth';await mkdir(folder,{recursive:true});const checks=[];
 try {
  const context=await browser.newContext();
  await context.route(site+'/**',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.pathname.startsWith('/assets/')||['/account/app.mjs','/account/styles.css'].includes(u.pathname)){
    const file=path.join('apps/web/dist',u.pathname);try{await route.fulfill({status:200,body:await readFile(file),headers:{'Content-Type':file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':'image/png'}});}catch{await route.fulfill({status:404});}return;
   }
   const r=await h.mf.dispatchFetch(req.url(),{method:req.method(),headers:req.headers(),...(req.postDataBuffer()?{body:req.postDataBuffer()}:{})});
   const headers=Object.fromEntries(r.headers);if(r.headers.getSetCookie().length)headers['set-cookie']=r.headers.getSetCookie().join('\n');await route.fulfill({status:r.status,headers,body:Buffer.from(await r.arrayBuffer())});
  });
  const page=await context.newPage();const cdp=await context.newCDPSession(page);await cdp.send('WebAuthn.enable');let {authenticatorId}=await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
  await page.goto(site+'/account/');await page.getByRole('button',{name:'Create a passkey account'}).click();await page.getByRole('button',{name:'Add a passkey',exact:true}).waitFor();checks.push('WebAuthn registration verified by real Worker against D1; no email');
  assert.equal((await h.db.prepare('SELECT COUNT(*) AS n FROM credentials').first()).n,1);
  await page.getByRole('button',{name:'Create new recovery codes'}).click();await page.locator('#codes[open]').waitFor();const codes=(await page.locator('#code-list').innerText()).split('\n');assert.equal(codes.length,8);await page.getByRole('button',{name:'I have saved them'}).click();await page.locator('#codes[open]').waitFor({state:'hidden'});assert.equal(await page.locator('#code-list').innerText(),'');checks.push('Recovery codes clear on bottom-sheet dismissal');
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('button',{name:'Sign in with a passkey',exact:true}).waitFor();await page.getByRole('button',{name:'Sign in with a passkey',exact:true}).click();await page.getByRole('button',{name:'Add a passkey',exact:true}).waitFor();checks.push('Discoverable passkey login verifies a signed authentication assertion');
  await cdp.send('WebAuthn.removeVirtualAuthenticator',{authenticatorId});
  ({authenticatorId}=await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}}));
  await page.getByRole('button',{name:'Add a passkey',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#credentials').children.length===2);await page.locator('#credentials button').first().click();await page.waitForFunction(()=>document.querySelector('#credentials').children.length===1);checks.push('Adding and removing passkeys retains an account access method');
  await page.getByRole('button',{name:'Create new recovery codes'}).click();await page.locator('#codes[open]').waitFor();await page.keyboard.press('Escape');await page.locator('#codes[open]').waitFor({state:'hidden'});
  const q=authQuery(await hash(random()));await page.goto(site+'/oauth/authorize?'+q);await page.getByRole('button',{name:'Allow connection',exact:true}).waitFor();assert.match(await page.locator('#client-name').innerText(),/Test agent/);
  for(const width of [320,390,1440]) {
   await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.evaluate(axe.source);const result=await page.evaluate(async()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));assert.deepEqual(result.violations.map(v=>v.id),[]);
   await page.screenshot({path:`${folder}/consent-${width}.png`,fullPage:true});
  }
  checks.push('Consent at 320, 390 and 1440 CSS pixels: no overflow or automated WCAG A/AA violations');
  await page.goto(site+'/account/');await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Create new recovery codes'}).click();await page.locator('#codes[open]').waitFor();assert.equal(await page.locator('#codes').evaluate(e=>getComputedStyle(e).animationName),'none');await page.screenshot({path:`${folder}/recovery.png`,fullPage:true});await page.keyboard.press('Escape');
  await cdp.send('WebAuthn.removeVirtualAuthenticator',{authenticatorId});
  await writeFile(`${folder}/browser.json`,JSON.stringify({checkedAt:new Date().toISOString(),browser:browser.version(),scope:'Cloud Chromium virtual authenticator and local workerd/D1 only. No physical device, named-agent pairing or human accessibility claim.',checks},null,2)+'\n');
 }finally{await browser.close();await h.dispose();}
});
