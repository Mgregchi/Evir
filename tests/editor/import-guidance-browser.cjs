const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {run}=require('../../tools/browser.cjs');
(async()=>{
 const {readRiv}=await import('@evir/format');const original=fs.readFileSync('apps/web/assets/examples/orbit.riv'),at=readRiv(original).records[1].offset;
 const unsupported=Buffer.concat([original.subarray(0,at),Buffer.from([0x83,0x04,0]),original.subarray(at)]);const fixture='/tmp/evir-original-converter.riv';fs.writeFileSync(fixture,unsupported);
 const evidence='research/results/import-guidance';fs.mkdirSync(evidence,{recursive:true});const report={checkedAt:new Date().toISOString(),widths:[390,1440],scope:'Chromium software automation, original Orbit with an unused converter; no physical or human evidence',checks:[]};
 await run(async(page,browser)=>{
  report.browserVersion=browser.version();
  for(const width of report.widths){
   await page.setViewportSize({width,height:844});const requests=[];page.on('request',r=>requests.push(r.url()));
   await page.goto('http://127.0.0.1:8776/apps/web/dist/editor/studio/');await page.waitForFunction(()=>window.evirStudio);const before=await page.evaluate(()=>evirStudio.snapshot());
   assert(!requests.some(r=>/rive-view|rive.*wasm/.test(r)),'No official runtime before an explicit view');
   await page.locator('#file').setInputFiles(fixture);await page.locator('#riv-import-sheet').waitFor();assert.match(await page.locator('#riv-import-sheet').innerText(),/data converters/);assert.deepEqual(await page.evaluate(()=>evirStudio.snapshot()),before);
   await page.getByRole('button',{name:'View original animation',exact:true}).click();await page.waitForFunction(()=>!evirStudio.originalRiv.snapshot().loading&&evirStudio.originalRiv.snapshot().animationNames.length);
   assert.equal(await page.evaluate(()=>evirStudio.originalRiv.snapshot().playing),false);assert.equal(await page.evaluate(()=>evirStudio.originalRiv.snapshot().artboard),'Orbit — motion in a loop');
   const pixels=()=>page.locator('#riv-import-sheet canvas').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0,h=2166136261;for(let i=0;i<d.length;i++){if(i%4===3&&d[i])n++;h=Math.imul(h^d[i],16777619);}return {covered:n,hash:h>>>0};});
   const first=await pixels();assert(first.covered>1000);await page.getByRole('button',{name:'Play original',exact:true}).click();await page.waitForTimeout(150);await page.getByRole('button',{name:'Pause original',exact:true}).click();assert.notEqual((await pixels()).hash,first.hash,'Original animation moves');
   await page.getByRole('button',{name:'Reset original',exact:true}).click();assert.equal((await pixels()).hash,first.hash,'Reset restores original frame');
   const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download original .riv',exact:true}).click();assert.deepEqual(fs.readFileSync(await (await download).path()),unsupported,'Original bytes preserved');
   assert(requests.filter(r=>/rive.*wasm/.test(r)).every(r=>r.startsWith('http://127.0.0.1:8776/')),'Runtime hosted locally');
   await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});assert.deepEqual(await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.map(v=>v.id)),[]);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`${evidence}/original-view-${width}.png`,animations:'disabled'});
   await page.getByRole('button',{name:'Back to Studio',exact:true}).click();assert.equal(await page.evaluate(()=>evirStudio.originalRiv.snapshot().open),false);assert.equal(await page.evaluate(()=>evirStudio.originalRiv.snapshot().playing),false);assert.deepEqual(await page.evaluate(()=>evirStudio.snapshot()),before);
   // Existing supported import still converts into editable layers after confirmation.
   await page.locator('#file').setInputFiles('apps/web/assets/examples/orbit.riv');await page.locator('#replace-confirm').click();await page.waitForFunction(()=>evirStudio.snapshot().name==='Imported Rive scene');assert.equal(await page.evaluate(()=>evirStudio.snapshot().nodes.length),12);
   // A malformed original gets actionable feedback, never a false ready state.
   await page.locator('#riv-view-file').setInputFiles({name:'broken.riv',mimeType:'application/octet-stream',buffer:Buffer.from('not a Rive file')});await page.waitForFunction(()=>document.querySelector('#riv-import-sheet [role=alert]').textContent.includes('could not open'));
   assert.equal(await page.evaluate(()=>evirStudio.originalRiv.snapshot().loading),false);await page.getByRole('button',{name:'Back to Studio',exact:true}).click();
   await page.getByRole('button',{name:'Project menu',exact:true}).click();await page.getByRole('button',{name:'MCP setup…',exact:true}).click();
   assert.match(await page.locator('#mcp-setup-sheet').innerText(),/does not connect to this open Studio tab/);assert.equal(await page.getByRole('button',{name:'Copy configuration',exact:true}).isDisabled(),true);
   await page.getByLabel('Your Evir checkout folder',{exact:true}).fill('/home/you/Evir');const config=JSON.parse(await page.locator('#mcp-setup-sheet pre').innerText());assert.equal(config.mcpServers['evir-local'].command,'node');assert.equal(config.mcpServers['evir-local'].args[0],'/home/you/Evir/tools/mcp-local.mjs');
   const configDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download configuration',exact:true}).click();assert.deepEqual(JSON.parse(fs.readFileSync(await (await configDownload).path())),config);
   assert.deepEqual(await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.map(v=>v.id)),[]);await page.screenshot({path:`${evidence}/mcp-setup-${width}.png`,animations:'disabled'});await page.getByRole('button',{name:'Close MCP setup',exact:true}).click();
   page.removeAllListeners('request');
  }
  const {execFileSync}=require('node:child_process'),{createStaticServer}=await import('../../tools/static-server.mjs');
  const output='apps/web/.test-build/import-prefix';execFileSync(process.execPath,['apps/web/build.mjs'],{cwd:path.resolve(__dirname,'../..'),env:{...process.env,SITE_URL:'https://example.org/Evir/',EVIR_WEB_OUTPUT:output},stdio:'pipe'});
  const server=createStaticServer(path.resolve(output),'/Evir');await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
  try{await page.goto(origin+'/Evir/editor/studio/');await page.waitForFunction(()=>window.evirStudio);await page.locator('#riv-view-file').setInputFiles(fixture);await page.waitForFunction(()=>!evirStudio.originalRiv.snapshot().loading&&evirStudio.originalRiv.snapshot().animationNames.length);const wasm=await fetch(origin+'/Evir/editor/studio/assets/rive-view.wasm');assert.equal(wasm.headers.get('content-type'),'application/wasm');await wasm.arrayBuffer();await page.getByRole('button',{name:'Back to Studio',exact:true}).click();}
  finally{await new Promise(r=>server.close(r));}
  report.checks=['prefixed hosting and WASM MIME','failed conversion preserves Studio source','clear feature diagnostics and read-only alternative','official renderer loaded on demand from same origin','paused original view, play, pause and reset pixels','exact original bytes download','viewer closes and disposes playback','supported .riv remains editable','malformed original reports failure','visible MCP setup with absolute-path configuration/download','no overflow and zero automated accessibility violations'];
 });fs.writeFileSync(`${evidence}/browser.json`,JSON.stringify(report,null,2)+'\n');console.log('Import/view/MCP guidance: two widths, preservation, original playback, editable import and accessibility passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
