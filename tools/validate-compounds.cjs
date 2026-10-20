const assert=require('node:assert/strict'),fs=require('node:fs'),{createHash}=require('node:crypto'),{PNG}=require('pngjs');
const{run}=require('./browser.cjs'),gpu=require('./gpu_diagnostics.cjs');
(async()=>{
 await require('./prepare-oracle.cjs').prepare();
 const{createProject}=await import('@evir/project-model'),{SHAPES,addShape}=await import('@evir/authoring'),{compileProject}=await import('@evir/format');
 const out='research/results/software-closure/compounds';fs.mkdirSync(out,{recursive:true});const cases=[];
 const {compoundCases}=await import('../tests/fixtures/compounds.mjs');cases.push(...await compoundCases());
 const hash=b=>createHash('sha256').update(b).digest('hex'),report={checkedAt:new Date().toISOString(),runtimeVersion:'2.44.0',scope:'Cloud Chromium/software rendering, not physical-device performance or human accessibility evidence.',method:'Compound curves, nonzero/evenodd holes, strokes/effects, clipping and shared skin bindings, plus independently encoded native compound import against official Canvas/WebGL2 pixels.',thresholds:{mae:2.5,coverageDifference:350,minimumCoverage:50},fixtures:[],backends:[]};
 for(const c of cases){const source=JSON.stringify(c.p,null,2)+'\n',bytes=compileProject(c.p).bytes;fs.writeFileSync(`${out}/${c.name}-oracle.evir-project`,source);fs.writeFileSync(`${out}/${c.name}-oracle.riv`,c.original??bytes);report.fixtures.push({name:c.name,sourceSha256:hash(source),rivSha256:hash(c.original??bytes)});}
 for(const backend of ['canvas','webgl2']){process.env.RIVE_RENDERER=backend;await run(async(page,browser)=>{
  report.browser=browser.version();await gpu.install(page);await page.reload();const checks=[];
  for(const{name,p}of cases)for(const frame of(p.animations.length?[0,30,60,90,120]:[null])){
   await page.evaluate(async({name,animation,frame,fps})=>{await loadFixture(name,{src:`/research/results/shape-library/${name}-oracle.riv`,autoplay:false,...(animation?{animations:animation}:{})});player.stopRendering();if(animation)player.scrub(animation,frame/fps);player.drawFrame();player.stopRendering();},{name,animation:p.animations[0]?.name,frame,fps:p.animations[0]?.fps});
   const expected=Buffer.from(await page.evaluate(async({p,frame})=>{
    const{CanvasRenderer,evaluate}=await import('/tools/.test-build/oracle.mjs'),c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),a=p.artboards[0],scale=Math.min(256/a.width,256/a.height);ctx.translate((256-a.width*scale)/2,(256-a.height*scale)/2);ctx.scale(scale,scale);
    const r=new CanvasRenderer(ctx);await r.prepare(p);r.draw(evaluate(p,p.animations[0]?.id,frame??0),a.id);r.dispose();const bytes=ctx.getImageData(0,0,256,256).data;let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);
   },{p,frame}),'base64');
   const actual=backend==='canvas'?Buffer.from(await page.evaluate(()=>{const bytes=document.querySelector('#canvas').getContext('2d').getImageData(0,0,256,256).data;let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);}),'base64'):PNG.sync.read(await page.locator('#canvas').screenshot({omitBackground:true})).data;
   assert.equal(actual.length,256*256*4);assert.equal(expected.length,actual.length);let error=0,covered=0,expectedCovered=0;
   for(let i=0;i<actual.length;i++){error+=Math.abs(actual[i]-expected[i]);if(i%4===3){if(actual[i])covered++;if(expected[i])expectedCovered++;}}
   const row={scene:name,frame,mae:error/actual.length,covered,expectedCovered};checks.push(row);assert(covered>50&&expectedCovered>50,'visible geometry');assert(row.mae<2.5,JSON.stringify({backend,...row}));assert(Math.abs(covered-expectedCovered)<350,JSON.stringify({backend,...row}));
  }
  report.backends.push({backend,checks,graphics:await gpu.collect(page)});console.log(`${backend}: ${checks.length} compound native comparisons passed.`);
 });}
 fs.writeFileSync(`${out}/native.json`,JSON.stringify(report,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
