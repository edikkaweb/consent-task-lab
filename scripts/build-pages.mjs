// Public teaching view, derived from the reviewed guide. No frozen source is rewritten.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, 'public');
const read = p => readFile(path.join(root,p), 'utf8');
function replace(source, before, after) {
  if (!source.includes(before)) throw new Error(`Guide source changed: ${before.slice(0,90)}`);
  return source.replaceAll(before, after);
}
await mkdir(out,{recursive:true});
let app = await read('guided/app.js');
app = "import {simulateOffer} from './simulation.mjs';\nimport {translate as t} from './copy.mjs';\n" + app;
app = replace(app, 'let config,expected,initialized=false', 'let expected,initialized=false');
app = replace(app, 'const setText=(root,selector,value)=>{', 'const write=(id,value)=>{$(id).textContent=t(value);};\nconst setText=(root,selector,value)=>{value=t(value);');
app = replace(app, "function announce(text){$('announcement').textContent=text;}", "function announce(text){write('announcement',text);}");
app = replace(app, 'if(node)node.textContent=text;', 'if(node)node.textContent=t(text);');
app = replace(app, "fetch(`${config.optionalOrigin}/offers?mode=${mode}&run=guided-${run.id}`,{credentials:'omit',signal:run.controller.signal})\n      .then(response=>{if(!response.ok)throw new Error(`HTTP ${response.status}`);return response.json();})", "simulateOffer(mode,{signal:run.controller.signal})");
const start = app.indexOf('try {\n  const responses=');
if(start<0)throw new Error('Guide startup changed');
app = app.slice(0,start) + `expected = ${JSON.stringify(JSON.parse(await read('tests/oracle.json')).shoes)};
reset();
for(const control of document.querySelectorAll('[data-mode]'))control.disabled=false;
initialized=true;
$('setup').hidden=true;
`;
// Each presentation assignment ends on its own source line; preserve the expressions.
app = app.replace(/\$\('([\w-]+)'\)\.textContent=(.*);$/gm,(_,id,value)=>`write('${id}',${value});`);
// This view deliberately uses no fetch: the original two-origin servers remain separate.
for(const [before,after] of [
  ['The offer request stays pending. Can the product task still finish?','The simulated offer stays pending. Can the product task still finish?'],
  ['The server closes the connection. An optional offer becomes unavailable.','The simulation rejects the offer. An optional service becomes unavailable.'],
  ['The server waits 600 ms before responding. If you wait before filtering, the offer may already be ready.','The simulation resolves after a 600 ms timer. If you wait before filtering, the offer may already be ready.'],
  ['Accepted. Both versions share one optional offer fetch.','Accepted. Both versions share one simulated offer.'],
  ['Rejected. No optional offer fetch is started.','Rejected. No optional offer simulation is started.'],
  ['Unavailable · request failed','Unavailable · simulated failure'],
  ['Waiting for response','Waiting for simulated offer'],
  ['Rejected. Now filter Shoes; no optional service is requested.','Rejected. Now filter Shoes; no optional offer is started.'],
  ['Both filters finished without an optional request. Refusal removed this dependency.','Both filters finished without an optional offer. Refusal removed this dependency.'],
]) app=replace(app,before,after);
await writeFile(path.join(out,'app.js'),app);
await Promise.all(['simulation.mjs','copy.mjs'].map(p=>copyFile(path.join(root,'pages-source',p),path.join(out,p))));
await Promise.all(['style.css','oracle.mjs'].map(p=>copyFile(path.join(root,'guided',p),path.join(out,p))));
let html = await read('pages-source/index-en.html');
const translations = JSON.parse(await read('pages-source/html-fr.json'));
await writeFile(path.join(out,'index-en.html'),html);
for(const [before,after] of translations)html=replace(html,before,after);
await writeFile(path.join(out,'index.html'),html);
await writeFile(path.join(out,'.nojekyll'),'');
if(process.argv.includes('--docs')) {
  const docs=path.join(root,'docs');
  await mkdir(docs,{recursive:true});
  for(const file of ['index.html','index-en.html','app.js','style.css','oracle.mjs','copy.mjs','simulation.mjs','.nojekyll'])await copyFile(path.join(out,file),path.join(docs,file));
}
console.log('Built public FR/EN teaching view; guided view and frozen instrument unchanged.');
