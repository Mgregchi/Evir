const assert=require('node:assert/strict'),fs=require('node:fs'),{createHash}=require('node:crypto'),{PNG}=require('pngjs');
const {run}=require('./browser.cjs'),gpu=require('./gpu_diagnostics.cjs');
(async()=>{
  await require('./prepare-oracle.cjs').prepare();
  const {createProject}=await import('@evir/project-model'),{addNode,createAnimation,setKey}=await import('@evir/authoring'),{compileProject}=await import('@evir/format');
  const out='research/results/playback',dir=`${out}/fixtures`;fs.mkdirSync(dir,{recursive:true});
  const fixtures=[];
  for(const [mode,iterations,speed,adapter] of [['once',1,1.5,false],['loop',0,1.5,false],['ping-pong',0,1.5,false],['loop',3,1.25,true],['ping-pong',2,1.25,true]]){
    const p=createProject();p.id=`playback-${mode}-${iterations}`;p.name=p.id;p.artboards[0].width=p.artboards[0].height=256;
    p.artboards[0].id=p.id+'-board';p.editor.cameras={[p.artboards[0].id]:{x:0,y:0,zoom:1}};
    addNode(p);const n=p.nodes[0].id=p.id+'-rectangle';p.nodes[0].transform=[1,0,0,1,24,105];p.nodes[0].geometry={width:32,height:46,fill:'#91d8b7'};
    createAnimation(p,p.artboards[0].id);const a=p.animations[0],id=a.id=p.id+'-animation';a.duration=60;delete a.loop;a.playback={mode,iterations,speed};
    setKey(p,id,n,'x',0,24);setKey(p,id,n,'x',60,196,{type:'linear',curve:null});
    setKey(p,id,n,'fill',0,'#91d8b7');setKey(p,id,n,'fill',60,'#edb99c');
    const compiled=compileProject(p);fs.writeFileSync(`${dir}/${p.name}.evir-project`,JSON.stringify(p,null,2)+'\n');fs.writeFileSync(`${dir}/${p.name}.riv`,compiled.bytes);
    fs.writeFileSync(`${dir}/${p.name}.riv-map.json`,JSON.stringify(compiled.mapping,null,2)+'\n');fixtures.push({p,adapter,mapping:compiled.mapping.animations[id]});
  }
  const backend=process.env.RIVE_RENDERER||'canvas';const report={checkedAt:new Date().toISOString(),runtimeVersion:'2.44.0',backend,scope:'Native instance advancement for modes/speed; fixed counts applied by explicit Evir map clock adapter. Software graphics, not device performance.',checks:[]};
  await run(async(page,browser)=>{
    report.browserVersion=browser.version();await gpu.install(page);await page.reload();
    for(const {p,adapter,mapping} of fixtures){
      await page.evaluate(async({p,adapter,mapping,dir})=>{
        await loadFixture(p.name,{src:`/${dir}/${p.name}.riv`,autoplay:false,animations:p.animations[0].name});player.stopRendering();
        const {createRuntime,AnimationClock}=await import('/tools/.test-build/oracle.mjs');
        window.expectedPlayer=createRuntime(p,{animationId:p.animations[0].id});window.policyClock=adapter?new AnimationClock(mapping):null;
      },{p,adapter,mapping,dir});
      for(const dt of (adapter?[0,.5,.5,.5,.5,.5,.5,.5,1,1]:[0,.25,.25,.25,.25,.5,1.75])){
        const expected=await page.evaluate(async({dt,adapter})=>{
          const native=player.animator.animations[0];
          if(adapter){native.time=policyClock.advance(dt).frame/60;}else native.advance(dt);
          native.apply(1);player.artboard.advance(0);player.lastRenderTime=document.timeline.currentTime;player.drawFrame();player.stopRendering();
          const {CanvasRenderer}=await import('/tools/.test-build/oracle.mjs'),c=document.createElement('canvas');c.width=c.height=256;
          const renderer=new CanvasRenderer(c.getContext('2d'));renderer.draw(expectedPlayer.advance(dt),expectedPlayer.artboard.id);const pixels=Array.from(c.getContext('2d').getImageData(0,0,256,256).data);renderer.dispose();
          return {pixels,frame:expectedPlayer.playback.frame,nativeFrame:native.time*60,completed:expectedPlayer.playback.completed};
        },{dt,adapter});
        const actual=backend==='canvas'?await page.evaluate(()=>Array.from(document.getElementById('canvas').getContext('2d').getImageData(0,0,256,256).data)):PNG.sync.read(await page.locator('#canvas').screenshot({omitBackground:true})).data;
        const mae=actual.reduce((sum,v,i)=>sum+Math.abs(v-expected.pixels[i]),0)/actual.length;
        let expectedCovered=0,actualCovered=0;
        for(let i=3;i<actual.length;i+=4){if(expected.pixels[i])expectedCovered++;if(actual[i])actualCovered++;}
        assert(expectedCovered>=1400&&actualCovered>=1400,`${p.name}: comparison must contain visible artwork`);
        assert(Math.abs(expected.frame-expected.nativeFrame)<1e-3,`${p.name} native clock mismatch ${expected.frame} vs ${expected.nativeFrame}`);
        assert(mae<.5,`${p.name} pixel MAE ${mae}`);report.checks.push({scene:p.name,adapter,dt,frame:expected.frame,nativeFrame:expected.nativeFrame,completed:expected.completed,mae,expectedCovered,actualCovered});
      }
    }
    report.diagnostics=await gpu.collect(page);
  });
  report.fixtures=Object.fromEntries(fixtures.map(({p})=>[p.name,Object.fromEntries(['riv','evir-project','riv-map.json'].map(ext=>[ext,createHash('sha256').update(fs.readFileSync(`${dir}/${p.name}.${ext}`)).digest('hex')]))]));
  fs.writeFileSync(`${out}/native-${backend}.json`,JSON.stringify(report,null,2)+'\n');console.log(`${backend}: ${report.checks.length} native clock/pixel and explicit fixed-count adapter comparisons passed.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
