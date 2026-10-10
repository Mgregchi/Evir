const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createHash}=require('node:crypto'),{PNG}=require('pngjs');
const {chromium}=require('playwright'),{run}=require('../../tools/browser.cjs');
const gpu=require('../../tools/gpu_diagnostics.cjs');
if(!process.env.CHROMIUM_PATH && !fs.existsSync('/usr/bin/chromium'))process.env.CHROMIUM_PATH=chromium.executablePath();
(async()=>{
  await require('../../tools/prepare-oracle.cjs').prepare();
  const {exampleIds}=await import('../../apps/web/examples.mjs');
  const report={checkedAt:new Date().toISOString(),runtimeVersion:'2.44.0',scope:'Original showcase export pixels against Evir evaluated source at selected keyframes; boolean/number/AND/trigger/listener/reset outcomes. Cloud graphics, not mobile/device performance.',backends:[]};
  for(const backend of ['canvas','webgl2']) {
    process.env.RIVE_RENDERER=backend;
    await run(async page=>{
      await gpu.install(page);await page.reload();
      const checks=[];
      for(const name of exampleIds) {
        const project=JSON.parse(fs.readFileSync(path.join(__dirname,`../../apps/web/assets/examples/${name}.evir-project`)));
        const load=async options=>{
          const inventory=await page.evaluate(({name,options})=>loadFixture(name,{src:`/apps/web/assets/examples/${name}.riv`,autoplay:false,...options}),{name,options});
          assert.deepEqual(inventory.animations,project.animations.map(a=>a.name));
          assert.deepEqual(inventory.machines,project.machines.map(m=>m.name));
          await page.evaluate(()=>{player.stopRendering();player.drawFrame();});
        };
        const compare=async(animation,frame,label)=>{
          const expected=await page.evaluate(async({project,id,frame})=>{
            const {evaluate}=await import('/tools/.test-build/oracle.mjs'),{drawScene}=await import('/tools/.test-build/oracle.mjs');
            const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.scale(.5,.5);
            drawScene(ctx,evaluate(project,id,frame),project.artboards[0].id,{ignoreEditorState:true});
            return Array.from(c.getContext('2d').getImageData(0,0,256,256).data);
          },{project,id:animation.id,frame});
          const actual=backend==='canvas'?await page.evaluate(()=>Array.from(document.getElementById('canvas').getContext('2d').getImageData(0,0,256,256).data)):
            PNG.sync.read(await page.locator('#canvas').screenshot({omitBackground:true})).data;
          let error=0,expectedCovered=0,runtimeCovered=0;
          for(let i=0;i<actual.length;i+=4){if(expected[i+3])expectedCovered++;if(actual[i+3])runtimeCovered++;for(let j=0;j<4;j++)error+=Math.abs(expected[i+j]-actual[i+j]);}
          const mae=error/actual.length;checks.push({example:name,label,mae,expectedCovered,runtimeCovered});
          assert(mae<2.5,`${backend} ${name} ${label}: MAE ${mae}`);
          assert(Math.abs(expectedCovered-runtimeCovered)<350,`${backend} ${name} ${label}: coverage`);
        };
        for(const animation of project.animations)for(const frame of [0,30,60,90]) {
          await load({animations:animation.name});
          await page.evaluate(({name,seconds})=>{player.scrub(name,seconds);player.drawFrame();},{name:animation.name,seconds:frame/animation.fps});
          await compare(animation,frame,`${animation.name} frame ${frame}`);
        }
        if(project.machines.length) {
          const machine=project.machines[0];await load({stateMachines:machine.name});
          const advance=()=>page.evaluate(()=>{player.stopRendering();player.animator.stateMachines[0].advanceAndApply(0);player.lastRenderTime=document.timeline.currentTime;player.drawFrame();player.stopRendering();});
          const input=async(inputName,value)=>{await page.evaluate(({machineName,inputName,value})=>{const i=player.stateMachineInputs(machineName).find(i=>i.name===inputName);if(i.type===rive.StateMachineInputType.Trigger)i.fire();else i.value=value;},{machineName:machine.name,inputName,value});await advance();};
          await advance();await compare(project.animations[0],0,'machine entry');
          const inputs=await page.evaluate(name=>player.stateMachineInputs(name).map(i=>({name:i.name,type:i.type})),machine.name);
          assert.deepEqual(inputs.map(i=>i.name),machine.inputs.map(i=>i.name));
          if(name==='milo') {
            for(const [value,index] of [[true,1],[false,0]]){await input('isWaving',value);await compare(project.animations[index],0,`isWaving=${value}`);}
          } else if(name==='signal') {
            await input('level',75);await compare(project.animations[0],0,'disabled AND guard');
            await input('enabled',true);await compare(project.animations[1],0,'ready AND conditions');
            await input('level',20);await compare(project.animations[0],0,'number return');
            await input('level',75);await input('celebrate',true);await compare(project.animations[2],0,'trigger celebration');
            await load({stateMachines:machine.name});await advance();await compare(project.animations[0],0,'reset defaults');
            await input('enabled',true);await input('level',75);
            await page.evaluate(()=>{player.play('Flow');player.stopRendering();});
            const rect=await page.locator('#canvas').boundingBox();await page.mouse.click(rect.x+128,rect.y+193);await advance();await compare(project.animations[2],0,'pad click listener');
          } else assert.fail(`Add declared machine-input scenarios for ${name}`);
        }
      }
      report.backends.push({backend,diagnostics:await gpu.collect(page),checks});
      console.log(`${backend}: ${checks.length} showcase keyframe/transition comparisons passed.`);
    });
  }
  report.fixtures=Object.fromEntries(exampleIds.map(name=>[name,createHash('sha256').update(fs.readFileSync(path.join(__dirname,`../../apps/web/assets/examples/${name}.riv`))).digest('hex')]));
  fs.mkdirSync('research/results/public-site',{recursive:true});fs.writeFileSync('research/results/public-site/examples.json',JSON.stringify(report,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
