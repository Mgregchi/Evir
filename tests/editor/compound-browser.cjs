const assert=require('node:assert/strict'),fs=require('node:fs');const {run}=require('../../tools/browser.cjs');
(async()=>{
 const {createProject}=await import('@evir/project-model'),{addShape}=await import('@evir/authoring'),{compileProject}=await import('@evir/format');
 const seed=createProject();seed.id='compound-browser';seed.name='Cut a window';seed.artboards[0].width=seed.artboards[0].height=512;
 const outer=addShape(seed,'circle',{name:'Outer',width:240,x:136,y:136}),inner=addShape(seed,'circle',{name:'Inner',width:120,x:196,y:196});
 const out='research/results/software-closure/compounds';fs.mkdirSync(out,{recursive:true});const report={checkedAt:new Date().toISOString(),scope:'Cloud Chromium and automated accessibility; not physical-device/human evidence.',viewports:[]};
 await run(async(initial,browser)=>{
  report.browser=browser.version();
  for(const [width,height]of[[320,844],[390,844],[844,390],[1440,900]]){
   const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],workerRequests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('compound-worker'))workerRequests.push(r.url());});
   const press=name=>require('./actions.cjs').press(page,name),snapshot=()=>page.evaluate(()=>evirStudio.snapshot());
   const close=async()=>{if(await page.locator('#mobile-panel').getAttribute('open')!==null)await page.locator('#close-panel').click();};
   const props=async()=>{if(width<=850){await close();await press('Properties');}};
   const choose=async()=>{if(width<=850){await close();await press('Layers');}await press('Select Outer');await page.locator('#multiple-layers').click();await press('Select Inner');await props();};
   await page.goto('http://127.0.0.1:8776/apps/web/dist/editor/studio/');await page.waitForFunction(()=>window.evirStudio);assert.equal(workerRequests.length,0,'curve worker is absent at startup');
   await page.locator('#file').setInputFiles({name:'compound.evir-project',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(seed))});await page.locator('#replace-confirm').click();await page.waitForFunction(()=>evirStudio.snapshot().id==='compound-browser');
   await choose();assert.equal(await page.evaluate(()=>evirStudio.selections().length),2);await press('Shape operations…');const sheet=page.locator('#advanced-sheet'),apply=sheet.getByRole('button',{name:'Apply',exact:true});assert.equal(await apply.isDisabled(),true);
   await page.getByLabel('Keep appearance',{exact:true}).selectOption(outer);await page.getByLabel('Operation',{exact:true}).selectOption('subtract');await press('Preview result');await page.waitForFunction(()=>document.querySelector('.compound-preview svg'));assert.deepEqual((await snapshot()).nodes,seed.nodes);assert.equal(page.workers().length,0,'finished worker is terminated');
   await page.screenshot({path:`${out}/preview-${width}.png`});await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#advanced-sheet'));assert.deepEqual((await snapshot()).nodes,seed.nodes);
   await press('Shape operations…');await page.getByLabel('Keep appearance',{exact:true}).selectOption(outer);await page.getByLabel('Operation',{exact:true}).selectOption('subtract');await press('Preview result');await page.waitForFunction(()=>document.querySelector('.compound-preview svg'));
   await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});assert.deepEqual(await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))),[]);
   await page.locator('#advanced-sheet > .dialog-actions').getByRole('button',{name:'Apply',exact:true}).scrollIntoViewIfNeeded();const box=await sheet.boundingBox();assert(box.x>=0&&box.x+box.width<=width+1);if(width<=850)assert(Math.abs(box.width-width)<2);
   await page.locator('#advanced-sheet > .dialog-actions').getByRole('button',{name:'Apply',exact:true}).click();await page.waitForFunction(()=>evirStudio.snapshot().nodes.length===1);let after=await snapshot();assert.equal(after.nodes[0].id,outer);assert.equal(after.nodes[0].geometry.contours[0].points.length,4);
   await press('Undo');assert.deepEqual((await snapshot()).nodes,seed.nodes);await press('Redo');assert.deepEqual((await snapshot()).nodes,after.nodes);
   // A real click through the hole must not select the ring.
   await close();await press('Fit');const c=(await snapshot()).editor.cameras[seed.artboards[0].id],stage=await page.locator('#stage').boundingBox();await page.mouse.click(stage.x+c.x+256*c.zoom,stage.y+c.y+256*c.zoom);assert.equal(await page.evaluate(()=>evirStudio.selection()),null);
   if(width<=850)await press('Layers');await press('Select Outer');await props();await page.getByLabel('Contour',{exact:true}).selectOption('1');assert.equal(await page.getByLabel('Control point',{exact:true}).locator('option').count(),4);const point=page.getByLabel('Point X',{exact:true});await point.fill(String(Number(await point.inputValue())+3));await point.press('Tab');after=await snapshot();assert.equal(after.nodes[0].geometry.contours.length,1);
   await close();const downloading=page.waitForEvent('download');await press('Export .riv');const bytes=fs.readFileSync(await(await downloading).path());assert.deepEqual(bytes,Buffer.from(compileProject(after).bytes));
   if(width===1440){fs.writeFileSync(`${out}/studio-compound.evir-project`,JSON.stringify(after,null,2)+'\n');fs.writeFileSync(`${out}/studio-compound.riv`,bytes);}
   await page.waitForFunction(()=>document.querySelector('#save-status').textContent==='Saved in this browser');await page.reload();await page.waitForFunction(()=>window.evirStudio);assert.deepEqual((await snapshot()).nodes,after.nodes);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
   report.viewports.push({width,height,checks:['worker deferred until preview','nondestructive curve preview and cancel','worker terminates','reachable compact sheet','zero automated WCAG violations','subtraction and exact one-step undo/redo','transparent hole hit testing','secondary contour numeric editing','native download equals compiler','durable recovery','no overflow']});await context.close();
  }
 });fs.writeFileSync(`${out}/browser.json`,JSON.stringify(report,null,2)+'\n');console.log('Compound shapes: four responsive preview/cancel/boolean/edit/export/recovery workflows passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
