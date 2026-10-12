const assert=require('node:assert/strict'),fs=require('node:fs');
const {run}=require('../../tools/browser.cjs');
(async()=>{
  const out='research/results/playback';fs.mkdirSync(out,{recursive:true});const report={checkedAt:new Date().toISOString(),checks:[],scope:'Headless Chromium UX/lifecycle automation, not physical-device or human evidence'};
  const root=require('node:path').resolve(__dirname,'../..'),output='apps/web/.test-build/motorcycle';
  require('node:child_process').execFileSync(process.execPath,['apps/web/build.mjs'],{cwd:root,env:{...process.env,SITE_URL:'',EVIR_WEB_OUTPUT:output},stdio:'pipe'});
  const {createStaticServer}=await import('../../tools/static-server.mjs');const server=createStaticServer(require('node:path').join(root,output));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
  try {await run(async(page,browser)=>{
    report.browserVersion=browser.version();await page.emulateMedia({reducedMotion:'reduce'});
    for(const [width,height] of [[320,844],[390,844],[844,390],[1440,900]]){
      await page.setViewportSize({width,height});await page.goto(origin+'/examples/#motorcycle');
      const ride=page.locator('[data-preview=motorcycle]');await ride.scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('[data-preview=motorcycle]').dataset.ready==='true');
      assert.equal(await ride.getAttribute('data-playing'),'false');assert.equal(await ride.locator('.demo-state').innerText(),'Parked');
      assert.equal(await ride.locator('.ride-speed').getAttribute('aria-live'),'off');assert.equal(await ride.locator('.ride-distance').getAttribute('aria-live'),'off');
      await ride.getByLabel('Throttle',{exact:false}).focus();await page.keyboard.press('ArrowUp');assert.equal(await ride.locator('.throttle-control').inputValue(),'1');
      await ride.locator('.throttle-control').fill('75');assert.equal(await ride.locator('.throttle-value').innerText(),'75%');
      await ride.getByRole('button',{name:'Start ride',exact:true}).click();await page.waitForFunction(()=>Number(document.querySelector('.ride-speed').textContent)>=5);
      await ride.getByRole('button',{name:'Pause ride',exact:true}).click();const paused=await ride.locator('.ride-distance').innerText();await page.waitForTimeout(250);assert.equal(await ride.locator('.ride-distance').innerText(),paused);
      await ride.getByLabel('Headlight',{exact:true}).check();await ride.getByRole('button',{name:'Road bump',exact:true}).click();assert.match(await ride.locator('.demo-message').innerText(),/started/);
      await ride.getByRole('button',{name:'Road bump',exact:true}).click();assert.match(await ride.locator('.demo-message').innerText(),/settle/);
      await ride.getByRole('button',{name:'Turn signal',exact:true}).click();assert.match(await ride.locator('.demo-message').innerText(),/three blinks/);
      await ride.getByRole('button',{name:'Turn signal',exact:true}).click();assert.match(await ride.locator('.demo-message').innerText(),/still blinking/);
      await ride.getByRole('button',{name:'Start ride',exact:true}).click();await ride.getByRole('button',{name:'Brake',exact:true}).click();assert.equal(await ride.getByRole('button',{name:'Brake',exact:true}).getAttribute('aria-pressed'),'true');
      await page.waitForFunction(()=>document.querySelector('.ride-speed').textContent==='0');assert.equal(await ride.locator('.demo-state').innerText(),'Braking');
      await ride.getByRole('button',{name:'Brake',exact:true}).click();await page.waitForFunction(()=>Number(document.querySelector('.ride-speed').textContent)>=3);
      await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
      const hidden=await ride.locator('.ride-distance').innerText();await page.waitForTimeout(250);assert.equal(await ride.locator('.ride-distance').innerText(),hidden);
      await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
      await ride.getByRole('button',{name:'Reset ride',exact:true}).click();assert.equal(await ride.getAttribute('data-playing'),'false');assert.equal(await ride.locator('.ride-speed').innerText(),'0');assert.equal(await ride.locator('.ride-distance').innerText(),'0');assert.equal(await ride.locator('.throttle-control').inputValue(),'0');assert.equal(await ride.getByLabel('Headlight',{exact:true}).isChecked(),false);assert.equal(await ride.getByLabel('Occasional bumps',{exact:true}).isChecked(),true);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});const violations=await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));assert.deepEqual(violations,[]);
      if(width===390||width===1440){await ride.scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/motorcycle-${width}x${height}.png`,animations:'disabled'});await ride.locator('.demo-stage').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/motorcycle-scene-${width}x${height}.png`,animations:'disabled'});}
      report.checks.push({width,height,passed:['explicit reduced-motion opt-in','keyboard throttle','accelerate/brake/release','pause','headlight','one-shot bump/retrigger guard','counted signal/retrigger guard','quiet fast telemetry','simulated hidden-page suspension','full reset','no page overflow','zero automated accessibility violations']});
    }
    // Below-fold motion freezes without resetting phase; no hidden catch-up.
    const ride=page.locator('[data-preview=motorcycle]');await ride.locator('.throttle-control').fill('80');await ride.getByRole('button',{name:'Start ride',exact:true}).click();await page.waitForFunction(()=>Number(document.querySelector('.ride-speed').textContent)>=3);
    await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(100);const offscreen=await ride.locator('.ride-distance').innerText();await page.waitForTimeout(300);assert.equal(await ride.locator('.ride-distance').innerText(),offscreen);
    report.checks.push({passed:['offscreen animation suspended']});
  });fs.writeFileSync(`${out}/motorcycle-browser.json`,JSON.stringify(report,null,2)+'\n');console.log('Motorcycle: responsive controls, keyboard, lifecycle and accessibility checks passed.');}
  finally{await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
