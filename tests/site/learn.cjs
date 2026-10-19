const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),{chromium}=require('playwright');
(async()=>{
 const{createStaticServer}=await import('../../tools/static-server.mjs'),{validateProject}=await import('@evir/project-model');
 const root=path.resolve(__dirname,'../..'),output='apps/web/.test-build/learn',base='/learn-preview';
 execFileSync(process.execPath,['apps/web/build.mjs'],{cwd:root,env:{...process.env,SITE_URL:'https://learn.example'+base,EVIR_WEB_OUTPUT:output},stdio:'pipe'});
 const server=createStaticServer(path.join(root,output),base);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const report={checkedAt:new Date().toISOString(),browser:browser.version(),basePath:base,scope:'Cloud browser, keyboard navigation, asset delivery and automated accessibility; not first-time-user research.',viewports:[]};
 try{
  const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const width of[320,390,844,1440]){
   await page.setViewportSize({width,height:900});await page.goto(origin+base+'/learn/');
   await page.getByRole('link',{name:'Make your first animation',exact:true}).click();assert.equal(new URL(page.url()).hash,'#first-animation');
   assert.equal(await page.locator('.lesson-steps article').count(),10);
   for(const img of await page.locator('.lesson-figure img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(e=>e.decode());assert(await img.evaluate(e=>e.naturalWidth>0));}
   const details=page.locator('#next-skills details').first();await details.locator('summary').focus();await page.keyboard.press('Enter');assert.equal(await details.getAttribute('open'),'');await page.keyboard.press('Space');assert.equal(await details.getAttribute('open'),null);
   const missing=await page.locator('a[href^="#"]').evaluateAll(links=>links.map(a=>a.hash.slice(1)).filter(id=>id&&!document.getElementById(id)));assert.deepEqual(missing,[]);
   assert.equal(new URL(await page.getByRole('link',{name:'Open Studio',exact:false}).first().getAttribute('href'),origin).pathname,base+'/editor/studio/');
   const href=await page.getByRole('link',{name:'Download the finished lesson',exact:false}).getAttribute('href'),response=await fetch(new URL(href,origin));assert(response.ok);const p=await response.json();validateProject(p);assert.equal(p.nodes[0].name,'Sun');assert.equal(p.animations[0].tracks[0].keys.length,3);
   await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});assert.deepEqual(await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))),[]);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   report.viewports.push({width,checks:['ten actual steps','real screenshot delivery','keyboard topic disclosures','valid step anchors','subpath Studio and lesson links','finished source delivered and validated','no horizontal overflow','zero automated WCAG violations']});
   if(width===390){await page.locator('#first-animation').scrollIntoViewIfNeeded();await page.screenshot({path:'research/results/shape-library/learn-390.png'});}
  }
  assert.deepEqual(errors,[]);fs.writeFileSync('research/results/shape-library/learn.json',JSON.stringify(report,null,2)+'\n');console.log('Learn: four widths, keyboard, actual teaching assets, source download, subpath routing and accessibility passed.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
