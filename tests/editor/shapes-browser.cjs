const assert=require('node:assert/strict'),fs=require('node:fs');
const{run}=require('../../tools/browser.cjs');
(async()=>{
 const{compileProject}=await import('@evir/format'),out='research/results/shape-library';fs.mkdirSync(out,{recursive:true});
 const report={checkedAt:new Date().toISOString(),scope:'Cloud Chromium, simulated viewports and automated accessibility; no physical-device or human usability evidence.',viewports:[]};
 await run(async(initial,browser)=>{
  report.browser=browser.version();
  for(const[width,height]of[[320,844],[390,844],[844,390],[1440,900]]){
   const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   const press=name=>require('./actions.cjs').press(page,name),snapshot=()=>page.evaluate(()=>evirStudio.snapshot());
   const change=async(label,value)=>{const f=page.getByLabel(label,{exact:true});await f.fill(String(value));await f.press('Tab');};
   const close=async()=>{if(await page.locator('#mobile-panel').getAttribute('open')!==null)await page.locator('#close-panel').click();};
   const show=async name=>{if(width<=850){await close();await press(name);}};
   const openShapes=async()=>{await page.locator('#create-toggle').click();await page.getByRole('button',{name:'Shapes…',exact:true}).click();await page.locator('#advanced-sheet').waitFor();};
   const add=()=>page.locator('#advanced-sheet > .dialog-actions').getByRole('button',{name:'Add shape',exact:true}).click();
   await page.goto('http://127.0.0.1:8776/apps/web/dist/editor/studio/');await page.waitForFunction(()=>window.evirStudio);
   await press('New');await page.locator('#replace-confirm').click();await page.waitForFunction(()=>!evirStudio.snapshot().nodes.length);await change('Project name','First bounce');
   const blank=await snapshot();await openShapes();assert.equal(await page.locator('[data-shape]').count(),14);
   assert.equal(await page.locator('#advanced-sheet h2').evaluate(e=>document.activeElement===e),true);
   await page.locator('[data-shape=star]').click();await page.getByLabel('Star points',{exact:true}).fill('13');await add();assert.match(await page.locator('#advanced-sheet > [role=alert]').innerText(),/\[3,12\]/);assert.deepEqual(await snapshot(),blank);
   await page.getByLabel('Star points',{exact:true}).fill('7');assert.equal(await page.locator('.shape-preview path').count(),1);
   const detached=await page.locator('#advanced-sheet > .dialog-actions').getByRole('button',{name:'Add shape',exact:true}).elementHandle();
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#advanced-sheet'));await detached.evaluate(e=>e.click());assert.deepEqual(await snapshot(),blank);assert.equal(await page.locator('#create-toggle').evaluate(e=>document.activeElement===e),true);
   await openShapes();await page.locator('[data-shape=circle]').click();await page.getByLabel('Size',{exact:true}).fill('96');await page.getByLabel('Fill color',{exact:true}).fill('#edb75f');
   await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});assert.deepEqual(await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))),[]);
   const action=page.locator('#advanced-sheet > .dialog-actions').getByRole('button',{name:'Add shape',exact:true});await action.scrollIntoViewIfNeeded();const box=await action.boundingBox(),sheet=await page.locator('#advanced-sheet').boundingBox();assert(box.y>=0&&box.y+box.height<=height);assert(sheet.x>=0&&sheet.x+sheet.width<=width+1);if(width<=850)assert(Math.abs(sheet.width-width)<2);
   await page.screenshot({path:`${out}/palette-${width}.png`});
   if(width===1440){await page.locator('#advanced-sheet').evaluate(e=>e.scrollTop=0);await page.screenshot({path:'apps/web/assets/learn-shapes.png'});}
   await add();assert.equal((await snapshot()).nodes.length,1);const created=(await snapshot()).nodes[0];assert.equal(created.geometry.points.length,4);
   await press('Undo');assert.equal((await snapshot()).nodes.length,0);await press('Redo');assert.equal((await snapshot()).nodes[0].id,created.id);
   await show('Layers');await press('Select Circle');await show('Properties');await change('Layer name','Sun');await change('X',120);await change('Y',220);await close();
   await press('Animate');await show('Timeline');await press('+ Animation');await change('Animation name','Bounce');assert.equal(await page.getByLabel('FPS',{exact:true}).inputValue(),'60');assert.equal(await page.getByLabel('Duration frames',{exact:true}).inputValue(),'120');
   await change('Frame',0);await page.getByLabel('Key property',{exact:true}).selectOption('y');await press('Set key');
   await change('Frame',60);await show('Properties');await change('Y',100);await show('Timeline');await change('Frame',120);await show('Properties');await change('Y',220);await show('Timeline');
   const source=await snapshot();assert.deepEqual(source.animations[0].tracks.find(t=>t.property==='y').keys.map(k=>[k.frame,k.value]),[[0,220],[60,100],[120,220]]);assert.equal(source.nodes[0].transform[5],220);
   await press('Playback settings…');await page.getByLabel('Playback mode',{exact:true}).selectOption('loop');await page.getByLabel('Repeat',{exact:true}).selectOption('continuous');await page.locator('#advanced-sheet > .dialog-actions').getByRole('button',{name:'Apply',exact:true}).click();
   await change('Frame',0);await press('Play');await page.waitForFunction(()=>evirStudio.pose().nodes[0].transform[5]<215);await press('Pause');
   assert.equal(Number(await page.getByLabel('Frame',{exact:true}).inputValue()),Math.round(Number(await page.getByLabel('Playhead',{exact:true}).inputValue())));
   await change('Frame',30);assert(Math.abs(await page.evaluate(()=>evirStudio.pose().nodes[0].transform[5])-160)<1e-8);
   await page.getByLabel('Playhead',{exact:true}).fill('60');assert.equal(await page.getByLabel('Y',{exact:true}).inputValue(),'100');assert.equal(await page.getByLabel('Frame',{exact:true}).inputValue(),'60');await page.locator('.track-list').scrollIntoViewIfNeeded();
   await page.screenshot({path:`${out}/lesson-${width}.png`});if(width===1440)await page.screenshot({path:'apps/web/assets/learn-bounce.png'});
   const after=await snapshot();await close();const download=page.waitForEvent('download');await press('Export .riv');const bytes=fs.readFileSync(await(await download).path());assert.deepEqual(bytes,Buffer.from(compileProject(after).bytes));
   if(width===1440){fs.writeFileSync(`${out}/studio-bounce.evir-project`,JSON.stringify(after,null,2)+'\n');fs.writeFileSync(`${out}/studio-bounce.riv`,bytes);}
   await page.waitForFunction(()=>document.querySelector('#save-status').textContent==='Saved in this browser');await page.reload();await page.waitForFunction(()=>window.evirStudio);assert.deepEqual((await snapshot()).animations,after.animations);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
   report.viewports.push({width,height,checks:['14 visual presets','invalid draft rejects atomically','cancelled detached handler is inert','focus return','reachable compact sheet actions','zero automated WCAG violations','shape add undo/redo','blank-project lesson end-to-end','three exact keys and unchanged Design pose','numeric frame and scrub synchronization','loop playback','actual native export','local recovery and no overflow']});await context.close();
  }
 });fs.writeFileSync(`${out}/browser.json`,JSON.stringify(report,null,2)+'\n');console.log('Shapes and first animation: four complete responsive creation/animation/export workflows passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
