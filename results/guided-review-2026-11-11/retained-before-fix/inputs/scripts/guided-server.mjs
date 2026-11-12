// Separate teaching companion. Never used by the frozen measurement runner.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root = new URL('../', import.meta.url);
const types = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.md':'text/plain','.csv':'text/csv','.jsonl':'text/plain','.gz':'application/gzip'};
export async function startGuidedServers(port = 4190) {
  const requests = [], timers = new Set();
  const site = http.createServer(async (req,res) => {
    if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405).end();return;}
    const pathname = new URL(req.url,'http://localhost').pathname;
    res.setHeader('Cache-Control','no-store');
    if (pathname === '/guided/config.json') {res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({optionalOrigin:`http://127.0.0.1:${port+1}`}));return;}
    const aliases = {'/':'guided/index.html','/guided/':'guided/index.html','/lab/':'demo/index.html','/app.js':'demo/app.js','/style.css':'demo/style.css'};
    let file = aliases[pathname] || pathname.slice(1);
    // Allow only the self-contained public laboratory, not adjacent Edikka files.
    if (!/^(guided\/|article\/|results\/main\/|tests\/oracle\.json$|README\.md$|METHOD\.md$|demo\/(index\.html|app\.js|style\.css)$)/.test(file) || file.includes('..') || file.includes('%') || file.includes('\\')) {res.writeHead(404).end();return;}
    try {
      const bytes = await readFile(new URL(file,root));
      const ext = file.slice(file.lastIndexOf('.'));
      res.writeHead(200,{'Content-Type':(types[ext]||'application/octet-stream')+'; charset=utf-8','X-Content-Type-Options':'nosniff'});
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch {res.writeHead(404).end('Not found');}
  });
  const optional = http.createServer((req,res) => {
    const url = new URL(req.url,'http://localhost');
    if (url.pathname !== '/offers') {res.writeHead(404).end();return;}
    const entry = {mode:url.searchParams.get('mode'),run:url.searchParams.get('run'),receivedAt:new Date().toISOString(),response:'pending'};
    requests.push(entry);
    res.on('close',()=>{if(!res.writableEnded)req.socket.destroy();});
    res.setHeader('Access-Control-Allow-Origin',`http://127.0.0.1:${port}`);
    res.setHeader('Cache-Control','no-store');
    if (entry.mode === 'fail') {entry.response='connection-destroyed';req.socket.destroy();return;}
    if (entry.mode === 'hang') return;
    if (entry.mode !== 'normal') {res.writeHead(400).end();return;}
    const timer=setTimeout(()=>{timers.delete(timer);entry.response='200';res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({message:'Offer available: free delivery on this collection.'}));},600);
    timers.add(timer);
    res.on('close',()=>{clearTimeout(timer);timers.delete(timer);});
  });
  try {
    for (const [server,p] of [[site,port],[optional,port+1]]) await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(p,'127.0.0.1',resolve);});
  } catch (error) {site.close();optional.close();throw error;}
  return {url:`http://127.0.0.1:${port}`,requests,close:async()=>{
    for (const timer of timers) clearTimeout(timer);
    await Promise.all([site,optional].map(server=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}))); 
  }};
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const servers=await startGuidedServers(Number(process.env.GUIDED_PORT||4190));
  console.log(`Guided comparison: ${servers.url}\nFrozen lab UI: ${servers.url}/lab/\nArticle: ${servers.url}/article/article.html`);
  for(const signal of ['SIGINT','SIGTERM']) process.on(signal,async()=>{await servers.close();process.exit();});
}
