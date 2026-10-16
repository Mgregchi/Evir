const assert=require('node:assert/strict'),fs=require('node:fs'),{createHash}=require('node:crypto');
const {run}=require('../../tools/browser.cjs');
(async()=>{
  const {compileProject,importRiv}=await import('@evir/format');
  const source=JSON.parse(fs.readFileSync('apps/web/assets/examples/trace.evir-project'));
  const output='research/results/native-strokes';fs.mkdirSync(output,{recursive:true});
  const report={checkedAt:new Date().toISOString(),scope:'Synthetic cloud Chromium editing, keyboard/pointer, downloads, recovery and automated WCAG checks; not physical or human testing.',viewports:[]};
  await run(async(page,browser)=>{
    report.browser=browser.version();
    const press=name=>require('./actions.cjs').press(page,name),snapshot=()=>page.evaluate(()=>evirStudio.snapshot());
    for(const [width,height] of [[320,844],[390,844],[844,390],[1024,844],[1440,900]]){
      await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:'reduce'});
      await page.goto('http://127.0.0.1:8776/apps/web/dist/editor/studio/');await page.waitForFunction(()=>window.evirStudio);
      await page.locator('#file').setInputFiles('apps/web/assets/examples/trace.evir-project');await page.locator('#replace-confirm').click();
      await page.waitForFunction(()=>evirStudio.snapshot().id==='trace-project');
      if(width<=850)await press('Layers');await press('Select flight trail');
      if(width<=850){await page.keyboard.press('Escape');await press('Properties');}
      await press('Edit stroke');const before=(await snapshot()).nodes;
      assert.equal(await page.getByLabel('Stroke width',{exact:true}).evaluate(el=>el===document.activeElement),true);
      await page.getByLabel('Stroke width',{exact:true}).fill('');await press('Apply stroke');
      assert.match(await page.locator('#stroke-error').innerText(),/number/);assert.deepEqual((await snapshot()).nodes,before);
      await page.getByLabel('Stroke width',{exact:true}).fill('12');
      await page.getByLabel('Dash and gap lengths',{exact:true}).fill('18');await press('Apply stroke');
      assert.match(await page.locator('#stroke-error').innerText(),/paired/);assert.deepEqual((await snapshot()).nodes,before);
      await page.getByLabel('Dash and gap lengths',{exact:true}).fill('18, 10');
      await page.getByLabel('Stroke cap',{exact:true}).selectOption('square');await page.getByLabel('Stroke join',{exact:true}).selectOption('bevel');
      await page.getByLabel('Trim start',{exact:true}).fill('.1');await page.getByLabel('Trim end',{exact:true}).fill('.7');
      await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
      const violations=await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));
      assert.deepEqual(violations,[]);
      await page.getByRole('button',{name:'Apply stroke',exact:true}).scrollIntoViewIfNeeded();
      const action=await page.getByRole('button',{name:'Apply stroke',exact:true}).boundingBox();assert(action.y>=0&&action.y+action.height<=height);
      const sheet=await page.locator('#stroke-sheet').boundingBox();assert(sheet.x>=0&&sheet.x+sheet.width<=width+1);
      if(width<=850)assert.equal(Math.round(sheet.width),width);
      await page.screenshot({path:`${output}/stroke-sheet-${width}.png`});
      await press('Apply stroke');const after=await snapshot(),stroke=after.nodes.find(n=>n.id==='trace-flight-trail').geometry.stroke;
      assert.equal(stroke.width,12);assert.equal(stroke.cap,'square');assert.equal(stroke.join,'bevel');assert.deepEqual(stroke.dash,[18,10]);
      if(width<=850)await page.keyboard.press('Escape');await press('Undo');assert.deepEqual((await snapshot()).nodes,before);
      await press('Redo');assert.deepEqual((await snapshot()).nodes,after.nodes);
      if(width<=850)await press('Properties');await press('Edit stroke');
      await page.getByLabel('Stroke width',{exact:true}).fill('90');await page.keyboard.press('Escape');assert.deepEqual((await snapshot()).nodes,after.nodes);
      assert.equal(await page.getByRole('button',{name:'Edit stroke',exact:true}).evaluate(el=>el===document.activeElement),true);
      await press('Edit stroke');await press('Remove stroke');assert.match(await page.locator('#stroke-error').innerText(),/fill/);await press('Cancel stroke');
      if(width<=850)await page.keyboard.press('Escape');
      const download=page.waitForEvent('download');await press('Export .riv');const file=await download,bytes=fs.readFileSync(await file.path());
      assert.deepEqual(bytes,Buffer.from(compileProject(await snapshot()).bytes));
      if(width===1440){fs.writeFileSync(`${output}/studio-stroke.evir-project`,JSON.stringify(await snapshot(),null,2)+'\n');fs.writeFileSync(`${output}/studio-stroke.riv`,bytes);}
      // The saved source recovers native paints; binary import stays editable.
      await page.reload();await page.waitForFunction(()=>window.evirStudio);assert.deepEqual((await snapshot()).nodes,after.nodes);
      await page.locator('#file').setInputFiles('apps/web/assets/examples/trace.riv');await page.locator('#replace-confirm').click();
      await page.waitForFunction(()=>evirStudio.snapshot().name==='Imported Rive scene');
      assert.equal((await snapshot()).nodes.filter(n=>n.geometry?.stroke).length,source.nodes.filter(n=>n.geometry?.stroke).length);
      assert.equal(await page.locator('#riv-viewer').count(),0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      report.viewports.push({width,height,checks:['isolated stroke draft','invalid-number/dash rejection','reachable full-width sheet','focus/escape/cancel','single undo and redo','native download','browser recovery','editable .riv import','zero automated WCAG violations','no page overflow']});
    }
    // Direct stage selection follows the stroke envelope, without filling its interior.
    await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:8776/apps/web/dist/editor/studio/');await page.waitForFunction(()=>window.evirStudio);
    const {createProject}=await import('@evir/project-model'),{addNode}=await import('@evir/authoring');const empty=createProject();empty.name='Stroke drawing';empty.id='stroke-drawing-project';
    await page.locator('#file').setInputFiles({name:'draw.evir-project',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(empty))});await page.locator('#replace-confirm').click();
    await page.waitForFunction(()=>evirStudio.snapshot().id==='stroke-drawing-project');await page.locator('#stage').click({position:{x:20,y:20}});await press('Freehand');await press('Drawing options');await page.getByLabel('Draw as',{exact:true}).selectOption('stroke');
    await page.getByLabel('Width (local units)',{exact:true}).fill('24');await press('Apply drawing options');
    const c=await page.evaluate(()=>{const p=evirStudio.snapshot();return p.editor.cameras[p.artboards[0].id];}),r=await page.locator('#stage').boundingBox();
    const screen=(x,y)=>({x:r.x+c.x+x*c.zoom,y:r.y+c.y+y*c.zoom});const start=screen(130,180),end=screen(390,180);
    await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:20});await page.mouse.up();await press('Finish path');
    const drawn=await snapshot();assert.equal(drawn.nodes.length,1);assert.equal(drawn.nodes[0].geometry.fill,null);assert.equal(drawn.nodes[0].geometry.stroke.width,24);assert.equal(drawn.nodes[0].geometry.closed,false);
    await press('Undo');assert.equal((await snapshot()).nodes.length,0);await press('Redo');assert.equal((await snapshot()).nodes.length,1);
    await page.screenshot({path:`${output}/centerline-drawing-1440.png`});
    // A point within the paint width selects this open line through hit testing.
    const point=screen(240,187);await page.mouse.click(point.x,point.y);assert.equal(await page.getByRole('button',{name:'Edit stroke',exact:true}).count(),1);
    await press('Edit stroke');await page.getByLabel('Stroke width',{exact:true}).fill('40');await press('Apply stroke');assert.equal((await snapshot()).nodes[0].geometry.stroke.width,40);
    await press('Edit fill');await press('Apply fill');assert.equal(typeof (await snapshot()).nodes[0].geometry.fill,'string');
    await press('Edit stroke');await press('Remove stroke');assert.equal((await snapshot()).nodes[0].geometry.stroke,undefined);await press('Undo');assert.equal((await snapshot()).nodes[0].geometry.stroke.width,40);
    report.freehand=['constant-width retained centerline','mouse capture','one-step undo/redo','stroke envelope hit selection','width editable after finishing'];
  });
  fs.writeFileSync(`${output}/browser.json`,JSON.stringify(report,null,2)+'\n');console.log('Native stroke editing: five viewport sizes, recovery, binary import and freehand centerlines passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
