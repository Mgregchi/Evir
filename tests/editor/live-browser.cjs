const assert=require('node:assert/strict'),fs=require('node:fs');
const {run}=require('../../tools/browser.cjs');
(async()=>{
 const evidence='research/results/commands';fs.mkdirSync(evidence,{recursive:true});const report={checkedAt:new Date().toISOString(),widths:[390,1440],scope:'Chromium software automation; physical tests postponed. No human, screen-reader, remote pairing or model-client claim.',checks:[]};
 await run(async(page,browser)=>{
  report.browserVersion=browser.version();
  for(const width of report.widths){
   await page.setViewportSize({width,height:844});await page.goto('http://127.0.0.1:8776/apps/web/dist/editor/studio/');await page.waitForFunction(()=>window.evirStudio);
   const before=await page.evaluate(()=>evirStudio.snapshot());
   assert.equal(await page.evaluate(()=>{try{evirStudio.live.inspect();return false;}catch{return true;}}),true,'No self-grant API');
   await page.getByRole('button',{name:'Project menu',exact:true}).click();await page.getByRole('button',{name:'Live tools…',exact:true}).click();
   await page.getByRole('button',{name:'Grant local access',exact:true}).click();await page.waitForFunction(()=>evirStudio.live.inspect().revision===0);
   await page.getByRole('button',{name:'Add compass lesson',exact:true}).click();await page.waitForFunction(()=>evirStudio.live.inspect().controls.length===1&&evirStudio.live.inspect().cue.ready);
   const added=await page.evaluate(()=>evirStudio.snapshot());assert.equal(added.nodes.length,before.nodes.length+18);assert.equal(added.animations.length,before.animations.length+1);assert.deepEqual(added.editor,before.editor);
   assert.equal(await page.getByLabel('Allow preview motion',{exact:true}).isChecked(),false);
   await page.getByLabel('Allow preview motion',{exact:true}).check();await page.getByRole('button',{name:'Play preview',exact:true}).click();await page.waitForFunction(()=>evirStudio.live.inspect().cue.ready);
   await page.getByLabel('Pointer speed',{exact:true}).fill('2');await page.getByLabel('Pointer speed',{exact:true}).dispatchEvent('change');await page.waitForFunction(()=>evirStudio.live.inspect().controls[0].value===2);
   await page.getByRole('button',{name:'Pause preview',exact:true}).click();await page.waitForFunction(()=>evirStudio.live.inspect().cue.ready);assert.deepEqual(await page.evaluate(()=>evirStudio.snapshot()),added);
   const stale=await page.evaluate(()=>{const info=evirStudio.live.inspect();return {schemaVersion:1,context:info.context,requestId:'stale',expectedRevision:info.revision,operation:'control',payload:{controlId:info.controls[0].id,value:1}};});
   const result=await page.evaluate(()=>{const info=evirStudio.live.inspect();return evirStudio.live.execute({schemaVersion:1,context:info.context,requestId:'typed-range',expectedRevision:info.revision,operation:'control',payload:{controlId:info.controls[0].id,value:.3}});});assert.equal(result.ok,false);assert.match(await page.locator('.live-command-result').innerText(),/range/);
   await page.getByLabel('Command envelope',{exact:true}).fill(JSON.stringify({...stale,context:{...stale.context,projectId:'wrong'}}));await page.getByRole('button',{name:'Run command',exact:true}).click();assert.match(await page.locator('.live-command-result').innerText(),/SCOPE/);
   await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});assert.deepEqual(await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))),[]);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.locator('.live-command-result').evaluate(n=>n.textContent='');await page.screenshot({path:`${evidence}/live-${width}.png`,animations:'disabled'});
   await page.getByRole('button',{name:'Stop local access',exact:true}).click();assert.equal(await page.evaluate(()=>{try{evirStudio.live.inspect();return false;}catch{return true;}}),true);
   await page.getByRole('button',{name:'Close live tools',exact:true}).click();await page.keyboard.press('Escape');await page.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await page.evaluate(()=>evirStudio.snapshot()),before,'One undo for the whole scene');
   await page.getByRole('button',{name:'Project menu',exact:true}).click();await page.getByRole('button',{name:'Live tools…',exact:true}).click();await page.getByRole('button',{name:'Grant local access',exact:true}).click();
   await page.getByRole('button',{name:'Close live tools',exact:true}).click();assert.equal(await page.evaluate(()=>{try{evirStudio.live.execute({});return false;}catch{return true;}}),true,'Closing revokes mutation access');
  }
  report.checks=['explicit local grant and Stop','command-authored compass with typed speed control','motion opt-in and pause','source/presentation isolation','invalid type/range/context rejection','rendered visual-ready cues','one-step shared Undo','closing revokes access','no page overflow','zero automated accessibility violations'];
 });fs.writeFileSync(`${evidence}/browser.json`,JSON.stringify(report,null,2)+'\n');console.log('Local live tools: two widths, consent, typed controls, readiness, undo and automated accessibility passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
