const fs=require('node:fs'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{PNG}=require('pngjs');
const {run}=require('./browser.cjs'),gpu=require('./gpu_diagnostics.cjs');
(async()=>{
 await require('./prepare-oracle.cjs').prepare();const {compileProject}=await import('@evir/format');
 const out='research/results/path-joining';fs.mkdirSync(out,{recursive:true});const cases=[];
 for(const[name,file]of[['outing','apps/web/assets/examples/outing.evir-project'],['outing-start','apps/web/assets/examples/outing-start.evir-project'],['studio-joined',`${out}/studio-joined.evir-project`],['studio-merged',`${out}/studio-merged.evir-project`]]) {
  if(!fs.existsSync(file))throw Error('Run the path-joining browser workflow first: '+file);
  const p=JSON.parse(fs.readFileSync(file));cases.push({name,p});const rest=structuredClone(p);rest.animations=[];rest.machines=[];cases.push({name:name+'-rest',p:rest});
 }
 const report={checkedAt:new Date().toISOString(),runtimeVersion:'2.44.0',scope:'Cloud Chromium and software graphics; not physical-device/GPU or human evidence.',method:'Original curved fox study, separate starting curves, actual Studio bridge and merge edits; named animation frames plus separate animation-free rest exports.',fixtures:[],backends:[]};
 const hash=v=>createHash('sha256').update(v).digest('hex');
 for(const{name,p}of cases){const source=JSON.stringify(p,null,2)+'\n',bytes=compileProject(p).bytes;fs.writeFileSync(`${out}/${name}-oracle.evir-project`,source);fs.writeFileSync(`${out}/${name}-oracle.riv`,bytes);report.fixtures.push({name,sourceSha256:hash(source),rivSha256:hash(bytes)});}
 for(const backend of ['canvas','webgl2']) {
  process.env.RIVE_RENDERER=backend;await run(async(page,browser)=>{
   report.browser=browser.version();await gpu.install(page);await page.reload();const checks=[];
   for(const{name,p}of cases)for(const frame of(p.animations.length?[0,30,60,90,120]:[null])) {
    await page.evaluate(async({name,animation,frame})=>{await loadFixture(name,{src:`/research/results/path-joining/${name}-oracle.riv`,autoplay:false,...(animation?{animations:animation}:{})});player.stopRendering();if(animation)player.scrub(animation,frame/60);player.drawFrame();player.stopRendering();},{name,animation:p.animations[0]?.name,frame});
    const expected=Buffer.from(await page.evaluate(async({p,frame})=>{
     const {CanvasRenderer,evaluate}=await import('/tools/.test-build/oracle.mjs'),c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.scale(.5,.5);
     const r=new CanvasRenderer(ctx);await r.prepare(p);r.draw(evaluate(p,p.animations[0]?.id,frame??0),p.artboards[0].id);r.dispose();
     const bytes=ctx.getImageData(0,0,256,256).data;let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);
    },{p,frame}),'base64');
    const actual=backend==='canvas'?Buffer.from(await page.evaluate(()=>{const bytes=document.querySelector('#canvas').getContext('2d').getImageData(0,0,256,256).data;let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);}),'base64'):PNG.sync.read(await page.locator('#canvas').screenshot({omitBackground:true})).data;
    assert.equal(expected.length,256*256*4);assert.equal(actual.length,expected.length);let error=0,covered=0,expectedCovered=0;
    for(let i=0;i<actual.length;i++){error+=Math.abs(actual[i]-expected[i]);if(i%4===3){if(actual[i])covered++;if(expected[i])expectedCovered++;}}
    const row={scene:name,frame,mae:error/actual.length,covered,expectedCovered};checks.push(row);
    assert(covered>10000&&expectedCovered>10000,'visible geometry');assert(row.mae<2.5,`${backend} ${name} ${frame} MAE ${row.mae}`);assert(Math.abs(covered-expectedCovered)<350,`${backend} ${name} ${frame} coverage`);
   }
   report.backends.push({backend,checks,graphics:await gpu.collect(page)});console.log(`${backend}: ${checks.length} path-joining native comparisons passed.`);
  });
 }
 fs.writeFileSync(`${out}/native.json`,JSON.stringify(report,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
