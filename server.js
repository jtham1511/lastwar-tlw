import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleAction } from './lib/intel.js';

const root=fileURLToPath(new URL('./public/', import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const app=createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Cache-Control','no-store');
  if(req.url?.split('?')[0]==='/api/intel') {
    if(req.method!=='POST') { res.writeHead(405);res.end('Method not allowed');return; }
    try {
      let body=''; for await(const part of req) {body+=part; if(body.length>32768) throw Object.assign(new Error('Request too large'),{status:413});}
      const result=await handleAction(JSON.parse(body),req.headers['x-tlw-access-code']);
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({ok:true,data:result}));
    } catch(e) {
      res.writeHead(e.status||400,{'Content-Type':'application/json; charset=utf-8'});
      res.end(JSON.stringify({ok:false,error:e.message||'Request failed'}));
    }
    return;
  }
  let path=decodeURIComponent((req.url||'/').split('?')[0]);
  if(path==='/'||path==='/index.html') path='/index.html';
  if(!['/index.html','/style.css','/app.js','/favicon.svg'].includes(path)) {res.writeHead(404);res.end('Not found');return;}
  try {
    const bytes=await readFile(join(root,path.slice(1)));
    res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});res.end(bytes);
  } catch {res.writeHead(404);res.end('Not found');}
});
const port=Number(process.env.PORT||3000);
app.listen(port,()=>console.log(`TLW Intel running at http://localhost:${port}`));
