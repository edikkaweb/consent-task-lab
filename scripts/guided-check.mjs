// Functional regression checks for the teaching companion, never campaign measurements.
import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {startGuidedServers} from './guided-server.mjs';
const output=process.argv[2];
if(!output)throw new Error('Supply a NEW evidence directory outside results/main');
await mkdir(output,{recursive:false});
const engine=process.argv[3]||'chromium';
const inputFiles=['guided/index.html','guided/style.css','guided/app.js','guided/oracle.mjs','scripts/guided-server.mjs','scripts/guided-check.mjs','tests/oracle.json','package-lock.json'];
async function sourceHashes(){return Object.fromEntries(await Promise.all(inputFiles.map(async file=>[file,createHash('sha256').update(await readFile(new URL('../'+file,import.meta.url))).digest('hex')])));}
const sources=await sourceHashes();
const server=await startGuidedServers(Number(process.env.GUIDED_TEST_PORT||4210));
const browser=await ({chromium,firefox,webkit}[engine]).launch({headless:true});
const environment={node:process.version,platform:process.platform,arch:process.arch,browser:browser.version(),playwright:createRequire(import.meta.url)('playwright/package.json').version};
const checks=[],failures=[],requestAccounting=[];const expected=['Canvas trainer','Walking shoe'];
async function check(name,fn){try{await fn();checks.push({name,pass:true});}catch(e){failures.push({name,error:String(e),stack:e.stack});checks.push({name,pass:false});}}
async function ready(options={}){const context=await browser.newContext({viewport:{width:1280,height:1000},...options});
  await context.addInitScript(()=>{window.guideFetchCalls=[];const original=window.fetch;window.fetch=function(...args){if(String(args[0]).includes('/offers?'))window.guideFetchCalls.push(String(args[0]));return original.apply(this,args);};});
  const page=await context.newPage();await page.goto(server.url);await page.locator('#accept').waitFor({state:'visible'});await page.waitForFunction(()=>!document.getElementById('accept').disabled);return{context,page};}
