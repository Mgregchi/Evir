const assert=require('node:assert/strict'),fs=require('node:fs');
const {run}=require('../../tools/browser.cjs');
(async()=>{
 const {joinPaths}=await import('@evir/authoring'),{compileProject}=await import('@evir/format');
 const seed=JSON.parse(fs.readFileSync('apps/web/assets/examples/outing-start.evir-project'));
 const recipe=JSON.parse(fs.readFileSync('apps/web/assets/examples/outing.joining.json'));
 const out='research/results/path-joining';fs.mkdirSync(out,{recursive:true});
 const report={checkedAt:new Date().toISOString(),scope:'Cloud Chromium editing, geometry preview, source recovery, downloads and automated accessibility; not physical-device or human evidence.',viewports:[]};
 await run(async(page,browser)=>{
  report.browser=browser.version();const press=name=>require('./actions.cjs').press(page,name),snapshot=()=>page.evaluate(()=>evirStudio.snapshot());
  for(const [width,height]of[[320,844],[390,844],[844,390],[1440,900]]) {
   await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:'reduce'});
   await page.goto('http://127.0.0.1:8776/apps/web/dist/editor/studio/');await page.waitForFunction(()=>window.evirStudio);
   await page.locator('#file').setInputFiles('apps/web/assets/examples/outing-start.evir-project');await page.locator('#replace-confirm').click();
   await page.waitForFunction(()=>evirStudio.snapshot().id==='outing-project');
   const open=async()=>{
    if(width<=850)await press('Layers');await press('Select kite string');
    if(width<=850){await page.keyboard.press('Escape');await press('Properties');}
    await press('Join paths…');
   };
   await open();const before=await snapshot();
   assert.equal(await page.getByLabel('Other path',{exact:true}).inputValue(),recipe.otherId);
   assert.equal(await page.locator('#advanced-sheet h2').evaluate(el=>el===document.activeElement),true);
   await page.screenshot({path:`${out}/join-overview-${width}.png`});
   assert.equal(await page.locator('.path-join-preview svg').count(),1);
   assert.equal(await page.locator('.path-join-preview svg circle').count(),1);assert.equal(await page.locator('.path-join-preview svg rect').count(),1);
   assert.match(await page.locator('.path-join-preview').innerText(),/Circle: kept endpoint. Square: other endpoint./);
   for(const first of['first','last'])for(const second of['first','last']){
    await page.getByLabel('Kept endpoint',{exact:true}).selectOption(first);await page.getByLabel('Other endpoint',{exact:true}).selectOption(second);
    assert.match(await page.locator('[data-join-status]').innerText(),/4 points/);assert.deepEqual((await snapshot()).nodes,before.nodes);
   }
   await page.keyboard.press('Escape');assert.deepEqual((await snapshot()).nodes,before.nodes);
   assert.equal(await page.getByRole('button',{name:'Join paths…',exact:true}).evaluate(el=>el===document.activeElement),true);
   await press('Join paths…');await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
   const violations=await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));
   assert.deepEqual(violations,[]);
   const apply=page.locator('#advanced-sheet').getByRole('button',{name:'Apply',exact:true});await apply.scrollIntoViewIfNeeded();
   const bounds=await apply.boundingBox(),sheet=await page.locator('#advanced-sheet').boundingBox();assert(bounds.y>=0&&bounds.y+bounds.height<=height);assert(sheet.x>=0&&sheet.x+sheet.width<=width+1);
   if(width<=850)assert(Math.abs(sheet.width-width)<2);
   await page.screenshot({path:`${out}/join-sheet-${width}.png`});await apply.click();
   const after=await snapshot(),expected=structuredClone(before);joinPaths(expected,recipe.keepId,recipe.otherId,recipe.options);
   assert.equal(await page.locator('#notice').getAttribute('data-kind'),'success');
   assert.deepEqual(after.nodes,expected.nodes);assert.deepEqual(after.animations,before.animations);assert(!after.nodes.some(n=>n.id===recipe.otherId));
   await page.waitForFunction(()=>document.activeElement===document.querySelector('#stage'));
   await press('Fit');await page.screenshot({path:`${out}/joined-${width}.png`});
   await press('Undo');assert.deepEqual((await snapshot()).nodes,before.nodes);await press('Redo');assert.deepEqual((await snapshot()).nodes,after.nodes);
   const download=page.waitForEvent('download');await press('Export .riv');const bytes=fs.readFileSync(await(await download).path());assert.deepEqual(bytes,Buffer.from(compileProject(await snapshot()).bytes));
   if(width===1440){fs.writeFileSync(`${out}/studio-joined.evir-project`,JSON.stringify(await snapshot(),null,2)+'\n');fs.writeFileSync(`${out}/studio-joined.riv`,bytes);}
   await page.reload();await page.waitForFunction(()=>window.evirStudio);assert.deepEqual((await snapshot()).nodes,after.nodes);assert.equal(await page.locator('#advanced-sheet').count(),0);
   // Reloaded history is intentionally empty: load the seed for a separate merge edit.
   assert.equal(await page.getByRole('button',{name:'Undo',exact:true}).isDisabled(),true);
   await page.locator('#file').setInputFiles('apps/web/assets/examples/outing-start.evir-project');await page.locator('#replace-confirm').click();await page.waitForFunction(()=>evirStudio.snapshot().nodes.some(n=>n.id==='outing-upper-string'));
   await open();await page.getByLabel('Connection',{exact:true}).selectOption('merge');const mergeBefore=await snapshot();
   assert.match(await page.locator('[data-join-status]').innerText(),/3 points/);assert.deepEqual(mergeBefore.nodes,seed.nodes);
   await page.locator('#advanced-sheet').getByRole('button',{name:'Apply',exact:true}).click();
   const merged=await snapshot(),mergeExpected=structuredClone(mergeBefore);joinPaths(mergeExpected,recipe.keepId,recipe.otherId,{mode:'merge'});assert.deepEqual(merged.nodes,mergeExpected.nodes);
   if(width===1440){
    const mergedDownload=page.waitForEvent('download');await press('Export .riv');const mergedBytes=fs.readFileSync(await(await mergedDownload).path());
    assert.deepEqual(mergedBytes,Buffer.from(compileProject(merged).bytes));
    fs.writeFileSync(`${out}/studio-merged.evir-project`,JSON.stringify(merged,null,2)+'\n');fs.writeFileSync(`${out}/studio-merged.riv`,mergedBytes);
   }
   await press('Undo');assert.deepEqual((await snapshot()).nodes,seed.nodes);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   report.viewports.push({width,height,checks:['all endpoint pairings preview without mutation','cancel and focus return','reachable bottom sheet','zero automated WCAG violations','bridge geometry and one-step history','merge geometry and one-step history','source animation retained','actual native download','durable recovery excludes sheet','no page overflow']});
  }
  const load=async(p)=>{
   await page.locator('#file').setInputFiles({name:'join.evir-project',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});await page.locator('#replace-confirm').click();
   await page.waitForFunction(()=>evirStudio.snapshot().nodes.some(n=>n.id==='outing-upper-string'));
  };
  const invalid=structuredClone(seed);invalid.nodes.find(n=>n.id===recipe.otherId).geometry.fill='#ffffff';await load(invalid);await press('Select kite string');await press('Join paths…');
  assert.match(await page.locator('[data-join-status]').innerText(),/same solid fill/);assert.equal(await page.locator('.path-join-preview svg').count(),0);
  const badBefore=await snapshot();await page.locator('#advanced-sheet').getByRole('button',{name:'Apply',exact:true}).click();
  assert.match(await page.locator('#advanced-sheet [role=alert]').innerText(),/same solid fill/);assert.deepEqual((await snapshot()).nodes,badBefore.nodes);await press('Cancel');
  await load(seed);await press('Select kite string');await page.getByRole('button',{name:'Select upper string',exact:true}).click({modifiers:['Shift']});
  assert.equal((await page.evaluate(()=>evirStudio.selections())).length,2);await press('Join paths…');assert.equal(await page.getByLabel('Other path',{exact:true}).inputValue(),recipe.otherId);await press('Cancel');
  // Deliberately inject a background selection event to test stale-review
  // defense; this is not a user gesture through the modal or a Live pairing.
  await press('Join paths…');
  await page.getByRole('button',{name:'Select upper string',exact:true}).evaluate(el=>el.click());
  const latest=await snapshot();await page.locator('#advanced-sheet').getByRole('button',{name:'Apply',exact:true}).click();
  assert.match(await page.locator('#advanced-sheet [role=alert]').innerText(),/project or selection changed/);assert.deepEqual((await snapshot()).nodes,latest.nodes);await press('Cancel');
  await press('Select kite string');await press('Join paths…');const detached=await page.locator('#advanced-sheet').getByRole('button',{name:'Apply',exact:true}).elementHandle();await page.keyboard.press('Escape');
  await detached.evaluate(el=>el.click());assert.deepEqual((await snapshot()).nodes,seed.nodes);await detached.dispose();
  report.guards=['incompatible paint rejected without mutation','two selected paths use explicit kept/other identities','programmatically changed background selection rejects stale Apply','detached Apply callback after Cancel cannot edit'];
 });
 fs.writeFileSync(`${out}/browser.json`,JSON.stringify(report,null,2)+'\n');console.log('Path joining: four responsive workflows, preview, bridge/merge, history, export and recovery passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
