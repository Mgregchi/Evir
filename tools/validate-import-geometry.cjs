const fs=require('node:fs'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{PNG}=require('pngjs');
const {run}=require('./browser.cjs'),gpu=require('./gpu_diagnostics.cjs');
const dir='research/results/import-geometry';
const hash=v=>createHash('sha256').update(v).digest('hex');
function difference(a,b){let error=0,covered=0,expectedCovered=0;assert.equal(a.length,b.length);for(let i=0;i<a.length;i++){error+=Math.abs(a[i]-b[i]);if(i%4===3){if(a[i])covered++;if(b[i])expectedCovered++;}}return{mae:error/a.length,covered,expectedCovered};}
(async()=>{
 await require('./prepare-oracle.cjs').prepare();
 const {importedCases}=await import('../tests/fixtures/import-geometry.mjs'),{compileProject}=await import('@evir/format');
 const cases=await importedCases();const {stableImport}=await import('./stabilize-import.mjs'),{importRiv}=await import('@evir/format');const bytes=fs.readFileSync('apps/web/assets/examples/tide-native.riv');cases.push({name:'tide-native',bytes,project:stableImport(await importRiv(bytes),'tide-native')});fs.mkdirSync(dir,{recursive:true});
 const report={checkedAt:new Date().toISOString(),runtimeVersion:'2.44.0',method:'Independently encoded native contour records → editable import → Evir Canvas and native re-export, compared with the original in both official runtimes. Explicit named animation frames; static fixtures contain no animations.',thresholds:{mae:1.5,coverageDifference:250},scope:'Cloud Chromium software rendering; no physical-device, human, GPU-performance or general Editor compatibility evidence.',fixtures:[],backends:[]};
 for(const c of cases){const source=JSON.stringify(c.project,null,2)+'\n',reexport=compileProject(c.project).bytes;fs.writeFileSync(`${dir}/${c.name}.riv`,c.bytes);fs.writeFileSync(`${dir}/${c.name}.evir-project`,source);fs.writeFileSync(`${dir}/${c.name}-reexport.riv`,reexport);report.fixtures.push({name:c.name,nativeSha256:hash(c.bytes),sourceSha256:hash(source),reexportSha256:hash(reexport)});}
 for(const backend of ['canvas','webgl2']){
  process.env.RIVE_RENDERER=backend;
  await run(async(page,browser)=>{
   report.browser=browser.version();await gpu.install(page);await page.reload();const checks=[];
   const pixels=async(name,frame,animation)=>{
    await page.evaluate(async({name,frame,animation})=>{await loadFixture(name,{src:`/research/results/import-geometry/${name}.riv`,autoplay:false,...(animation?{animations:animation}:{})});player.stopRendering();if(animation)player.scrub(animation,frame/60);player.drawFrame();player.stopRendering();},{name,frame,animation});
    return backend==='canvas'?await page.evaluate(()=>Array.from(document.querySelector('#canvas').getContext('2d').getImageData(0,0,256,256).data)):PNG.sync.read(await page.locator('#canvas').screenshot({omitBackground:true})).data;
   };
   for(const c of cases)for(const frame of(c.project.animations.length?[0,30,60,90,120]:[null])){
    const original=await pixels(c.name,frame,c.project.animations[0]?.name);
    const editable=await page.evaluate(async({p,frame})=>{const{CanvasRenderer,evaluate}=await import('/tools/.test-build/oracle.mjs');const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');ctx.scale(256/p.artboards[0].width,256/p.artboards[0].height);const renderer=new CanvasRenderer(ctx);renderer.draw(evaluate(p,p.animations[0]?.id,frame??0),p.artboards[0].id);renderer.dispose();return Array.from(canvas.getContext('2d').getImageData(0,0,256,256).data);},{p:c.project,frame});
    const reexport=await pixels(c.name+'-reexport',frame,c.project.animations[0]?.name);
    assert(difference(original,original).covered>1000,`${backend} ${c.name} must render visible geometry`);
    for(const [target,actual]of[['editable',editable],['native-reexport',reexport]]){const row={scene:c.name,frame,target,...difference(actual,original)};checks.push(row);console.log(backend,row);assert(row.mae<report.thresholds.mae,`${backend} ${c.name} ${target} MAE ${row.mae}`);assert(Math.abs(row.covered-row.expectedCovered)<report.thresholds.coverageDifference,`${backend} ${c.name} ${target} coverage`);}
   }
   report.backends.push({backend,checks,graphics:await gpu.collect(page)});
  });
 }
 fs.writeFileSync(`${dir}/native.json`,JSON.stringify(report,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