async function result(page){await page.waitForFunction(()=>document.getElementById('checkpoint').dataset.state==='done');return await page.locator('[data-variant]').evaluateAll(nodes=>nodes.map(n=>({variant:n.dataset.variant,verdict:n.dataset.verdict,names:[...n.querySelectorAll('.products>li:not([hidden]) h3')].map(x=>x.textContent),input:n.querySelector('.input-state').textContent,atInput:n.querySelector('.offer-at-input').textContent})));}
try{
 for(const mode of ['hang','fail','normal'])for(const choice of ['accept','reject'])await check(`${engine}: ${mode}/${choice}`,async()=>{
   const {context,page}=await ready();const before=server.requests.length;
   const errors=[];page.on('pageerror',error=>errors.push(String(error)));
   try{
    await page.locator(`[data-mode="${mode}"]`).click();await page.locator('#'+choice).click();
    if(choice==='accept'&&mode==='fail')await page.waitForFunction(()=>document.querySelector('.offer-state').textContent.includes('Unavailable'));
    if(choice==='accept'&&mode==='normal')await page.waitForFunction(()=>document.querySelector('.offer-state').textContent.includes('Offer available'));
    await page.locator('#filter').click();
    if(mode==='hang'&&choice==='accept')assert.equal(await page.locator('[data-variant=baseline] .result-state').textContent(),'No correct result yet');
    const rows=await result(page);
    assert.deepEqual(rows.map(r=>r.input),['Handled','Handled']);
    assert.equal(rows[0].verdict,choice==='reject'||mode==='normal'?'complete':mode==='fail'?'error':'incomplete');
    assert.equal(rows[1].verdict,'complete');assert.deepEqual(rows[1].names,expected);
    if(rows[0].verdict==='complete')assert.deepEqual(rows[0].names,expected);else assert.equal(rows[0].names.length,6);
    const fetchCalls=await page.evaluate(()=>window.guideFetchCalls);
    const receipts=server.requests.slice(before);
    assert.equal(fetchCalls.length,choice==='accept'?1:0,'One shared application fetch on acceptance, zero on refusal');
    if(choice==='reject')assert.equal(receipts.length,0,'Refusal: no transport attempt');
    else if(mode==='fail'){assert.ok(receipts.length>=1);assert.ok(receipts.every(r=>r.run===receipts[0].run&&r.response==='connection-destroyed'));}
    else assert.equal(receipts.length,1);
    requestAccounting.push({mode,choice,applicationFetchCalls:fetchCalls.length,serverReceipts:receipts});
    if(choice==='accept'&&mode==='fail')assert.ok(rows.every(r=>r.atInput.includes('already failed')));
    if(choice==='accept'&&mode==='normal')assert.ok(rows.every(r=>r.atInput.includes('already available')));
    assert.deepEqual(errors,[]);
    if(mode==='hang'&&choice==='accept')await page.screenshot({path:`${output}/desktop-pending.png`,fullPage:true});
   }finally{await context.close();}
 });
 await check('offer pending at click, then resolved: takeaway describes the actual wait',async()=>{
   const {context,page}=await ready();let release;const gate=new Promise(resolve=>release=resolve);try{
    await page.route('**/offers?*',async route=>{await gate;await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':server.url},body:JSON.stringify({message:'Offer available: controlled test response.'})});});
    await page.locator('[data-mode=normal]').check();await page.locator('#accept').click();await page.locator('#filter').click();
    assert.ok((await page.locator('.offer-at-input').allTextContents()).every(t=>t.includes('still waiting')));release();
    assert.deepEqual((await result(page)).map(r=>r.verdict),['complete','complete']);assert.ok((await page.locator('#takeaway').textContent()).includes('Version A waited'));
   }finally{release();await context.close();}
 });
 await check('persisted page lifecycle restores a fresh usable comparison',async()=>{
   const {context,page}=await ready();try{
    await page.locator('#accept').click();await page.locator('#filter').click();
    await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
    assert.ok(await page.locator('#filter').isDisabled());assert.ok(await page.locator('#accept').isEnabled());
    await page.locator('#reject').click();await page.locator('#filter').click();assert.deepEqual((await result(page)).map(r=>r.verdict),['complete','complete']);
   }finally{await context.close();}
 });
 await check('failed configuration cannot become interactive on page restore',async()=>{
   const context=await browser.newContext();const page=await context.newPage();try{
    await page.route('**/guided/config.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({optionalOrigin:'http://127.0.0.1:1'})}));
    await page.goto(server.url);await page.waitForFunction(()=>document.getElementById('setup').textContent.includes('not localhost'));
    await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));assert.ok(await page.locator('#accept').isDisabled());
   }finally{await context.close();}
 });
 await check('a DOM fault stays a harness error and cannot skip the other panel',async()=>{
   const {context,page}=await ready();try{
    await page.locator('#reject').click();
    await page.evaluate(()=>Object.defineProperty(document.querySelector('[data-variant=baseline] .products>li'),'hidden',{set(){throw new Error('Injected DOM fault');}}));
    await page.locator('#filter').click();assert.deepEqual((await result(page)).map(r=>r.verdict),['harness','complete']);
    assert.ok((await page.locator('#takeaway').textContent()).includes('does not establish a comparison'));
    assert.equal(await page.locator('[data-variant=baseline] .result-state').textContent(),'Teaching-view error');
   }finally{await context.close();}
 });
 for(const timing of ['before-filter','during-observation'])await check(`persistent oracle fault ${timing}: healthy panel still receives its checkpoint`,async()=>{
   const {context,page}=await ready();const errors=[];page.on('pageerror',e=>errors.push(String(e)));try{
    await page.locator('#reject').click();
    const inject=()=>page.evaluate(()=>{
      const list=document.querySelector('[data-variant=baseline] .products');
      window.oracleFaultReads=0;
      Object.defineProperty(list,'children',{get(){window.oracleFaultReads++;throw new Error('Injected persistent oracle fault');},configurable:true});
      list.firstElementChild.setAttribute('data-fault-trigger','1');
    });
    if(timing==='before-filter')await inject();
    await page.locator('#filter').click();
    if(timing==='during-observation'){
      await page.waitForFunction(()=>document.querySelector('[data-variant=baseline] .result-state').textContent==='Exact pair verified');
      await inject();
    }
    await page.waitForFunction(()=>document.getElementById('checkpoint').dataset.state==='done',null,{timeout:4000});
    assert.deepEqual((await result(page)).map(r=>r.verdict),['harness','complete']);
    assert.equal(await page.locator('[data-variant=baseline] .result-state').textContent(),'Teaching-view error');
    assert.equal(await page.evaluate(()=>window.oracleFaultReads),1,'The failing oracle is not read again at checkpoint');
    await page.evaluate(()=>document.querySelector('[data-variant=baseline] .products').firstElementChild.setAttribute('data-fault-trigger','2'));
    // A DOM round trip drains MutationObserver delivery without adding a timing assumption.
    assert.equal(await page.evaluate(()=>window.oracleFaultReads),1,'The failed panel observer is disconnected');
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
 });
 await check('a later service rejection cannot overwrite a prior observer fault',async()=>{
   const {context,page}=await ready();let release;const gate=new Promise(resolve=>release=resolve);const errors=[];page.on('pageerror',e=>errors.push(String(e)));try{
    await page.route('**/offers?*',async route=>{await gate;await route.abort('failed');});
    await page.locator('[data-mode=normal]').check();await page.locator('#accept').click();await page.locator('#filter').click();
    await page.evaluate(()=>{
      const list=document.querySelector('[data-variant=baseline] .products');
      Object.defineProperty(list,'children',{get(){throw new Error('Injected pending observer fault');}});
      list.firstElementChild.setAttribute('data-fault-trigger','1');
    });
    await page.waitForFunction(()=>document.querySelector('[data-variant=baseline] .result-state').textContent==='Teaching-view error');release();
    await page.waitForFunction(()=>document.querySelector('.offer-state').textContent.includes('Unavailable'));
    assert.deepEqual((await result(page)).map(r=>r.verdict),['harness','complete']);
    assert.ok((await page.locator('[data-variant=baseline] .feedback').textContent()).startsWith('Teaching-view error'));
    assert.deepEqual(errors,[]);
   }finally{release();await context.close();}
 });
 await check('wrong baseline result after refusal does not imply an optional request caused it',async()=>{
   const {context,page}=await ready();try{
    await page.evaluate(()=>document.querySelector('[data-variant=baseline] [data-id=shoe-01] h3').textContent='Wrong shoe');
    await page.locator('#reject').click();await page.locator('#filter').click();
    assert.deepEqual((await result(page)).map(r=>r.verdict),['incomplete','complete']);
    assert.equal(await page.locator('[data-variant=baseline] .result-state').textContent(),'No correct result');
    assert.ok((await page.locator('#takeaway').textContent()).includes('missing or incorrect product pair'));
    assert.equal(await page.evaluate(()=>window.guideFetchCalls.length),0);
   }finally{await context.close();}
 });
 await check('panel isolation and wrong-name negative control',async()=>{
   const {context,page}=await ready();try{
    await page.evaluate(()=>document.querySelector('[data-variant=independent] [data-id=shoe-01] h3').textContent='Wrong shoe');
    await page.locator('#reject').click();await page.locator('#filter').click();const rows=await result(page);
    assert.equal(rows[0].verdict,'complete');assert.equal(rows[1].verdict,'incomplete');
   }finally{await context.close();}
 });
 await check('an early matching DOM does not excuse a wrong final result',async()=>{
   const {context,page}=await ready();try{
    await page.locator('#reject').click();await page.locator('#filter').click();
    await page.waitForFunction(()=>document.querySelector('[data-variant=independent] .result-state').textContent==='Exact pair verified');
    await page.evaluate(()=>document.querySelector('[data-variant=independent] [data-id=shoe-02] h3').textContent='Wrong final shoe');
    const rows=await result(page);assert.equal(rows[1].verdict,'incomplete');
   }finally{await context.close();}
 });
 await check('ten pending resets release connections; normal still completes',async()=>{
   const {context,page}=await ready();const errors=[];page.on('pageerror',e=>errors.push(String(e)));try{
    for(let i=0;i<10;i++){await page.locator('#accept').click();await page.locator('#filter').click();await page.locator('#replay').click();}
    await page.locator('[data-mode=normal]').click();await page.locator('#accept').click();await page.locator('#filter').click();
    const rows=await result(page);assert.deepEqual(rows.map(r=>r.verdict),['complete','complete']);assert.deepEqual(errors,[]);
    assert.ok(!await page.locator('.feedback').allTextContents().then(x=>x.some(t=>t.includes('error'))));
   }finally{await context.close();}
 });
 await check('late old response cannot alter the new rejected attempt',async()=>{
   const {context,page}=await ready();let release;const gate=new Promise(resolve=>release=resolve);try{
    await page.route('**/offers?*',async route=>{await gate;try{await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':server.url},body:JSON.stringify({message:'STALE OFFER'})});}catch{/* The cancelled browser request may already be gone. */}});
    await page.locator('[data-mode=normal]').click();await page.locator('#accept').click();await page.locator('#filter').click();
    await page.locator('#replay').click();await page.locator('#reject').click();release();await page.locator('#filter').click();
    assert.deepEqual((await result(page)).map(r=>r.verdict),['complete','complete']);
    assert.ok((await page.locator('.offer-state').allTextContents()).every(t=>t.includes('rejected')));
   }finally{release();await context.close();}
 });
 await check('keyboard, mobile, reduced motion and accessible status summary',async()=>{
   const {context,page}=await ready({viewport:{width:390,height:844},reducedMotion:'reduce'});try{
    await page.locator('#accept').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#filter').evaluate(el=>document.activeElement===el),true);
    await page.keyboard.press('Enter');assert.equal(await page.locator('#filter').evaluate(el=>document.activeElement===el),true);
    const rows=await result(page);assert.deepEqual(rows.map(r=>r.verdict),['incomplete','complete']);
    assert.equal(await page.locator('[aria-live], [role=status]').filter({visible:true}).count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.equal(await page.locator('input[type=radio][name=mode]').count(),3);
    await page.screenshot({path:`${output}/mobile-pending.png`,fullPage:true});
    await page.setViewportSize({width:320,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   }finally{await context.close();}
 });
 await check('no JavaScript: catalog and method remain readable; no optional requests',async()=>{
   const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const page=await context.newPage();const before=server.requests.length;try{
    await page.goto(server.url);assert.equal(await page.locator('.products>li').count(),12);assert.equal(await page.locator('noscript').isVisible(),true);assert.equal(server.requests.length,before);
    await page.screenshot({path:`${output}/no-js.png`,fullPage:true});
    assert.ok(await page.locator('#filter').isDisabled());assert.equal(await page.locator('#setup').isVisible(),false,'No perpetual preparation message with JavaScript disabled');
   }finally{await context.close();}
 });
 await check('original UI source remains exact on the companion server',async()=>{
   const res=await fetch(server.url+'/lab/');assert.equal(res.status,200);
   const original=await readFile(new URL('../demo/index.html',import.meta.url));assert.equal(createHash('sha256').update(await res.text()).digest('hex'),createHash('sha256').update(original).digest('hex'));
 });
}finally{
 await browser.close();await server.close();
 if(JSON.stringify(sources)!==JSON.stringify(await sourceHashes()))failures.push({name:'source stability',error:'Inputs changed while checks were running'});
 await writeFile(`${output}/checks.json`,JSON.stringify({engine,environment,sources,checkedAt:new Date().toISOString(),scope:'Functional teaching-view checks, excluded from campaign; lifecycle restore is a synthetic PageTransitionEvent check, not a claim about actual cache eligibility',checks,requestAccounting,failures,pass:failures.length===0},null,2)+'\n');
 console.log(JSON.stringify({engine,passed:checks.filter(c=>c.pass).length,failed:failures.length,failures},null,2));
}
if(failures.length)process.exitCode=1;
