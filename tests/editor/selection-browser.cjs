const assert=require('node:assert/strict'),fs=require('node:fs');
const {run}=require('../../tools/browser.cjs');
(async()=>{
 const {createProject}=await import('@evir/project-model'),{addNode}=await import('@evir/authoring');
 const source=createProject(),a=addNode(source,'rectangle'),b=addNode(source,'rectangle');
 source.nodes[0].name='Mint';source.nodes[1].name='Peach';source.nodes[0].transform=[1,0,0,1,80,80];source.nodes[1].transform=[1,0,0,1,250,80];
 await run(async page=>{
  await page.setViewportSize({width:1440,height:1000});await page.goto('http://127.0.0.1:8776/apps/web/dist/editor/studio/');await page.waitForFunction(()=>window.evirStudio);
  await page.locator('#file').setInputFiles({name:'selection.evir-project.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(source))});await page.locator('#replace-confirm').click();await page.waitForFunction(id=>evirStudio.snapshot().id===id,source.id);await page.getByRole('button',{name:'Fit',exact:true}).click();
  const snap=()=>page.evaluate(()=>evirStudio.snapshot()),selection=()=>page.evaluate(()=>evirStudio.selections());
  await page.getByRole('button',{name:'Select Mint',exact:true}).click();await page.getByRole('button',{name:'Select Peach',exact:true}).click({modifiers:['Shift']});assert.deepEqual(await selection(),[a,b]);
  const initial=await snap();await page.locator('#stage').focus();await page.keyboard.press('Shift+ArrowRight');assert.deepEqual((await snap()).nodes.map(n=>n.transform[4]),initial.nodes.map(n=>n.transform[4]+10));await page.keyboard.press('Control+z');assert.deepEqual((await snap()).nodes,initial.nodes);
  await page.keyboard.press('Escape');assert.deepEqual(await selection(),[]);
  const screen=async(x,y)=>{const p=await snap(),c=p.editor.cameras[p.artboards[0].id],r=await page.locator('#stage').boundingBox();return [r.x+c.x+x*c.zoom,r.y+c.y+y*c.zoom];};
  await page.mouse.move(...await screen(60,60));await page.mouse.down();await page.mouse.move(...await screen(400,250),{steps:8});await page.mouse.up();assert.deepEqual(await selection(),[a,b]);
  await page.keyboard.down('Shift');await page.mouse.move(...await screen(60,60));await page.mouse.down();await page.mouse.move(...await screen(400,250),{steps:5});await page.mouse.up();await page.keyboard.up('Shift');assert.deepEqual(await selection(),[]);await page.locator('#stage').focus();await page.keyboard.press('Control+a');assert.deepEqual(await selection(),[a,b]);
  // Moving an already selected member preserves the full set and commits one undo step.
  const before=await snap();await page.mouse.move(...await screen(100,100));await page.mouse.down();await page.mouse.move(...await screen(120,130),{steps:5});await page.mouse.up();assert.deepEqual(await selection(),[a,b]);const after=await snap();for(let i=0;i<2;i++){assert(Math.abs(after.nodes[i].transform[4]-before.nodes[i].transform[4]-20)<.1);assert(Math.abs(after.nodes[i].transform[5]-before.nodes[i].transform[5]-30)<.1);}await page.keyboard.press('Control+z');assert.deepEqual((await snap()).nodes,before.nodes);
  await page.getByRole('button',{name:'Select Peach',exact:true}).click();await page.keyboard.press('ArrowDown');assert.equal(await page.getByRole('button',{name:'Select Mint',exact:true}).evaluate(b=>b===document.activeElement),true);
  await page.locator('#stage').focus();await page.keyboard.press('Control+a');const priorDelete=await snap();await page.keyboard.press('Delete');assert.equal((await snap()).nodes.length,0);await page.keyboard.press('Control+z');assert.deepEqual((await snap()).nodes,priorDelete.nodes);
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  const widths=[320,390,768,1100,1440];
  for(const width of widths){await page.setViewportSize({width,height:844});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow ${width}`);const r=await page.locator('#stage').boundingBox();assert(r.width>200&&r.height>180,`usable stage ${width}: ${JSON.stringify(r)}`);
   if(width<=850){await page.locator('#show-layers').click();assert(await page.locator('#mobile-panel .layers').isVisible());await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#mobile-panel').open);assert.equal(await page.locator('#show-layers').evaluate(b=>b===document.activeElement),true);await page.locator('#show-properties').click();assert(await page.locator('#mobile-panel .inspector').isVisible());await page.locator('#close-panel').click();}
   const violations=await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));assert.deepEqual(violations,[],`accessibility ${width}: ${JSON.stringify(violations)}`);
   if(width===390){await page.getByRole('button',{name:'Fit',exact:true}).click();fs.mkdirSync('research/results/experience-quality',{recursive:true});await page.screenshot({path:'research/results/experience-quality/studio-mobile.png'});}
  }
  fs.writeFileSync('research/results/experience-quality/selection.json',JSON.stringify({checkedAt:new Date().toISOString(),widths,flows:['Shift toggle','marquee enclosure and Shift toggle','select all and bulk delete/undo','multiple drag and undo','keyboard nudge and undo','roving Layers focus','mobile dialog Escape and focus restoration'],automatedAccessibilityViolations:0,physicalDeviceMeasurements:false},null,2)+'\n');
 });console.log('Selection, responsive panels and keyboard browser checks passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
