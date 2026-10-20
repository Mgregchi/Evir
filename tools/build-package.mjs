import path from 'node:path';
import { readFile, mkdir, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const root = fileURLToPath(new URL('../', import.meta.url));
const dir = process.cwd(), manifest = JSON.parse(await readFile(path.join(dir, 'package.json')));
if (!dir.startsWith(path.join(root, 'packages') + path.sep)) throw Error('Run from a package workspace');
await mkdir(path.join(dir, 'dist'), { recursive: true });
await build({ entryPoints:[path.join(dir,'index.mjs')], bundle:true, format:'esm', platform:'neutral', target:'es2022', outfile:path.join(dir,'dist/index.mjs') });
if(manifest.name==='@evir/authoring'){
  // Paper's file/canvas extensions are unnecessary for the optional headless
  // curve kernel. Keep the standalone usable in both Node and browser workers.
  await build({entryPoints:[path.join(dir,'boolean.mjs')],bundle:true,format:'esm',platform:'neutral',target:'es2022',outfile:path.join(dir,'dist/boolean.mjs'),plugins:[{name:'paper-headless',setup(b){
    b.onResolve({filter:/^\.\/node\/(self|extend)\.js$/},a=>a.importer.replaceAll('\\','/').includes('/paper/dist/')?{path:a.path,namespace:'paper-headless'}:null);
    b.onLoad({filter:/.*/,namespace:'paper-headless'},a=>({contents:a.path.includes('self')?'module.exports={navigator:{userAgent:"node"}};':'module.exports=function(){};',loader:'js'}));
  }}]});
  await cp(path.join(dir,'LICENSE.paper'),path.join(dir,'dist/LICENSE.paper'));
}
await cp(path.join(root, 'LICENSE'), path.join(dir, 'LICENSE'));
await cp(path.join(root, 'LICENSE'), path.join(dir, 'dist/LICENSE'));
if (manifest.name === '@evir/format') await cp(path.join(dir,'schema/LICENSE.rive'), path.join(dir,'dist/LICENSE.rive'));
console.log(`Built ${manifest.name}@${manifest.version} standalone module`);
