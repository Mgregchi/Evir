import http from 'node:http';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.xml':'application/xml','.txt':'text/plain','.evir-project':'application/json'};
export function createStaticServer(root, basePath='') {
  root=path.resolve(root);
  return http.createServer(async(req,res)=>{
    try {
      const parsed=new URL(req.url,'http://localhost');let url=decodeURIComponent(parsed.pathname);
      if(basePath) {
        if(url===basePath){res.writeHead(301,{location:basePath+'/'+parsed.search});return res.end();}
        if(!url.startsWith(basePath+'/')){res.writeHead(404);return res.end('Not found');}url=url.slice(basePath.length);
      }
      let file=path.resolve(root,'.'+url);
      if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end('Forbidden');}
      if((await stat(file)).isDirectory()) {
        if(!url.endsWith('/')){res.writeHead(301,{location:parsed.pathname+'/'+parsed.search});return res.end();}file=path.join(file,'index.html');
      }
      res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));
    }catch {
      res.statusCode=404;res.setHeader('Content-Type','text/html');
      try{res.end(await readFile(path.join(root,'404.html')));}catch{res.end('Not found');}
    }
  });
}
export async function serveBuild(root, defaultPort) {
  const info=JSON.parse(await readFile(path.join(root,'build-info.json'),'utf8'));
  const server=createStaticServer(root,info.basePath);
  server.listen(Number(process.env.PORT||defaultPort),'127.0.0.1',()=>console.log(`Evir serving at http://127.0.0.1:${server.address().port}${info.basePath}/`));
}
