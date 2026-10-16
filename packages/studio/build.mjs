import path from 'node:path';
import {readFile,writeFile,cp,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {livingLoader} from '@evir/ui';

// The host owns routing and output cleanup; Studio owns its UI bundle/template.
export async function buildStudio({outDir,basePath,homeUrl}) {
  const sourceRoot=fileURLToPath(new URL('./',import.meta.url));
  const config={basePath,publicSiteUrl:homeUrl};
  await mkdir(outDir,{recursive:true});
  await build({entryPoints:[path.join(sourceRoot,'studio.mjs')],bundle:true,splitting:true,format:'esm',platform:'browser',target:'es2022',outdir:outDir,chunkNames:'chunks/[name]-[hash]',outExtension:{'.js':'.mjs'}});
  const runtimeDir=path.dirname(fileURLToPath(import.meta.resolve('@rive-app/canvas')));
  await mkdir(path.join(outDir,'assets'),{recursive:true});
  await cp(path.join(runtimeDir,'rive.wasm'),path.join(outDir,'assets/rive-view.wasm'));
  await cp(path.join(runtimeDir,'rive_fallback.wasm'),path.join(outDir,'assets/rive-view-fallback.wasm'));
  await cp(path.join(sourceRoot,'licenses/LICENSE.perfect-freehand'),path.join(outDir,'assets/LICENSE.perfect-freehand'));
  await cp(path.join(sourceRoot,'licenses/LICENSE.rive-runtime'),path.join(outDir,'assets/LICENSE.rive-runtime'));
  await writeFile(path.join(outDir,'studio.css'),(await readFile(path.join(sourceRoot,'studio.css'),'utf8'))+'\n'+(await readFile(new URL('../ui/styles.css',import.meta.url),'utf8')));
  await cp(new URL('../../assets/brand/',import.meta.url),path.join(outDir,'assets'),{recursive:true});
  await cp(new URL('../../assets/fonts/NotoSans-latin.ttf',import.meta.url),path.join(outDir,'assets/NotoSans-latin.ttf'));
  await cp(new URL('../../assets/fonts/OFL-NotoSans.txt',import.meta.url),path.join(outDir,'assets/OFL-NotoSans.txt'));
  await cp(new URL('../format/schema/LICENSE.rive',import.meta.url),path.join(outDir,'assets/LICENSE.rive'));
  const source=await readFile(path.join(sourceRoot,'index.html'),'utf8');
  const head=`<script id="editor-config" type="application/json">${JSON.stringify(config).replaceAll('<','\\u003c')}</script>`;
  const html=source.replace('<!-- LIVING_LOADER -->',livingLoader('Studio is waking up…')).replaceAll('<!-- STUDIO_RECOVERY_LINK -->',`<a href="${homeUrl.replaceAll('&','&amp;').replaceAll('"','&quot;')}">Return home</a>`).replace('</head>',head+'</head>').replace('href="./" aria-label="Evir character studio"',`href="${homeUrl.replaceAll('&','&amp;').replaceAll('"','&quot;')}" aria-label="Evir Studio home"`);
  await writeFile(path.join(outDir,'index.html'),html);
}
