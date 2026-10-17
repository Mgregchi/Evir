const assert=require('node:assert/strict'),fs=require('node:fs');
const {run}=require('../../tools/browser.cjs');
(async()=>{
 const {compileProject}=await import('@evir/format'),{geometryCases}=await import('../fixtures/import-geometry.mjs'),{encodeRecords}=await import('../fixtures/riv-records.mjs');
 const out='research/results/import-geometry';fs.mkdirSync(out,{recursive:true});
 const unsupported=geometryCases().find(c=>c.name==='import-ellipse-centered').records;
 unsupported.push({type:'LinearAnimation',fields:{name:'Reshape',fps:60,duration:60}},{type:'KeyedObject',fields:{objectId:2}},{type:'KeyedProperty',fields:{propertyKey:20}},{type:'KeyFrameDouble',fields:{frame:0,value:100}});
 const report={checkedAt:new Date().toISOString(),scope:'Cloud Chromium automation; no physical or moderated-user evidence.',viewports:[]};
 await run(async(page,browser)=>{
  report.browser=browser.version();const press=name=>require('./actions.cjs').press(page,name),snapshot=()=>page.evaluate(()=>evirStudio.snapshot());
  for(const width of [390,1440]){
   await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('http://127.0.0.1:8776/apps/web/dist/editor/studio/');await page.waitForFunction(()=>window.evirStudio);
   await page.locator('#file').setInputFiles('apps/web/assets/examples/tide-native.riv');await page.locator('#replace-confirm').click();await page.waitForFunction(()=>evirStudio.snapshot().nodes.some(n=>n.name==='soft silhouette'));
   await press('Fit');await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const imported=await snapshot();assert.equal(imported.nodes.length,34);assert.equal(imported.assets.length,0);assert.equal(imported.animations[0].name,'Shore hello');
   const body=imported.nodes.find(n=>n.name==='soft silhouette');assert.equal(body.kind,'path');assert.equal(body.geometry.points.length,6);assert.equal(imported.nodes.find(n=>n.name==='muzzle').geometry.points.length,4);
   if(width<850)await press('Layers');await press('Select soft silhouette');if(width<850){await page.keyboard.press('Escape');await press('Properties');}await press('Edit points');
   const field=page.getByLabel('Point X',{exact:true}),x=Number(await field.inputValue());await field.fill(String(x+3));await field.press('Tab');assert.equal((await snapshot()).nodes.find(n=>n.name==='soft silhouette').geometry.points[0].anchor[0],x+3);
   if(width<850)await page.keyboard.press('Escape');await press('Undo');assert.deepEqual((await snapshot()).nodes,imported.nodes);await press('Redo');assert.equal((await snapshot()).nodes.find(n=>n.name==='soft silhouette').geometry.points[0].anchor[0],x+3);await press('Undo');
   await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});assert.deepEqual(await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations.map(v=>v.id)),[]);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`${out}/studio-tide-${width}.png`,animations:'disabled'});
   const download=page.waitForEvent('download');await press('Export .riv');assert.deepEqual(fs.readFileSync(await(await download).path()),Buffer.from(compileProject(await snapshot()).bytes));
   await press('Animate');if(width<850)await press('Timeline');await page.getByLabel('Playhead',{exact:true}).fill('60');assert.equal(await page.locator('#frame-label').innerText(),'60f');if(width<850)await page.keyboard.press('Escape');await press('Design');
   const before=await snapshot();await page.locator('#file').setInputFiles({name:'animated-ellipse.riv',mimeType:'application/octet-stream',buffer:Buffer.from(encodeRecords(unsupported))});await page.locator('#riv-import-sheet').waitFor();assert.match(await page.locator('#riv-import-sheet').innerText(),/animated contour geometry/);assert.deepEqual(await snapshot(),before);
   await page.screenshot({path:`${out}/unsupported-geometry-${width}.png`,animations:'disabled'});await page.getByRole('button',{name:'Back to Studio',exact:true}).click();assert.deepEqual(await snapshot(),before);
   await page.reload();await page.waitForFunction(()=>window.evirStudio);assert.deepEqual(JSON.parse(JSON.stringify((await snapshot()).nodes)),JSON.parse(JSON.stringify(imported.nodes)));
   report.viewports.push({width,checks:['native sample imports into 34 editable layers','ellipse and mixed vertex controls','numeric point edit and undo/redo','native export equals compiler bytes','named animation scrub','unsupported geometry retains source and offers original viewing','browser recovery','no overflow','zero automated WCAG violations']});
  }
 });fs.writeFileSync(`${out}/browser.json`,JSON.stringify(report,null,2)+'\n');console.log('Editable contour import: native scene, point editing, motion, export, recovery and unsupported-geometry feedback passed at two widths.');
})().catch(e=>{console.error(e);process.exitCode=1;});
