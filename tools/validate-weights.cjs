const fs=require('node:fs'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{PNG}=require('pngjs');
const{run}=require('./browser.cjs'),gpu=require('./gpu_diagnostics.cjs');
(async()=>{
 await require('./prepare-oracle.cjs').prepare();const{compileProject}=await import('@evir/format');
 const dir='research/results/skin-weights';fs.mkdirSync(dir,{recursive:true});const cases=[];
 for(const[name,file]of[['gust','apps/web/assets/examples/gust.evir-project'],['studio-weighted',`${dir}/studio-weighted.evir-project`]]){
  if(!fs.existsSync(file))throw Error('Run the skin-weight browser workflow first: '+file);
  const p=JSON.parse(fs.readFileSync(file));cases.push({name,p});const rest=structuredClone(p);rest.animations=[];rest.machines=[];cases.push({name:name+'-rest',p:rest});
 }
 const report={checkedAt:new Date().toISOString(),runtimeVersion:'2.44.0',method:'Original three-bone vector/PNG study and actual Studio weight edits, animated named frames plus separate animation-free rest exports.',scope:'Cloud software rendering; not physical-device/GPU or moderated-user evidence.',fixtures:[],backends:[]};
 const hash=v=>createHash('sha256').update(v).digest('hex');
 for(const{name,p}of cases){const source=JSON.stringify(p,null,2)+'\n',bytes=compileProject(p).bytes;fs.writeFileSync(`${dir}/${name}-oracle.evir-project`,source);fs.writeFileSync(`${dir}/${name}-oracle.riv`,bytes);report.fixtures.push({name,sourceSha256:hash(source),rivSha256:hash(bytes),assetSha256:p.assets.map(a=>a.sha256)});}
 for(const backend of['canvas','webgl2']){
  process.env.RIVE_RENDERER=backend;await run(async(page,browser)=>{
   report.browser=browser.version();await gpu.install(page);await page.reload();const checks=[];
   for(const{name,p}of cases)for(const frame of(p.animations.length?[0,30,60,90,120]:[null])){
    await page.evaluate(async({name,animation,frame})=>{await loadFixture(name,{src:`/research/results/skin-weights/${name}-oracle.riv`,autoplay:false,...(animation?{animations:animation}:{})});player.stopRendering();if(animation)player.scrub(animation,frame/60);player.drawFrame();player.stopRendering();},{name,animation:p.animations[0]?.name,frame});
    const expected=await page.evaluate(async({p,frame})=>{const{CanvasRenderer,evaluate}=await import('/tools/.test-build/oracle.mjs');const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.scale(.5,.5);const r=new CanvasRenderer(ctx);await r.prepare(p);r.draw(evaluate(p,p.animations[0]?.id,frame??0),p.artboards[0].id);r.dispose();return Array.from(ctx.getImageData(0,0,256,256).data);},{p,frame});
    const actual=backend==='canvas'?await page.evaluate(()=>Array.from(document.querySelector('#canvas').getContext('2d').getImageData(0,0,256,256).data)):PNG.sync.read(await page.locator('#canvas').screenshot({omitBackground:true})).data;
    let error=0,covered=0,expectedCovered=0;for(let i=0;i<actual.length;i++){error+=Math.abs(actual[i]-expected[i]);if(i%4===3){if(actual[i])covered++;if(expected[i])expectedCovered++;}}
    const row={scene:name,frame,mae:error/actual.length,covered,expectedCovered};checks.push(row);console.log(backend,row);assert(covered>10000&&expectedCovered>10000,'visible geometry');assert(row.mae<2.5,`${backend} ${name} ${frame} MAE ${row.mae}`);assert(Math.abs(covered-expectedCovered)<350,`${backend} ${name} coverage`);
   }
   report.backends.push({backend,checks,graphics:await gpu.collect(page)});
  });
 }
 fs.writeFileSync(`${dir}/native.json`,JSON.stringify(report,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
