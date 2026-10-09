import http from 'node:http';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=path.resolve(fileURLToPath(new URL('./dist/',import.meta.url)));
const info=JSON.parse(await readFile(path.join(root,'build-info.json'),'utf8'));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'application/javascript','.js':'application/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.xml':'application/xml','.txt':'text/plain','.evir-project':'application/json'};
const server=http.createServer(async(req,res)=>{
  try {
    let url=decodeURIComponent(new URL(req.url,'http://local').pathname);
    if(info.basePath) {
      if(!url.startsWith(info.basePath+'/')) {res.statusCode=404;return res.end('Not found');}
      url=url.slice(info.basePath.length);
    }
    let file=path.resolve(root,'.'+url);
    if(file!==root&&!file.startsWith(root+path.sep)) {res.statusCode=403;return res.end('Forbidden');}
    if((await stat(file)).isDirectory())file=path.join(file,'index.html');
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
    res.end(await readFile(file));
  }catch{res.statusCode=404;res.setHeader('Content-Type','text/html');res.end(await readFile(path.join(root,'404.html')));}
});
server.listen(Number(process.env.PORT||8787),'127.0.0.1',()=>console.log(`Evir site serving on port ${server.address().port}; base path ${info.basePath||'/'}`));
