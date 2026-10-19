const fs=require('node:fs'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{PNG}=require('pngjs');
const{run}=require('./browser.cjs'),gpu=require('./gpu_diagnostics.cjs');
(async()=>{
 await require('./prepare-oracle.cjs').prepare();const{directFixture,nativeDirectFixture}=await import('../tests/fixtures/direct-blends.mjs'),{compileProject}=await import('@evir/format'),{MachinePlayer}=await import('@evir/runtime');
 const out='research/results/direct-blends';fs.mkdirSync(out,{recursive:true});const cases=[];
 for(const fixed of[false,true]){const p=directFixture({fixed}),native=nativeDirectFixture({fixed,omitFixedValue:fixed});cases.push({name:fixed?'independent-fixed':'independent-input',p,bytes:native.bytes});}
 const p=directFixture();cases.push({name:'evir-export',p,bytes:compileProject(p).bytes});
 const color=directFixture();color.name='Color probe';color.nodes[0].geometry.fill='#aa4278cc';for(const[i,a]of color.animations.entries()){a.tracks[0].property='fill';for(const k of a.tracks[0].keys)k.value=i?'#346f5acc':'#c06736ee';}cases.push({name:'color-export',p:color,bytes:compileProject(color).bytes});
 const rotation=directFixture();rotation.name='Rotation probe';for(const[i,a]of rotation.animations.entries()){a.tracks[0].property='rotation';for(const k of a.tracks[0].keys)k.value=i?0:Math.PI*4;}cases.push({name:'rotation-export',p:rotation,bytes:compileProject(rotation).bytes});
 const lumen=JSON.parse(fs.readFileSync('apps/web/assets/examples/lumen.evir-project'));cases.push({name:'lumen',p:lumen,bytes:compileProject(lumen).bytes});
 const studio=`${out}/studio-direct.evir-project`;if(fs.existsSync(studio)){const p=JSON.parse(fs.readFileSync(studio));cases.push({name:'studio-direct',p,bytes:fs.readFileSync(`${out}/studio-direct.riv`)});}else if(process.env.EVIR_DIRECT_ALLOW_NO_STUDIO!=='1')throw Error('Run the direct-blend browser workflow first.');
 const hash=x=>createHash('sha256').update(x).digest('hex'),report={checkedAt:new Date().toISOString(),runtimeVersion:'2.44.0',method:'Paused official state-machine instances advanced exactly once per explicit tick through the pinned research wrapper. Independent native inputs/default fixed-weight records, Evir re-export, color, Lumen and actual Studio edits. Raw RGBA comparison at preset MAE <2.5 and coverage difference <350; nonempty coverage required.',scope:'Cloud software rendering; no physical-device or human evidence. Private pinned-runtime calls are research harness access.',fixtures:[],backends:[]};
 for(const c of cases){const source=JSON.stringify(c.p,null,2)+'\n';fs.writeFileSync(`${out}/${c.name}.evir-project`,source);fs.writeFileSync(`${out}/${c.name}.riv`,c.bytes);report.fixtures.push({name:c.name,sourceSha256:hash(source),rivSha256:hash(c.bytes)});}
 for(const backend of['canvas','webgl2']){process.env.RIVE_RENDERER=backend;await run(async(page,browser)=>{
  report.browser=browser.version();await gpu.install(page);await page.reload();const checks=[];
  for(const c of cases){
   const m=c.p.machines[0],character=c.name==='lumen'||c.name==='studio-direct';
   const sequences=character?[[0,0],[100,0],[0,100],[50,80],[100,100]]:[[100,0],[75,25],[50,50],[0,100],[100,100],[0,0],[-20,150]];
   for(const values of sequences){
    await page.evaluate(async({name,machine,values})=>{await loadFixture(name,{src:`/research/results/direct-blends/${name}.riv`,stateMachines:machine,autoplay:false});player.pause();player.stopRendering();player.animator.stateMachines[0].advanceAndApply(0);player.drawFrame();player.stopRendering();const inputs=player.stateMachineInputs(machine);inputs[0].value=values[0];inputs[1].value=values[1];},{name:c.name,machine:m.name,values});
    const applied=[...values],engine=new MachinePlayer(c.p,m.id);engine.set(m.inputs[0].id,values[0]);engine.set(m.inputs[1].id,values[1]);
    for(const[tick,dt]of(character?[0,.25,.25,.5].entries():[0,0,0,0].entries())){
     if(tick===2&&((character&&values[0]===0&&values[1]===0)||(!character&&values[0]===100&&values[1]===100))){
      applied[0]=0;applied[1]=character?100:0;engine.set(m.inputs[0].id,applied[0]);engine.set(m.inputs[1].id,applied[1]);
      await page.evaluate(({name,values})=>{const inputs=player.stateMachineInputs(name);inputs[0].value=values[0];inputs[1].value=values[1];},{name:m.name,values:applied});
     }
     const pose=engine.advance(dt);await page.evaluate(dt=>{player.animator.stateMachines[0].advanceAndApply(dt);player.drawFrame();player.stopRendering();},dt);
     const expected=Buffer.from(await page.evaluate(async p=>{const{CanvasRenderer}=await import('/tools/.test-build/oracle.mjs');const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.scale(256/p.artboards[0].width,256/p.artboards[0].height);const renderer=new CanvasRenderer(ctx);await renderer.prepare(p);renderer.draw(p,p.artboards[0].id);renderer.dispose();const pixels=ctx.getImageData(0,0,256,256).data;let binary='';for(let i=0;i<pixels.length;i+=8192)binary+=String.fromCharCode(...pixels.subarray(i,i+8192));return btoa(binary);},pose),'base64');
     const actual=backend==='canvas'?Buffer.from(await page.evaluate(()=>{const pixels=document.querySelector('#canvas').getContext('2d').getImageData(0,0,256,256).data;let binary='';for(let i=0;i<pixels.length;i+=8192)binary+=String.fromCharCode(...pixels.subarray(i,i+8192));return btoa(binary);}),'base64'):PNG.sync.read(await page.locator('#canvas').screenshot({omitBackground:true})).data;
     assert.equal(actual.length,256*256*4);assert.equal(expected.length,actual.length);let sum=0,covered=0,expectedCovered=0;for(let i=0;i<actual.length;i++){sum+=Math.abs(actual[i]-expected[i]);if(i%4===3){if(actual[i])covered++;if(expected[i])expectedCovered++;}}
     const row={scene:c.name,inputs:[...applied],tick:tick+1,dt,mae:sum/actual.length,covered,expectedCovered};checks.push(row);assert(covered>1000&&expectedCovered>1000,'visible geometry');assert(row.mae<2.5,JSON.stringify({backend,...row}));assert(Math.abs(covered-expectedCovered)<350,JSON.stringify(row));
    }
   }
   console.log(`${backend}: ${c.name} ordered blend, clock and pixel checks passed.`);
  }
  report.backends.push({backend,checks,graphics:await gpu.collect(page)});
 });}
 fs.writeFileSync(`${out}/native.json`,JSON.stringify(report,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
