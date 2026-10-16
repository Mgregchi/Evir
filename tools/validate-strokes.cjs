const fs=require('node:fs'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{PNG}=require('pngjs');
const {run}=require('./browser.cjs'),gpu=require('./gpu_diagnostics.cjs');
(async()=>{
  await require('./prepare-oracle.cjs').prepare();
  const {strokeCases}=await import('../tests/fixtures/strokes.mjs'),{compileProject}=await import('@evir/format');
  const cases=strokeCases();
  for(const [name,file] of [['trace-study','apps/web/assets/examples/trace.evir-project'],['studio-stroke-oracle','research/results/native-strokes/studio-stroke.evir-project']]){if(fs.existsSync(file)){const p=JSON.parse(fs.readFileSync(file));p.name=name;cases.push(p);}}
  // The official high-level host automatically initializes the first clip.
  // Static authoring geometry is checked through a separate animation-free export.
  for(const original of [...cases].filter(p=>p.animations.length)){const p=structuredClone(original);p.name+='-rest';p.animations=[];p.machines=[];cases.push(p);}
  const dir='research/results/native-strokes';fs.mkdirSync(dir,{recursive:true});
  const report={checkedAt:new Date().toISOString(),runtimeVersion:'2.44.0',scope:'Selected cloud software-rendered stroke cases; not physical-device, GPU or full-parity evidence.',fixtures:[],backends:[]};
  for(const p of cases){const source=JSON.stringify(p,null,2)+'\n',bytes=compileProject(p).bytes;fs.writeFileSync(`${dir}/${p.name}.evir-project`,source);fs.writeFileSync(`${dir}/${p.name}.riv`,bytes);report.fixtures.push({name:p.name,sourceSha256:createHash('sha256').update(source).digest('hex'),rivSha256:createHash('sha256').update(bytes).digest('hex')});}
  for(const backend of ['canvas','webgl2']){
    process.env.RIVE_RENDERER=backend;
    await run(async(page,browser)=>{
      report.browser=browser.version();await gpu.install(page);await page.reload();const checks=[];
      for(const p of cases)for(const frame of (p.animations.length?[0,30,60,90,120]:[null])){
        await page.evaluate(async({name,animated,frame,animation})=>{
          await loadFixture(name,{src:`/research/results/native-strokes/${name}.riv`,autoplay:false,...(animated?{animations:animation}:{})});
          player.stopRendering();if(animated)player.scrub(animation,frame/60);player.drawFrame();player.stopRendering();
        },{name:p.name,animated:frame!==null&&!!p.animations.length,frame,animation:p.animations[0]?.name});
        const expected=await page.evaluate(async({p,frame})=>{
          const {CanvasRenderer,evaluate}=await import('/tools/.test-build/oracle.mjs');const c=document.createElement('canvas');c.width=c.height=256;const r=new CanvasRenderer(c.getContext('2d'));r.draw(evaluate(p,frame===null?undefined:p.animations[0]?.id,frame ?? 0),p.artboards[0].id);r.dispose();return Array.from(c.getContext('2d').getImageData(0,0,256,256).data);
        },{p,frame});
        const actual=backend==='canvas'?await page.evaluate(()=>Array.from(document.querySelector('#canvas').getContext('2d').getImageData(0,0,256,256).data)):PNG.sync.read(await page.locator('#canvas').screenshot({omitBackground:true})).data;
        let error=0,covered=0,expectedCovered=0;for(let i=0;i<actual.length;i++){error+=Math.abs(actual[i]-expected[i]);if(i%4===3){if(actual[i])covered++;if(expected[i])expectedCovered++;}}
        const row={scene:p.name,frame,mae:error/actual.length,covered,expectedCovered};checks.push(row);console.log(backend,row);
        assert(row.mae<2,`${backend} ${p.name} MAE ${row.mae}`);
        assert(Math.abs(covered-expectedCovered)<350,`${backend} ${p.name} coverage`);
      }
      report.backends.push({backend,checks,graphics:await gpu.collect(page)});
    });
  }
  fs.writeFileSync(`${dir}/native.json`,JSON.stringify(report,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
