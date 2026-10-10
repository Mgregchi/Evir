const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const {chromium} = require('playwright');
const {press} = require('./actions.cjs');
(async () => {
  const {createStaticServer} = await import('../../tools/static-server.mjs');
  const server = createStaticServer(path.resolve('apps/web/dist'));
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : chromium.executablePath()),args:['--no-sandbox']});
  const evidence = path.resolve('research/results/studio-workspace'); fs.mkdirSync(evidence,{recursive:true});
  const widths = [[320,568],[390,844],[768,1024],[844,390],[1024,768],[1440,1000]];
  const measurements = [], errors = [], nativeDialogs = [];
  const checkAxe = async page => {
    await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
    const failures = await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));
    assert.deepEqual(failures,[]);
  };
  try {
    for (const [width,height] of widths) {
      const context = await browser.newContext({viewport:{width,height},reducedMotion:'reduce',deviceScaleFactor:3});
      const page = await context.newPage(); page.on('pageerror',e=>errors.push(e.message)); page.on('dialog',d=>{nativeDialogs.push(d.type());d.dismiss();});
      await page.goto(origin+'/editor/studio/'); await page.waitForFunction(()=>window.evirStudio);
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      const stage = await page.locator('#stage').boundingBox(), header = await page.locator('.topbar').boundingBox(), save = await page.locator('#save').boundingBox(), menu = await page.locator('#project-menu-toggle').boundingBox();
      assert.equal(header.height,64); assert(save.x > width*.60,'Save belongs on the right'); assert(menu.x > save.x+save.width,'menu follows Save');
      assert(stage.width >= 240); assert(stage.height >= height*(height<540 ? .5 : width<=850 ? .65 : .4),'canvas stays prominent');
      for (const id of ['select-tool','pan-tool','pen-tool','create-toggle','show-layers','show-properties']) {
        assert(await page.locator('#'+id).isVisible()); const r = await page.locator('#'+id).boundingBox(); assert(r.width>=40&&r.height>=40,'usable tool targets');
      }
      const framing = await page.evaluate(()=>{const p=evirStudio.snapshot(),a=p.artboards[0],c=p.editor.cameras[a.id];return {x:c.x+a.width*c.zoom/2,y:c.y+a.height*c.zoom/2,w:scene.width,h:scene.height};});
      assert(Math.abs(framing.x-stage.width/2)<1);assert(Math.abs(framing.y-stage.height/2)<1);assert(framing.w<=stage.width*2+1 && framing.h<=stage.height*2+1,'DPR is bounded at two');
      // Keyboard opening/closing must leave selection intact and restore the trigger.
      await page.locator('#project-menu-toggle').focus(); await page.keyboard.press('Enter'); await page.locator('#new').waitFor({state:'visible'}); await page.keyboard.press('Escape');
      assert(await page.locator('#project-menu').evaluate(e=>!e.matches(':popover-open')));assert(await page.locator('#project-menu-toggle').evaluate(e=>e===document.activeElement));
      await checkAxe(page);
      await page.screenshot({scale:'css',path:path.join(evidence,`studio-${width}x${height}.png`)});
      // Manual framing preserves the same world-space center through reflow.
      await press(page,'Pan'); await page.mouse.move(stage.x+stage.width/2,stage.y+stage.height/2); await page.mouse.down(); await page.mouse.move(stage.x+stage.width/2+15,stage.y+stage.height/2+10); await page.mouse.up();
      const center = () => page.evaluate(()=>{const r=document.querySelector('#stage').getBoundingClientRect(),p=evirStudio.snapshot(),c=p.editor.cameras[p.artboards[0].id];return [(r.width/2-c.x)/c.zoom,(r.height/2-c.y)/c.zoom];});
      const beforeResize=await center();await page.setViewportSize({width:width+20,height});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const afterResize=await center();for(let i=0;i<2;i++)assert(Math.abs(afterResize[i]-beforeResize[i])<1e-6);
      await page.setViewportSize({width,height});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await press(page,'Fit');await press(page,'Select');
      if (width<=850) {
        await page.locator('#show-layers').click(); assert(await page.locator('#mobile-panel .layers').isVisible()); assert.equal(await page.locator('#show-layers').getAttribute('aria-expanded'),'true');
        await checkAxe(page); if(width===390) await page.screenshot({scale:'css',path:path.join(evidence,'layers-mobile.png')});
        await page.getByRole('button',{name:'Select Body',exact:true}).click(); await page.locator('#close-panel').click(); assert(await page.locator('#show-layers').evaluate(e=>e===document.activeElement));
        await page.locator('#show-properties').click(); await page.getByLabel('X',{exact:true}).fill(''); await page.getByLabel('X',{exact:true}).press('Tab'); assert(await page.locator('#mobile-panel #notice').isVisible(),'errors belong in the active drawer'); const toast=await page.locator('#notice').boundingBox(),drawer=await page.locator('#mobile-panel').boundingBox(); assert(toast.x>=drawer.x && toast.x+toast.width<=drawer.x+drawer.width,'feedback fits its drawer'); assert.equal(await page.evaluate(()=>evirStudio.snapshot().nodes.find(n=>n.name==='Body').transform[4]),10); await page.getByLabel('X',{exact:true}).fill('28'); await page.getByLabel('X',{exact:true}).press('Tab'); assert.equal(await page.evaluate(()=>evirStudio.snapshot().nodes.find(n=>n.name==='Body').transform[4]),28);
        await page.locator('#close-panel').click(); await page.locator('#undo').click(); assert.equal(await page.evaluate(()=>evirStudio.snapshot().nodes.find(n=>n.name==='Body').transform[4]),10);
        await press(page,'Animate'); await page.locator('#show-workflow').click(); await press(page,'+ Animation'); assert(await page.getByLabel('Playhead',{exact:true}).isVisible()); await checkAxe(page);
        if(width===390) await page.screenshot({scale:'css',path:path.join(evidence,'timeline-mobile.png')});
        await page.locator('#close-panel').click(); const animatedStage=await page.locator('#stage').boundingBox(); assert.equal(animatedStage.height,stage.height);
        await press(page,'Interact'); await page.locator('#show-workflow').click(); assert(await page.getByRole('button',{name:'+ Machine',exact:true}).isVisible()); await page.locator('#close-panel').click(); await press(page,'Design');
      } else {
        const prior = await page.locator('#stage').boundingBox(); await page.locator('#show-layers').click(); await page.locator('#show-properties').click(); await page.waitForTimeout(60);
        const expanded=await page.locator('#stage').boundingBox(); assert(expanded.width > prior.width+400); assert(await page.locator('.workspace>.layers').isHidden());
        await page.locator('#show-layers').click(); await page.locator('#show-properties').click();
      }
      await press(page,'Rectangle'); assert.equal(await page.evaluate(()=>evirStudio.snapshot().nodes.length),14); await page.locator('#create-toggle').click(); const flyout=await page.locator('#create-menu').boundingBox(); assert(flyout.y+flyout.height<=height,'creation flyout fits short screens'); await page.keyboard.press('Escape');
      const saved=page.waitForEvent('download');await press(page,'Save project');const source=JSON.parse(fs.readFileSync(await (await saved).path(),'utf8'));assert.equal(source.nodes.length,14);
      const exported=page.waitForEvent('download');await press(page,'Export .riv');assert(fs.statSync(await (await exported).path()).size>0);
      measurements.push({width,height,stage,header,save}); await context.close();
    }
    // Slow module delivery exposes the first-paint startup scene without fake progress/delay.
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage();
    let release;const gate=new Promise(r=>release=r);await page.route('**/studio.mjs',async route=>{await gate;await route.continue();});
    await page.goto(origin+'/editor/studio/',{waitUntil:'commit'});await page.locator('.startup-scene').waitFor({state:'visible'});
    assert.equal(await page.locator('.living-seed').evaluate(e=>getComputedStyle(e).animationName),'none');assert(await page.locator('.tool-rail').evaluate(e=>e.inert));await page.screenshot({scale:'css',path:path.join(evidence,'startup-mobile.png')});
    release();await page.waitForFunction(()=>window.evirStudio);assert(await page.locator('#studio-loading').isHidden());
    await page.route('**/studio.mjs',route=>route.abort());await page.reload();await page.locator('.startup-error').waitFor({state:'visible'});assert(await page.getByRole('button',{name:'Reload Studio'}).isVisible());assert(await page.locator('.startup-scene').isHidden());await page.screenshot({scale:'css',path:path.join(evidence,'recovery-mobile.png')});await context.close();
    const noScript=await browser.newContext({viewport:{width:390,height:844},javaScriptEnabled:false}),fallback=await noScript.newPage();
    await fallback.goto(origin+'/editor/studio/');assert(await fallback.locator('.no-script').isVisible());await fallback.getByRole('link',{name:'Return home',exact:true}).click();assert.equal(new URL(fallback.url()).pathname,'/');await noScript.close();
    // Callback counts prove suspension rather than relying on Chromium's background throttling.
    const playback=await browser.newContext({viewport:{width:390,height:844}}),motion=await playback.newPage();
    await motion.addInitScript(()=>{const raf=window.requestAnimationFrame.bind(window);window.framesExecuted=0;window.requestAnimationFrame=cb=>raf(t=>{framesExecuted++;cb(t);});});
    await motion.goto(origin+'/editor/studio/');await motion.waitForFunction(()=>evirStudio);await motion.locator('#file').setInputFiles('apps/web/assets/examples/orbit.evir-project');await motion.locator('#replace-confirm').click();await motion.waitForFunction(()=>evirStudio.snapshot().id==='orbit-project');await press(motion,'Animate');await motion.locator('#show-workflow').click();await press(motion,'Play');await motion.locator('#close-panel').click();await motion.waitForTimeout(100);const started=await motion.evaluate(()=>framesExecuted);assert(started>0);
    await motion.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await motion.waitForTimeout(80);const paused=await motion.evaluate(()=>framesExecuted);await motion.waitForTimeout(100);assert.equal(await motion.evaluate(()=>framesExecuted),paused);
    await motion.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});await motion.waitForTimeout(100);assert(await motion.evaluate(()=>framesExecuted)>paused);
    await motion.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));const suspended=await motion.evaluate(()=>framesExecuted);await motion.waitForTimeout(100);assert.equal(await motion.evaluate(()=>framesExecuted),suspended);await motion.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await motion.waitForTimeout(100);assert(await motion.evaluate(()=>framesExecuted)>suspended);await playback.close();
    assert.deepEqual(errors,[]);assert.deepEqual(nativeDialogs,[]);
    fs.writeFileSync(path.join(evidence,'acceptance.json'),JSON.stringify({checkedAt:new Date().toISOString(),measurements,automatedAccessibilityViolations:0,checks:['balanced compact header','persistent tool/panel rail','mobile drawers and focus restoration','desktop panel collapse','centered fitting, preserved manual framing and bounded DPR','mobile property edit and undo','mobile timeline and machine access','source and runtime downloads','keyboard disclosure opening and Escape','slow startup and reduced motion','module failure and no-JavaScript recovery','hidden and BFCache simulated playback suspension'],limits:'Chromium automation and screenshot review; no physical-device, screen-reader or moderated usability certification.'},null,2)+'\n');
    console.log('Workspace UX acceptance passed across six portrait/landscape/tablet/desktop sizes');
  } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
