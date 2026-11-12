import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root = new URL('../demo/', import.meta.url);
export async function startServers(port = 4176) {
  const requests = [];
  const timers = new Set();
  const site = http.createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    const files = {'/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css']};
    if (!files[path]) {res.writeHead(404).end(); return;}
    const [name, type] = files[path];
    res.writeHead(200, {'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store'});
    res.end(await readFile(new URL(name, root)));
  });
  const optional = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const entry = {run: url.searchParams.get('run'), mode: url.searchParams.get('mode'), path: url.pathname, receivedAt: new Date().toISOString(), response: 'pending'};
    requests.push(entry);
    res.setHeader('Access-Control-Allow-Origin', `http://127.0.0.1:${port}`);
    res.setHeader('Cache-Control', 'no-store');
    if (entry.mode === 'fail') {entry.response = 'connection-destroyed'; req.socket.destroy(); return;}
    if (entry.mode === 'hang') return; // Held until context/server teardown; no timeout disguised as a failure.
    const timer = setTimeout(() => {
      timers.delete(timer); entry.response = '200'; entry.respondedAt = new Date().toISOString();
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({message: 'Offer available: free delivery on this collection.'}));
    }, 600);
    timers.add(timer);
  });
  try {
    for (const [server, p] of [[site, port], [optional, port + 1]]) {
      await new Promise((resolve, reject) => {server.once('error', reject); server.listen(p, '127.0.0.1', resolve);});
    }
  } catch (error) {site.close(); optional.close(); throw error;}
  return {url: `http://127.0.0.1:${port}`, requests, close: async () => {
    for (const timer of timers) clearTimeout(timer);
    await Promise.all([site, optional].map((s) => new Promise((r) => {s.closeAllConnections(); s.close(r);}))); 
  }};
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const servers = await startServers(Number(process.env.PORT || 4176));
  console.log(`Local: ${servers.url}`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {await servers.close(); process.exit();});
}
