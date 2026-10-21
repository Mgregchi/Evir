const fs=require('node:fs'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');const{run}=require('./browser.cjs');
(async()=>{
 const{evaluate}=await import('@evir/runtime'),{worldTransform}=await import('@evir/project-model');const out='research/results/software-closure/compounds',report={checkedAt:new Date().toISOString(),runtimeVersion:'2.44.0',scope:'Cloud native bone matrices, not physical performance.',method:'Query the pinned runtime artboard bone worldTransform after the same scrub/draw as the pixel oracle; compare all six raw source-coordinate values against Evir. Research use of the pinned high-level artboard handle, not a product dependency.',maximumAbsoluteError:.01,backends:[]};
 for(const backend of ['canvas','webgl2']){process.env.RIVE_RENDERER=backend;await run(async(page,browser)=>{report.browser=browser.version();const checks=[];for(const count of [3,4,8])for(const strength of [0,.5,1])for(const invert of [false,true]){
  const name=`ik-${count}-${strength}-${invert}`,source=fs.readFileSync(`${out}/${name}-oracle.evir-project`),p=JSON.parse(source),bones=p.nodes.filter(n=>n.kind==='bone');
  for(const frame of [0,30,60,90,120]){
   await page.evaluate(async({name,animation,seconds})=>{await loadFixture(name,{src:`/research/results/software-closure/compounds/${name}-oracle.riv`,autoplay:false,animations:animation});player.stopRendering();player.scrub(animation,seconds);player.drawFrame();player.stopRendering();},{name,animation:p.animations[0].name,seconds:frame/p.animations[0].fps});
   const actual=await page.evaluate(names=>names.map(name=>{const m=player.artboard.bone(name).worldTransform(),a=['xx','xy','yx','yy','tx','ty'].map(k=>m[k]);m.delete();return a;}),bones.map(n=>n.name));
   const pose=evaluate(p,p.animations[0].id,frame),expected=bones.map(n=>worldTransform(pose,n.id)),error=Math.max(...actual.flatMap((a,i)=>a.map((v,j)=>Math.abs(v-expected[i][j]))));assert(Number.isFinite(error)&&error<report.maximumAbsoluteError,JSON.stringify({backend,name,frame,error,actual,expected}));checks.push({name,frame,sourceSha256:createHash('sha256').update(source).digest('hex'),maximumAbsoluteError:error,bones:actual});
  }
 }report.backends.push({backend,checks});console.log(`${backend}: ${checks.length} native IK matrix comparisons passed.`);});}
 fs.writeFileSync(`${out}/ik-poses.json`,JSON.stringify(report,null,2)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
