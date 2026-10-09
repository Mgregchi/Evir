const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {execFileSync} = require('node:child_process');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '../..');
const evidence = path.join(root, 'research/results/public-site');
const names = ['', 'product/', 'editor/', 'examples/', 'learn/', 'community/', 'roadmap/', 'updates/', 'about/', 'contribute/', 'privacy/'];
const publicKeys = ['SITE_URL','BASE_PATH','EDITOR_URL','REPOSITORY_URL','DOCS_URL','COMMUNITY_URL','FEEDBACK_URL','NEWSLETTER_URL','SOCIAL_X_URL','SOCIAL_LINKEDIN_URL','SOCIAL_MASTODON_URL','CONTACT_URL'];
const mime = {'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.xml':'application/xml'};
function build(name, values={}) {
  const env = {...process.env, ...Object.fromEntries(publicKeys.map(key=>['PUBLIC_'+key,''])),
    EVIR_SITE_OUTPUT:`apps/site/.test-build/${name}`, ...values, PRIVATE_TEST_SENTINEL:'never-expose-this-private-value'};
  execFileSync(process.execPath, ['apps/site/build.mjs'], {cwd:root, env, stdio:'pipe'});
  return path.join(root, env.EVIR_SITE_OUTPUT);
}
async function serve(dir, base='') {
  const {createStaticServer}=await import('../../tools/static-server.mjs');
  const server=createStaticServer(dir,base);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {server, origin:`http://127.0.0.1:${server.address().port}`};
}
(async()=>{
  const {readPublicConfig}=await import('../../apps/site/config.mjs');
  for(const values of [{PUBLIC_SITE_URL:'javascript:alert(1)'},{PUBLIC_COMMUNITY_URL:'https://user:pass@example.org'},{PUBLIC_BASE_PATH:'/../'},{PUBLIC_BASE_PATH:'/Evir//'},{PUBLIC_SITE_URL:'https://example.org/Evir/'}])
    assert.throws(()=>readPublicConfig(values));
  assert.equal(readPublicConfig({}).community,'');
  assert.equal(readPublicConfig({PUBLIC_CONTACT_URL:'mailto:hello@example.org'}).contact,'mailto:hello@example.org');
  assert.throws(()=>build('unsafe',{EVIR_SITE_OUTPUT:'apps/site/assets'}));
  const builds=[['root',{},''],['prefix',{
    PUBLIC_SITE_URL:'https://example.org', PUBLIC_BASE_PATH:'/Evir/',
    PUBLIC_COMMUNITY_URL:'https://chat.example.org/join',PUBLIC_DOCS_URL:'https://docs.example.org',
    PUBLIC_FEEDBACK_URL:'https://feedback.example.org/new',PUBLIC_NEWSLETTER_URL:'https://news.example.org',
    PUBLIC_SOCIAL_X_URL:'https://x.example.org/evir',PUBLIC_SOCIAL_LINKEDIN_URL:'https://linkedin.example.org/evir',
    PUBLIC_SOCIAL_MASTODON_URL:'https://social.example.org/@evir',PUBLIC_CONTACT_URL:'mailto:hello@example.org'},'/Evir']];
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':chromium.executablePath()),args:['--no-sandbox'],headless:true});
  const report={checkedAt:new Date().toISOString(),scope:'Independent public site and editor deployments, configured launch links, runtime previews, responsive layouts and feedback drafting. Automated accessibility is not a user study.',pages:[],checks:[]};
  fs.mkdirSync(evidence,{recursive:true});
  try {
    for(const [name,env,base] of builds) {
      const editorBase=name==='prefix'?'/studio':'';
      const editorDir=path.join(root,`apps/editor/.test-build/${name}`);
      execFileSync(process.execPath,['apps/editor/build.mjs'],{cwd:root,stdio:'pipe',env:{...process.env,EVIR_EDITOR_OUTPUT:editorDir,EDITOR_BASE_PATH:editorBase,EDITOR_PUBLIC_SITE_URL:'https://example.org/Evir/',PRIVATE_TEST_SENTINEL:'never-expose-this-private-value'}});
      const editor=await serve(editorDir,editorBase);
      env.PUBLIC_EDITOR_URL=editor.origin+editorBase+'/';
      const dir=build(name,env),{server,origin}=await serve(dir,base);
      assert(!fs.existsSync(path.join(dir,'studio.mjs')),'Site must not contain editor code');
      assert(!fs.existsSync(path.join(dir,'assets/engine')),'Site must consume runtime API, not copied source');
      assert(!fs.existsSync(path.join(editorDir,'product')),'Editor must not contain marketing pages');
      const context=await browser.newContext({reducedMotion:'reduce',viewport:{width:1440,height:1000}});
      const page=await context.newPage(),errors=[],requests=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
      const checked=new Set();
      try {
        for(const route of names) {
          await page.goto(`${origin}${base}/${route}`);
          await page.locator('.brand img').first().evaluate(img=>img.decode());
          if(await page.locator('[data-preview]').count()) await page.waitForFunction(()=>[...document.querySelectorAll('[data-preview]')].every(el=>el.dataset.ready==='true'));
          assert.equal(await page.locator('h1').count(),1);
          assert.equal(await page.locator('main').count(),1);
          assert.equal(await page.locator('script#public-config').textContent().then(s=>s.includes('never-expose')),false);
          const links=await page.locator('a[href],img[src],script[src],link[href]').evaluateAll(els=>els.map(el=>el.href||el.src));
          for(const link of links) {
            assert(!link.startsWith('javascript:'),'No executable navigation');
            if(!link.startsWith(origin))continue;
            const url=new URL(link),hash=url.hash;url.hash='';
            if(!checked.has(url.href)) {
              const response=await page.request.get(url.href);assert.equal(response.status(),200,`Broken link ${url.href}`);checked.add(url.href);
              if(hash)assert((await response.text()).includes(`id="${hash.slice(1)}"`),`Missing fragment ${link}`);
            } else if(hash) {
              const response=await page.request.get(url.href);assert((await response.text()).includes(`id="${hash.slice(1)}"`),`Missing fragment ${link}`);
            }
          }
          await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
          const accessibility=await page.evaluate(async()=>{
            const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});
            return {violations:r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target),help:v.help})),passes:r.passes.length};
          });
          assert.deepEqual(accessibility.violations,[],`${name}/${route}: ${JSON.stringify(accessibility.violations)}`);
          for(const width of [1440,390,320]) {
            await page.setViewportSize({width,height:1000});
            await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
            const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
            const overflowing=overflow?await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).slice(0,12).map(el=>({tag:el.tagName,cls:el.className?.baseVal??el.className,width:el.getBoundingClientRect().width,text:el.textContent.slice(0,60)}))):[];
            assert.equal(overflow,false,`Overflow ${name}/${route} at ${width}: ${JSON.stringify(overflowing)}`);
            if(width===390) {
              const violations=await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
              assert.deepEqual(violations,[],`Mobile accessibility ${name}/${route}: ${JSON.stringify(violations)}`);
            }
          }
          if(!route && name==='root') {
            await page.setViewportSize({width:390,height:844});
            await page.screenshot({path:path.join(evidence,'home-mobile.png'),fullPage:true});
            await page.setViewportSize({width:1440,height:1000});
            await page.screenshot({path:path.join(evidence,'home-desktop.png')});
          }
          report.pages.push({build:name,path:route||'/',accessibilityViolations:0,accessibilityPasses:accessibility.passes,accessibilityViewportWidths:[1440,390],viewportWidths:[1440,390,320]});
          await page.setViewportSize({width:1440,height:1000});
        }
        await page.goto(`${origin}${base}/examples/`);
        await page.waitForFunction(()=>[...document.querySelectorAll('[data-preview]')].every(el=>el.dataset.ready==='true'));
        assert.deepEqual(await page.locator('[data-preview]').evaluateAll(els=>els.map(el=>el.dataset.playing)),['false','false']);
        await page.getByRole('button',{name:'Say hello'}).click();
        assert.equal(await page.locator('.milo .demo-state').textContent(),'Hello');
        await page.getByRole('button',{name:'Back to idle'}).click();
        assert.equal(await page.locator('.milo .demo-state').textContent(),'Idle');
        await page.locator('.milo .motion-control').click();assert.equal(await page.locator('.milo').getAttribute('data-playing'),'true');
        await page.locator('.milo .motion-control').click();assert.equal(await page.locator('.milo').getAttribute('data-playing'),'false');
        await page.setViewportSize({width:390,height:844});
        await page.getByRole('button',{name:'Menu'}).click();assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'),'true');
        await page.keyboard.press('Escape');assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'),'false');
        assert.equal(await page.evaluate(()=>document.activeElement.id),'menu-toggle');
        await page.goto(`${origin}${base}/community/`);
        await page.getByRole('textbox',{name:'A short summary'}).fill('Useful editor feedback');
        await page.getByRole('textbox',{name:'Tell us a little more'}).fill('<img src=x onerror=alert(1)> Please add selection shortcuts.');
        await page.getByRole('button',{name:'Preview your feedback'}).click();
        assert.equal(await page.locator('#feedback-draft img').count(),0);
        assert((await page.locator('#feedback-draft').textContent()).includes('<img src=x'));
        const destination=new URL(await page.locator('#feedback-link').getAttribute('href'));
        if(name==='root') {assert.equal(destination.hostname,'github.com');assert.equal(destination.searchParams.get('title'),'[Idea] Useful editor feedback');}
        else {assert.equal(destination.href,env.PUBLIC_FEEDBACK_URL);for(const key of publicKeys.filter(k=>!['SITE_URL','BASE_PATH','EDITOR_URL','REPOSITORY_URL','FEEDBACK_URL','NEWSLETTER_URL'].includes(k))) {
          if(env['PUBLIC_'+key])assert(await page.locator(`a[href="${env['PUBLIC_'+key]}"]`).count()>0,`Configured ${key}`);
        }}
        assert.equal(requests.filter(r=>r.method!=='GET').length,0,'Feedback must never post');
        await page.goto(`${origin}${base}/editor/`);
        assert.equal(await page.locator('#stage').count(),0,'/editor is a public landing page');
        assert.equal(await page.getByRole('link',{name:'Open Evir Studio'}).getAttribute('href'),env.PUBLIC_EDITOR_URL.replace(/\/$/,''));
        await page.getByRole('link',{name:'Open Evir Studio'}).click();
        await page.waitForFunction(()=>window.evirStudio);
        assert(new URL(page.url()).origin===editor.origin,'Editor opens on a separate origin');
        await page.locator('#file').setInputFiles(path.join(root,'apps/site/assets/examples/milo.evir-project'));
        await page.locator('#replace-confirm').click();await page.waitForFunction(()=>evirStudio.snapshot().id==='milo-project');
        assert.equal(await page.evaluate(()=>evirStudio.snapshot().nodes.length),24);
        const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export .riv',exact:true}).click();
        const downloaded=await download;assert(downloaded.suggestedFilename().endsWith('.riv'));
        assert.deepEqual(fs.readFileSync(await downloaded.path()),fs.readFileSync(path.join(root,'apps/site/assets/examples/milo.riv')),'Editor export is unchanged after extraction');
        assert.equal(await page.locator('.brand-wordmark').locator('..').getAttribute('href'),'https://example.org/Evir/');
        assert.equal(await page.locator('#editor-config').textContent().then(s=>s.includes('never-expose')),false);
        report.checks.push(`${name}: separate editor origin, configured home link, project open and byte-identical export; independent artifacts`);
        await page.goto(`${origin}${base}/studio/`);
        await page.waitForURL(`${origin}${base}/editor/`);
        report.checks.push(`${name}: legacy /studio/ route redirects to /editor/ landing`);
        if(name==='prefix') {
          await page.goto(`${origin}${base}/`);assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),'https://example.org/Evir/');
          assert(fs.readFileSync(path.join(dir,'sitemap.xml'),'utf8').includes('https://example.org/Evir/editor/'));
        } else {
          await page.goto(`${origin}/community/`);
          assert.equal(await page.getByRole('link',{name:'Join the community',exact:true}).count(),0);
          assert(!fs.existsSync(path.join(dir,'sitemap.xml')));
          const noJS=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
          try {
            const fallback=await noJS.newPage();await fallback.goto(`${origin}/`);
            assert(await fallback.getByRole('navigation',{name:'Main navigation'}).isVisible());
            assert(await fallback.getByRole('link',{name:'Studio',exact:true}).isVisible());
            assert(await fallback.locator('.demo-poster').isVisible());
            assert(await fallback.locator('.motion-control').isDisabled());
            await fallback.goto(`${origin}/community/`);
            assert(await fallback.getByRole('button',{name:'Preview your feedback'}).isDisabled());
            assert(await fallback.locator('noscript').isVisible());
            report.checks.push('JavaScript disabled: mobile navigation/poster/links available; feedback cannot submit as a GET form');
          }finally{await noJS.close();}
        }
        assert.deepEqual(errors,[]);
        report.checks.push(`${name}: internal links/assets/fragments, feedback escaped and never submitted, motion pause/play, mobile menu Escape/focus, optional configuration`);
      } finally {await context.close();await new Promise(resolve=>server.close(resolve));await new Promise(resolve=>editor.server.close(resolve));}
    }
    report.checks.push('URL and output-directory validation; private environment values excluded');
    fs.writeFileSync(path.join(evidence,'browser.json'),JSON.stringify(report,null,2)+'\n');
    console.log(`Public site: ${report.pages.length} page/configuration checks; 3 viewport widths; no WCAG A/AA violations.`);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
