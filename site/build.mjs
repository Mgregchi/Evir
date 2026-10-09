import { readFile, writeFile, mkdir, rm, cp, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPublicConfig, route } from './config.mjs';
import { pages, escape } from './content.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const envFile=path.join(root,'site/.env');
try { await access(envFile); process.loadEnvFile(envFile); } catch(e) { if(e.code!=='ENOENT')throw e; }
const config=readPublicConfig();
const out=path.join(root,process.env.EVIR_SITE_OUTPUT||'site/dist');
const testOut=path.join(root,'site/.test-build');
if(out!==path.join(root,'site/dist') && !out.startsWith(testOut+path.sep))throw Error('EVIR_SITE_OUTPUT must be site/dist or a directory under site/.test-build/');
const icons = {
  '↗':'M4 12 12 4M4 4h8v8', '↓':'M8 2v11M3 8l5 5 5-5',
  '↔':'M2 8h12M5 5 2 8l3 3M11 5l3 3-3 3',
  '⌘':'M5 5h6v6H5zM5 5V3a2 2 0 1 0-2 2h2m6 0h2a2 2 0 1 0-2-2v2m0 6v2a2 2 0 1 0 2-2h-2m-6 0H3a2 2 0 1 0 2 2v-2',
};
const renderIcons = html => html.replace(/[↗↓↔⌘]/g, char => `<svg class="icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none"><path d="${icons[char]}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`).replaceAll('＋','+');
const required=['milo-poster.png','orbit-poster.png','studio-overview.png','studio-paths.png','studio-animation.png','studio-interact.png'];
for(const file of required) {
  try {await access(path.join(root,'site/assets',file));}
  catch {throw Error(`Missing real showcase asset ${file}. Run npm run site:assets first.`);}
}
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
await cp(path.join(root,'site/assets'),path.join(out,'assets'),{recursive:true});
for(const name of ['styles.css','app.mjs'])await cp(path.join(root,'site',name),path.join(out,'assets',name));
await mkdir(path.join(out,'assets/engine'),{recursive:true});
for(const name of ['model.mjs','motion.mjs','render-scene.mjs'])await cp(path.join(root,'editor',name),path.join(out,'assets/engine',name));
for(const [from,to] of [['evir-wordmark-display.png','wordmark.png'],['evir-favicon.png','favicon.png']])
  await cp(path.join(root,'editor/assets',from),path.join(out,'assets',to));
