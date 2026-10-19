const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
(async()=>{
 const root=path.resolve(__dirname,'../..'),{examples}=await import('../../apps/web/examples.mjs'),{createStaticServer}=await import('../../tools/static-server.mjs');
 const output='apps/web/.test-build/gallery';execFileSync(process.execPath,['apps/web/build.mjs'],{cwd:root,env:{...process.env,SITE_URL:'',EVIR_WEB_OUTPUT:output},stdio:'pipe'});
 const server=createStaticServer(path.join(root,output));await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':chromium.executablePath()),args:['--no-sandbox'],headless:true});
 const report={checkedAt:new Date().toISOString(),examples:examples.map(e=>({id:e.id,features:e.features})),viewportWidths:[320,390,1440],scope:'Original scenes, software browser and official export checks; not a mobile performance or usability study.'};
 try {
  const context=await browser.newContext({viewport:{width:1440,height:844},reducedMotion:'reduce'}),page=await context.newPage(),requests=[],errors=[];page.on('request',r=>{if(r.url().endsWith('.evir-project'))requests.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  const visible=()=>page.locator('[data-preview]').evaluateAll(els=>els.filter(el=>{const r=el.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0&&r.left<innerWidth&&r.right>0;}).map(el=>el.dataset.preview));
  const ready=ids=>page.waitForFunction(ids=>ids.every(id=>document.querySelector(`[data-preview=${id}]`).dataset.ready==='true'),ids);
  await page.goto(origin+'/examples/');await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const initial=await visible();await ready(initial);assert(requests.every(url=>initial.some(id=>url.endsWith('/'+id+'.evir-project'))),'offscreen previews stay deferred before scrolling');
  // The growing index can push every preview below the first viewport.
  await page.locator(`[data-preview=${examples[0].id}]`).scrollIntoViewIfNeeded();const first=[...new Set([...initial,...await visible()])];assert(first.length>0);await ready(first);
  assert.equal(requests.length,first.length,'only revealed previews initialize');assert(requests.every(url=>first.some(id=>url.endsWith('/'+id+'.evir-project'))));
  for(const example of examples){const preview=page.locator(`[data-preview=${example.id}]`);await preview.scrollIntoViewIfNeeded();await page.waitForFunction(id=>document.querySelector(`[data-preview=${id}]`).dataset.ready==='true',example.id);assert.equal(await preview.getAttribute('data-playing'),'false');await page.locator(`#${example.id} summary`).click();assert(await page.locator(`#${example.id} details`).getAttribute('open')!==null);if(example.importStudy){const href=await page.locator(`#${example.id}`).getByRole('link',{name:/Native import sample/}).getAttribute('href'),response=await fetch(new URL(href,origin));assert(response.ok);assert.deepEqual(Buffer.from(await response.arrayBuffer()),fs.readFileSync(path.join(root,`apps/web/assets/examples/${example.id}-native.riv`)));}}
  assert.equal(requests.length,examples.length,'one project fetch per example');const signal=page.locator('.signal');
  await signal.scrollIntoViewIfNeeded();const level=signal.locator('.level-control'),enabled=signal.locator('.enabled-control'),state=signal.locator('.demo-state');
  await level.fill('75');assert.equal(await state.innerText(),'Waiting');await enabled.check();assert.equal(await state.innerText(),'Ready');await level.fill('20');assert.equal(await state.innerText(),'Waiting');await level.fill('75');await signal.getByRole('button',{name:'Celebrate',exact:true}).click();assert.equal(await state.innerText(),'Celebrating');assert(await signal.locator('.celebrate-control').isDisabled());await signal.getByRole('button',{name:'Reset example',exact:true}).click();assert.equal(await state.innerText(),'Waiting');assert.equal(await level.inputValue(),'0');assert.equal(await enabled.isChecked(),false);
  const lumen=page.locator('.lumen');await lumen.scrollIntoViewIfNeeded();
  const image=()=>lumen.locator('canvas').evaluate(c=>c.toDataURL());const rest=await image();
  await lumen.locator('[data-direct-input=joy]').fill('100');assert.notEqual(await image(),rest);
  const joy=await image();await lumen.locator('[data-direct-input=courage]').focus();await page.keyboard.press('End');assert.equal(await lumen.locator('[data-direct-input=courage]').inputValue(),'100');assert.notEqual(await image(),joy);
  await lumen.getByRole('button',{name:'Reset feelings'}).click();assert.equal(await image(),rest);assert.equal(await lumen.getAttribute('data-playing'),'false');
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  for(const width of report.viewportWidths){await page.setViewportSize({width,height:844});await signal.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow ${width}`);const violations=await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));assert.deepEqual(violations,[]);}
  const evidence=path.join(root,'research/results/showcase-gallery');fs.mkdirSync(evidence,{recursive:true});await page.setViewportSize({width:390,height:844});await signal.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(evidence,'signal-mobile.png')});
  // Each download is a real editable project and exports back to its published bytes in Studio.
  await page.goto(origin+'/editor/studio/');await page.waitForFunction(()=>window.evirStudio);
  for(const example of examples) {
    const file=path.join(root,`apps/web/assets/examples/${example.id}.evir-project`);
    await page.locator('#file').setInputFiles(file);
    await page.locator('#replace-confirm').click();
    await page.waitForFunction(id=>evirStudio.snapshot().id===`${id}-project`,example.id);
    const download=page.waitForEvent('download');
    await require('../editor/actions.cjs').press(page,'Export .riv');
    let downloaded;
    try { downloaded=await download; }
    catch(error) {
      throw Error(`${example.id} export: ${await page.locator('#notice').innerText()} / ${await page.locator('#save-status').innerText()}`,{cause:error});
    }
    assert.deepEqual(fs.readFileSync(await downloaded.path()),fs.readFileSync(path.join(root,`apps/web/assets/examples/${example.id}.riv`)));
    // Each export emits two files; pace this automated burst below Chromium's download rate limit.
    await page.waitForTimeout(1100);
  }
  assert.deepEqual(errors,[]);report.checks=['below-fold previews deferred','one source fetch per example','reduced-motion defaults','inspection notes','native import sample download bytes','boolean and number AND guard','click/trigger celebration','reset restores inputs and pose','direct feelings respond independently, keyboard sliders and reset restore baseline','no page overflow','zero automated accessibility violations',`all ${examples.length} sources open and export unchanged in Studio`];fs.writeFileSync(path.join(evidence,'browser.json'),JSON.stringify(report,null,2)+'\n');await context.close();console.log(`Gallery: ${examples.length} editable studies, lazy loading, Signal interaction/reset and responsive accessibility passed.`);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
