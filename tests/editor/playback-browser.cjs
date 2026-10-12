const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {run}=require('../../tools/browser.cjs');
const {press}=require('./actions.cjs');
(async()=>{
  const {createProject}=await import('@evir/project-model'),{addNode,createAnimation,setKey}=await import('@evir/authoring');
  const p=createProject();p.id='playback-controls-project';p.name='Playback controls';p.artboards[0].width=p.artboards[0].height=256;
  const n=addNode(p);p.nodes[0].transform=[1,0,0,1,100,100];
  const a=createAnimation(p,p.artboards[0].id),b=createAnimation(p,p.artboards[0].id);
  p.animations[0].name='Wheel';p.animations[0].duration=60;p.animations[1].name='Suspension';p.animations[1].duration=60;
  setKey(p,a,n,'rotation',0,0);setKey(p,a,n,'rotation',60,Math.PI*2);setKey(p,b,n,'y',0,100);setKey(p,b,n,'y',30,70);setKey(p,b,n,'y',60,100);
  const fixture='/tmp/evir-playback-controls.evir-project';fs.writeFileSync(fixture,JSON.stringify(p));
  const evidence='research/results/playback';fs.mkdirSync(evidence,{recursive:true});const report={checkedAt:new Date().toISOString(),widths:[390,1440],checks:[],scope:'Chromium automation; not physical-device or human accessibility evidence'};
  await run(async(page,browser)=>{
    report.browserVersion=browser.version();
    for(const width of report.widths){
      await page.setViewportSize({width,height:844});await page.goto('http://127.0.0.1:8776/apps/web/dist/editor/studio/');await page.waitForFunction(()=>window.evirStudio);
      await page.locator('#file').setInputFiles(fixture);await page.locator('#replace-confirm').click();await page.waitForFunction(()=>evirStudio.snapshot().id==='playback-controls-project');
      await press(page,'Animate');
      if(width<850)await press(page,'Timeline');
      const settings=async(mode,repeat,count,speed)=>{
        await press(page,'Playback settings…');await page.getByLabel('Playback mode',{exact:true}).selectOption(mode);
        if(mode!=='once'){await page.getByLabel('Repeat',{exact:true}).selectOption(repeat);if(repeat==='count')await page.getByLabel('Repeat cycles',{exact:true}).fill(String(count));}
        await page.getByLabel('Playback speed',{exact:true}).fill(String(speed));await page.locator('#advanced-sheet').getByRole('button',{name:'Apply',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#advanced-sheet'));
      };
      await settings('loop','count',2,16);assert.deepEqual(await page.evaluate(()=>evirStudio.snapshot().animations[0].playback),{mode:'loop',iterations:2,speed:16});
      await press(page,'Play');await page.waitForFunction(()=>document.querySelector('#frame-label')?.textContent==='60f');
      assert.equal(await page.getByRole('button',{name:'Play',exact:true}).count(),1,'completion updates Play button');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'timeline-play','completion preserves keyboard focus');
      await settings('ping-pong','count',1,4);await page.getByLabel('Playhead',{exact:true}).fill('0');await press(page,'Play');
      await page.waitForFunction(()=>document.querySelector('#frame-label')?.textContent==='0f'&&[...document.querySelectorAll('button')].some(b=>b.textContent==='Play'));
      await settings('once',null,null,4);await press(page,'Play');await page.waitForFunction(()=>document.querySelector('#frame-label')?.textContent==='60f');
      await settings('loop','continuous',null,1);await page.getByLabel('Playhead',{exact:true}).fill('60');assert.equal(await page.locator('#frame-label').innerText(),'60f');
      await press(page,'Playback settings…');await page.getByLabel('Repeat',{exact:true}).selectOption('count');await page.getByLabel('Repeat cycles',{exact:true}).fill('0');await page.locator('#advanced-sheet').getByRole('button',{name:'Apply',exact:true}).click();assert.match(await page.locator('#advanced-sheet [role=alert]').innerText(),/Fixed count/);await page.locator('#advanced-sheet').getByRole('button',{name:'Cancel',exact:true}).click();
      await press(page,'Preview layers…');await page.locator('#advanced-sheet').getByLabel('Suspension',{exact:true}).check();await page.getByLabel('Suspension layer speed',{exact:true}).fill('.5');
      await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});assert.deepEqual(await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.map(v=>v.id)),[]);
      await page.screenshot({path:`${evidence}/layers-${width}.png`,animations:'disabled'});await page.locator('#advanced-sheet').getByRole('button',{name:'Apply',exact:true}).click();
      assert.equal(await page.evaluate(()=>Object.hasOwn(evirStudio.snapshot().editor,'previewLayers')),false);
      await press(page,'Play');await page.waitForFunction(()=>parseInt(document.querySelector('#frame-label').textContent)>0);await press(page,'Pause');
      // A lifecycle handler may resume within a frame whose RAF timestamp is
      // slightly older than performance.now(); it must preserve playback.
      await page.evaluate(()=>{window.playbackNativeRAF=window.requestAnimationFrame;window.playbackCallbacks=[];window.requestAnimationFrame=cb=>{playbackCallbacks.push(cb);return 123456789;};});
      await press(page,'Play');await page.evaluate(()=>playbackCallbacks[0](performance.now()-100));
      assert.equal(await page.getByRole('button',{name:'Pause',exact:true}).count(),1,'older RAF timestamp cannot stop playback');
      await page.evaluate(()=>{window.requestAnimationFrame=playbackNativeRAF;delete window.playbackNativeRAF;delete window.playbackCallbacks;});await press(page,'Pause');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await press(page,'Playback settings…');await page.getByLabel('Playback mode',{exact:true}).selectOption('ping-pong');await page.getByLabel('Repeat',{exact:true}).selectOption('count');await page.getByLabel('Repeat cycles',{exact:true}).fill('3');
      await page.screenshot({path:`${evidence}/settings-${width}.png`,animations:'disabled'});
      assert.deepEqual(await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.map(v=>v.id)),[]);
      await page.locator('#advanced-sheet').getByRole('button',{name:'Cancel',exact:true}).click();
      if(width>=850){
        await press(page,'Select Rectangle');
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        await page.getByLabel('Playhead',{exact:true}).fill('0');
        const before=await page.evaluate(()=>({pose:evirStudio.pose(),source:evirStudio.snapshot()})),node=before.pose.nodes[0];
        const camera=before.source.editor.cameras[before.source.artboards[0].id],stage=await page.locator('#stage').boundingBox();
        const x=stage.x+camera.x+(node.transform[4]+50)*camera.zoom,y=stage.y+camera.y+(node.transform[5]+40)*camera.zoom;
        await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+20*camera.zoom,y,{steps:4});
        const moved=await page.evaluate(()=>({pose:evirStudio.pose().nodes[0],selection:evirStudio.selection(),notice:document.querySelector('#notice').textContent}));
        assert(moved.pose.transform[4]>node.transform[4]+5,'uncommitted animation-key drag appears immediately in the composed pose');
        await page.keyboard.press('Escape');await page.mouse.up();assert.equal(await page.evaluate(()=>evirStudio.pose().nodes[0].transform[4]),node.transform[4]);
      }
      report.checks.push({width,checks:['counted completion/restart','completion preserves focus','ping-pong forward/back completion','one-shot endpoint','loop endpoint scrubbing','invalid fixed count keeps sheet','independent preview layers','preview preferences excluded from project','older resumed RAF timestamps preserve playback','zero automated sheet accessibility violations','no horizontal page overflow',...(width>=850?['provisional key drag renders and cancels']:[])]});
    }
  });fs.writeFileSync(`${evidence}/studio.json`,JSON.stringify(report,null,2)+'\n');console.log('Playback sheets and independent layers: mobile/desktop passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
