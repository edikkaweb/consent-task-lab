import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const types={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',mjs:'text/javascript; charset=utf-8'};
export async function startPagesServer(port=4230) {
 const server=createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=pathname.replace(/^\/consent-task-lab\//,'')||'index.html';
  if(!pathname.startsWith('/consent-task-lab/')||!/^[\w.-]+$/.test(file)){res.writeHead(404);res.end();return;}
  try{const data=await readFile(new URL('../public/'+file,import.meta.url));res.writeHead(200,{'content-type':types[file.split('.').at(-1)]||'text/plain','cache-control':'no-store'});res.end(data);}
  catch{res.writeHead(404);res.end();}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 return {url:`http://127.0.0.1:${server.address().port}/consent-task-lab/`,close:()=>new Promise(resolve=>server.close(resolve))};
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
 const server=await startPagesServer(Number(process.env.PAGES_PORT||4230));console.log(server.url);
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await server.close();process.exit(0);});
}
