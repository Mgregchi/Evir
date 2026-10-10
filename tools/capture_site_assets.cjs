const path=require('node:path');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {run}=require('./browser.cjs');
const {chromium}=require('playwright');
if(!process.env.CHROMIUM_PATH && !fs.existsSync('/usr/bin/chromium'))process.env.CHROMIUM_PATH=chromium.executablePath();
const root=path.resolve(__dirname,'..');
async function capture(){
await require('./prepare-oracle.cjs').prepare();
require('node:child_process').execFileSync(process.execPath,['apps/web/build.mjs'],{cwd:root,stdio:'pipe'});
await run(async page=>{
  const out=path.join(root,'apps/web/assets');fs.mkdirSync(out,{recursive:true});
  for(const name of ['milo','orbit']) {
    await page.setViewportSize({width:512,height:512});
    await page.goto(`http://127.0.0.1:8776/apps/web/preview.html?example=${name}`);
    await page.waitForFunction(()=>window.assetReady);
    await page.locator('canvas').screenshot({path:path.join(out,name+'-poster.png'),omitBackground:true});
  }
  await page.setViewportSize({width:1440,height:900});
  await page.goto('http://127.0.0.1:8776/apps/web/dist/editor/studio/');
  await page.waitForFunction(()=>window.evirStudio);
  await page.locator('#file').setInputFiles(path.join(out,'examples/milo.evir-project'));
  await page.locator('#replace-confirm').click();
  await page.waitForFunction(()=>evirStudio.snapshot().id==='milo-project');
  await page.getByRole('button',{name:'Fit',exact:true}).click();
  await page.locator('.brand-wordmark').evaluate(img=>img.decode());
  await page.screenshot({path:path.join(out,'studio-overview.png')});
  await page.getByRole('button',{name:'Select body',exact:true}).click();
  await page.getByRole('button',{name:'Edit points',exact:true}).click();
  await page.screenshot({path:path.join(out,'studio-paths.png')});
  await page.getByRole('button',{name:'Animate',exact:true}).click();
  await page.getByRole('button',{name:'Select shoulder',exact:true}).click();
  await page.getByLabel('Animation',{exact:true}).selectOption('milo-wave');
  await page.getByLabel('Playhead',{exact:true}).fill('30');
  await page.screenshot({path:path.join(out,'studio-animation.png')});
  await page.getByRole('button',{name:'Interact',exact:true}).click();
  await page.screenshot({path:path.join(out,'studio-interact.png')});
  assert.equal(await page.evaluate(()=>evirStudio.snapshot().nodes.length),24);
  console.log('Captured 2 original example posters and 4 actual Evir Studio screenshots.');
});
}
capture().catch(e=>{console.error(e);process.exitCode=1;});
