import path from 'node:path';
import {readFile,writeFile,cp,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

// The host owns routing and output cleanup; Studio owns its UI bundle/template.
export async function buildStudio({outDir,basePath,homeUrl}) {
  const sourceRoot=fileURLToPath(new URL('./',import.meta.url));
  const config={basePath,publicSiteUrl:homeUrl};
  await mkdir(outDir,{recursive:true});
  await build({entryPoints:[path.join(sourceRoot,'studio.mjs')],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:path.join(outDir,'studio.mjs')});
  await cp(path.join(sourceRoot,'studio.css'),path.join(outDir,'studio.css'));
  await cp(new URL('../../assets/brand/',import.meta.url),path.join(outDir,'assets'),{recursive:true});
  await cp(new URL('../format/schema/LICENSE.rive',import.meta.url),path.join(outDir,'assets/LICENSE.rive'));
  const source=await readFile(path.join(sourceRoot,'index.html'),'utf8');
  const head=`<script id="editor-config" type="application/json">${JSON.stringify(config).replaceAll('<','\\u003c')}</script>`;
  const html=source.replace('</head>',head+'</head>').replace('href="./" aria-label="Evir character studio"',`href="${homeUrl.replaceAll('&','&amp;').replaceAll('"','&quot;')}" aria-label="Evir home"`);
  await writeFile(path.join(outDir,'index.html'),html);
}
