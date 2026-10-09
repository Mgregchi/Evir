// Private runtime exploration. Uploaded .riv bytes are never copied into the public site.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const assert = require('node:assert/strict');
const {createHash}=require('node:crypto');
const os=require('node:os');
const root = path.resolve(__dirname, '..');
const files = process.argv.slice(2).map(v => path.resolve(v));
const inventory = JSON.parse(fs.readFileSync(process.env.EVIR_CORPUS_INVENTORY || path.join(root,'research/results/supplied-corpus-inventory.json')));
const shots = process.env.EVIR_CORPUS_SCREENSHOTS || path.join(os.tmpdir(),'evir-corpus-screenshots');
const html = `<!doctype html><html><meta charset="utf-8"><title>Private corpus probe</title>
<style>body{margin:0;background:transparent}canvas{display:block;width:640px;height:480px}</style>
<canvas id="canvas" width="640" height="480"></canvas><script src="/rive.js"></script><script>
rive.RuntimeLoader.setWasmUrl('/rive.wasm');
window.load = async function(src, board, machine) {
 if(window.player) player.cleanup();
 const start = performance.now();
 const r = await new Promise((resolve,reject)=>{
  const i = new rive.Rive({src,canvas:document.querySelector('canvas'),artboard:board,
   stateMachines:machine,autoplay:true,autoBind:true,
   layout:new rive.Layout({fit:rive.Fit.contain,alignment:rive.Alignment.center}),
   onLoad:()=>resolve(i),onLoadError:e=>reject(Error(String(e)))});
 });
 window.player = r;r.resizeDrawingSurfaceToCanvas();
 return {loadMs:performance.now()-start,animations:r.animationNames,machines:r.stateMachineNames,
  inputs:(r.stateMachineInputs(machine)||[]).map(i=>({name:i.name,type:i.type,value:i.value}))};
};</script></html>`;
const server = http.createServer((req,res)=>{
 const pathname = new URL(req.url,'http://local').pathname;
 if(pathname === '/') {res.setHeader('Content-Type','text/html');return res.end(html);}
 const index = /^\/file-(\d+)\.riv$/.exec(pathname);
 const file = index ? files[Number(index[1])] : ['/rive.js','/rive.wasm'].includes(pathname)
  ? path.join(root,'node_modules/@rive-app/webgl2',pathname.slice(1)) : null;
 if(!file || !fs.existsSync(file)) {res.statusCode=404;return res.end('Not found');}
 res.setHeader('Content-Type',pathname.endsWith('.js')?'application/javascript':pathname.endsWith('.wasm')?'application/wasm':'application/octet-stream');
 fs.createReadStream(file).pipe(res);
});
(async()=>{
 assert(files.length,'Pass the local paths of the supplied files');
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':chromium.executablePath()),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const records=[];
 try {
  fs.mkdirSync(shots,{recursive:true});
  for(const [index,file] of files.entries()) {
   const source=inventory.files.find(f=>f.filename===path.basename(file));
   assert(source?.artboards?.length,'Inventory missing for '+path.basename(file));
   assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),source.sha256,'Inventory hash must match supplied bytes');
   const board=source.artboards[0];
   const page=await browser.newPage({viewport:{width:640,height:480}});
   const errors=[],blocked=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>route.request().url().startsWith(address)?route.continue():(blocked.push(route.request().url()),route.abort()));
   const record={filename:source.filename,sha256:source.sha256,artboard:board.name,stateMachine:board.machines[0],runtime:'@rive-app/webgl2@2.44.0'};
   try {
    await page.goto(address);
    record.loaded=await page.evaluate(async({index,board})=>load('/file-'+index+'.riv',board.name,board.machines[0]),{index,board});
    assert.deepEqual([...record.loaded.animations].sort(),board.animations.map(a=>a.name).sort());
    assert.deepEqual([...record.loaded.machines].sort(),[...board.machines].sort());
    await page.waitForTimeout(600);
    const png=PNG.sync.read(await page.locator('canvas').screenshot({omitBackground:true}));
    record.initialCoverage=png.data.filter((_,i)=>i%4===3&&png.data[i]>0).length;
    assert(record.initialCoverage>0,'Selected artboard rendered no pixels');
    record.playing=await page.evaluate(()=>player.playingStateMachineNames);
    assert(record.playing.includes(board.machines[0]));
    await page.mouse.move(100,100);await page.mouse.move(500,350,{steps:10});
    await page.mouse.click(320,240);await page.waitForTimeout(250);
    await page.locator('canvas').screenshot({path:path.join(shots,index+'.png'),omitBackground:true});
    record.status='passed';
   }catch(e){record.status='failed';record.error=e.message;}
   record.pageErrors=errors;record.blockedExternalRequests=blocked;
   if(errors.length)record.status='failed';
   records.push(record);await page.close();console.log(source.filename+': '+record.status);
  }
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
 const report={checkedAt:new Date().toISOString(),runtimeVersion:'2.44.0',backend:'WebGL2 cloud software graphics',
  scope:'One representative artboard and its first state machine per downloaded file: inventory match, nonempty rendered pixels, startup and exploratory pointer/click input. No expected-pose, game-completion, universal feature, mobile or hardware-performance assertion.',records};
 fs.writeFileSync(process.env.EVIR_CORPUS_OUTPUT || path.join(root,'research/results/supplied-corpus-runtime.json'),JSON.stringify(report,null,2)+'\n');
 if(records.some(r=>r.status!=='passed'))process.exitCode=1;
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