await cp(path.join(root,'editor'),path.join(out,'editor'),{recursive:true});
await mkdir(path.join(out,'research/schema'),{recursive:true});
for(const file of ['runtime.json','LICENSE.rive'])await cp(path.join(root,'research/schema',file),path.join(out,'research/schema',file));
// Add navigation in the distributed copy; preserve the editor source and behavior.
const editorIndex=path.join(out,'editor/index.html');
await writeFile(editorIndex,(await readFile(editorIndex,'utf8')).replace('href="./" aria-label="Evir character studio"','href="../" aria-label="Evir home"'));
const link=(target,label,active='',classes='')=>`<a class="${classes}" href="${route(config,target)}"${active===target?' aria-current="page"':''}>${label}</a>`;
const ext=(url,label)=>`<a href="${escape(url)}">${label}<span aria-hidden="true"> ↗</span></a>`;
const brand=`<img src="${route(config,'assets/wordmark.png')}" alt="Evir" width="108" height="36">`;
function header(current) {
  return `<a class="skip-link" href="#main">Skip to content</a><header class="site-header"><div class="header-inner wrap">
  <a class="brand" href="${route(config)}" aria-label="Evir home">${brand}</a><span class="header-divider" aria-hidden="true"></span><span class="header-note">A little more alive.</span>
  <button id="menu-toggle" class="menu-toggle" aria-expanded="false" aria-controls="site-nav">Menu <span aria-hidden="true">＋</span></button>
  <nav id="site-nav" aria-label="Main navigation">${[['studio/','Studio'],['examples/','Examples'],['learn/','Learn'],['community/','Community']].map(([url,label])=>link(url,label,current)).join('')}${link('editor/','Try the editor ↗',current,'nav-cta')}</nav></div></header>`;
}
function footer() {
 const socials=[['socialX','X'],['socialLinkedIn','LinkedIn'],['socialMastodon','Mastodon']].filter(([k])=>config[k]);
 const groups=[['Create',[link('studio/','Evir Studio'),link('examples/','Examples'),link('editor/','Open the editor')]],
 ['Explore',[link('learn/','Getting started'),ext(config.docs,'Documentation'),link('updates/','Project updates')]],
 ['Build together',[link('community/','Community'),link('contribute/','Contribute'),ext(config.feedback,'Feedback'),...(config.community?[ext(config.community,'Join the conversation')]:[])]],
 ['The project',[link('about/','About Evir'),link('roadmap/','Roadmap'),ext(config.repository,'GitHub'),...(config.contact?[ext(config.contact,'Contact')]:[])]]];
 return `<footer class="site-footer"><div class="wrap"><div class="footer-top"><div><a class="brand" href="${route(config)}" aria-label="Evir home">${brand}</a><p>Small characters.<br>Big possibilities.</p></div><div class="footer-invite"><span class="eyebrow">EARLY, OPEN & GROWING</span><h2>Make something<br>come alive.</h2>${link('editor/','Try the editor ↗','','button primary')}</div></div><div class="footer-links">${groups.map(([title,items])=>`<div><h3>${title}</h3>${items.join('')}</div>`).join('')}</div><div class="footer-bottom"><span>© ${new Date().getUTCFullYear()} Evir · Project code is MIT licensed.</span><div>${link('privacy/','Privacy')}${socials.map(([k,label])=>ext(config[k],label)).join('')}</div></div></div></footer>`;
}
const content=pages(config);
const canonical=(p)=>config.siteUrl?`${config.siteUrl}${route(config,p)}`:'';
for(const page of content) {
  const url=canonical(page.path), imageUrl=canonical('assets/studio-overview.png');
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#101815">
  <title>${escape(page.title)}</title><meta name="description" content="${escape(page.description)}"><meta property="og:type" content="website"><meta property="og:site_name" content="Evir"><meta property="og:title" content="${escape(page.title)}"><meta property="og:description" content="${escape(page.description)}"><meta name="twitter:card" content="summary_large_image">
  ${url?`<link rel="canonical" href="${escape(url)}"><meta property="og:url" content="${escape(url)}"><meta property="og:image" content="${escape(imageUrl)}"><meta property="og:image:alt" content="The actual Evir Studio editor with an original character">`:''}
  <link rel="icon" type="image/png" href="${route(config,'assets/favicon.png')}"><link rel="stylesheet" href="${route(config,'assets/styles.css')}"><script id="public-config" type="application/json">${JSON.stringify(config).replaceAll('<','\\u003c')}</script><script type="module" src="${route(config,'assets/app.mjs')}"></script></head>
  <body data-page="${page.path||'home'}">${renderIcons(header(page.path))}<main id="main">${renderIcons(page.body)}</main>${renderIcons(footer())}</body></html>`;
  const dir=path.join(out,page.path);await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'index.html'),html);
}
await writeFile(path.join(out,'404.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Page not found — Evir</title><link rel="stylesheet" href="${route(config,'assets/styles.css')}"><main class="page-intro wrap"><span class="eyebrow">404</span><h1>This page<br>has wandered off.</h1><p>${link('','Return to Evir home','','button primary')}</p></main></html>`);
await writeFile(path.join(out,'robots.txt'),`User-agent: *\nAllow: /\n${config.siteUrl?`Sitemap: ${canonical('sitemap.xml')}\n`:''}`);
if(config.siteUrl)await writeFile(path.join(out,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${content.map(p=>`<url><loc>${escape(canonical(p.path))}</loc></url>`).join('')}</urlset>`);
await writeFile(path.join(out,'.nojekyll'),'');
await writeFile(path.join(out,'build-info.json'),JSON.stringify({builtAt:new Date().toISOString(),pages:content.map(p=>p.path),basePath:config.basePath,configKeys:Object.keys(config)},null,2)+'\n');
console.log(`Built ${content.length} Evir pages, original examples and the working editor into ${path.relative(root,out)}${config.basePath?` for ${config.basePath}/`:''}`);
