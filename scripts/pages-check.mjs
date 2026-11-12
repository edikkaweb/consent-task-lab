// Functional observations only, never measurements added to the frozen campaign.
import {chromium,firefox,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {startPagesServer} from './pages-server.mjs';
const output=process.argv[2],engine=process.argv[3]||'chromium';
if(!output)throw new Error('Supply a new evidence directory');
await mkdir(output,{recursive:false});
const sources={};for(const file of await readdir(new URL('../public/',import.meta.url)))sources[file]=createHash('sha256').update(await readFile(new URL('../public/'+file,import.meta.url))).digest('hex');
const server=await startPagesServer(0),browser=await ({chromium,firefox,webkit}[engine]).launch();
const checks=[];
async function check(name,fn){try{await fn();checks.push({name,pass:true});}catch(e){checks.push({name,pass:false,error:String(e),stack:e.stack});}}
async function ready(lang,options={}){
 const context=await browser.newContext({viewport:{width:1280,height:1000},...options});const page=await context.newPage();
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>requests.push(r.url()));
 await page.goto(server.url+(lang==='en'?'index-en.html':'index.html'));
 if(options.javaScriptEnabled!==false)await page.waitForFunction(()=>!document.getElementById('accept').disabled);
 return {context,page,errors,requests};
}
async function results(page){await page.waitForFunction(()=>document.getElementById('checkpoint').dataset.state==='done');return page.locator('[data-variant]').evaluateAll(nodes=>nodes.map(n=>({verdict:n.dataset.verdict,products:[...n.querySelectorAll('.products>li:not([hidden])')].map(x=>({id:x.dataset.id,name:x.querySelector('h3').textContent}))})));}
const pair=[{id:'shoe-01',name:'Canvas trainer'},{id:'shoe-02',name:'Walking shoe'}];
try{
 for(const lang of ['fr','en']){
  for(const mode of ['hang','fail','normal'])for(const choice of ['accept','reject'])await check(`${lang} ${mode}/${choice}`,async()=>{
   const {context,page,errors,requests}=await ready(lang);try{
    assert.equal(await page.locator('html').getAttribute('lang'),lang);
    await page.locator(`[data-mode=${mode}]`).check();await page.locator('#'+choice).click();await page.locator('#filter').click();
    const rows=await results(page);
    assert.deepEqual(rows.map(r=>r.verdict),[choice==='reject'||mode==='normal'?'complete':mode==='fail'?'error':'incomplete','complete']);
    assert.deepEqual(rows[1].products,pair);if(rows[0].verdict==='complete')assert.deepEqual(rows[0].products,pair);else assert.equal(rows[0].products.length,6);
    assert.ok((await page.locator('#checkpoint').textContent()).startsWith(lang==='fr'?'Attend l’offre :':'Waits for offer:'));
    assert.deepEqual(await page.locator('.input-state').allTextContents(),lang==='fr'?['Exécuté','Exécuté']:['Handled','Handled']);
    assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);assert.deepEqual(await context.cookies(),[]);
    assert.ok(requests.every(url=>url.startsWith(server.url)),'No external service, analytics or absolute-path requests');
    assert.equal(requests.filter(url=>/offers|config\.json/.test(url)).length,0);
    assert.deepEqual(errors,[]);
    if(mode==='hang'&&choice==='accept')await page.screenshot({path:`${output}/${lang}-desktop.png`,fullPage:true});
   }finally{await context.close();}
  });
  await check(`${lang} language navigation and document links`,async()=>{
   const {context,page}=await ready(lang);try{
    const target=lang==='fr'?'en':'fr';await page.locator(`nav a[hreflang=${target}]`).click();assert.equal(await page.locator('html').getAttribute('lang'),target);
    assert.equal(await page.locator('a[href*="article/"]').count(),0);
    assert.equal(await page.locator('link[rel=alternate][hreflang=fr]').count(),1);
    assert.equal(await page.locator('link[rel=alternate][hreflang=en]').count(),1);
    assert.ok((await page.locator('link[rel=canonical]').getAttribute('href')).endsWith(target==='en'?'index-en.html':'/'));
   }finally{await context.close();}
  });
  await check(`${lang} reset cancels late offer and clears choice`,async()=>{
   const {context,page,errors}=await ready(lang);try{
    await page.locator('[data-mode=normal]').check();await page.locator('#accept').click();await page.locator('#filter').click();await page.locator('#replay').click();
    await page.waitForTimeout(750);assert.ok(await page.locator('#filter').isDisabled());assert.deepEqual(await page.locator('[data-variant]').evaluateAll(nodes=>nodes.map(n=>n.dataset.verdict)),['idle','idle']);
    assert.deepEqual(await page.locator('.offer-state').allTextContents(),lang==='fr'?['Non demandé','Non demandé']:['Not requested','Not requested']);assert.deepEqual(errors,[]);
   }finally{await context.close();}
  });
  await check(`${lang} wrong product cannot pass`,async()=>{
   const {context,page}=await ready(lang);try{
    await page.locator('#reject').click();await page.locator('#filter').click();await page.locator('[data-variant=independent] [data-id=shoe-02] h3').evaluate(n=>n.textContent='Wrong product');
    assert.deepEqual((await results(page)).map(r=>r.verdict),['complete','incomplete']);
   }finally{await context.close();}
  });
  await check(`${lang} oracle failure stays isolated`,async()=>{
   const {context,page,errors}=await ready(lang);try{
    await page.locator('#reject').click();await page.evaluate(()=>Object.defineProperty(document.querySelector('[data-variant=baseline] .products'),'children',{get(){throw new Error('Injected oracle fault');}}));
    await page.locator('#filter').click();assert.deepEqual((await results(page)).map(r=>r.verdict),['harness','complete']);assert.deepEqual(errors,[]);
   }finally{await context.close();}
  });
  await check(`${lang} keyboard, mobile and reduced motion`,async()=>{
   const {context,page}=await ready(lang,{viewport:{width:390,height:844},reducedMotion:'reduce'});try{
    // WebKit/macOS uses Option-Tab for native buttons with its default keyboard setting.
    const tab=engine==='webkit'?'Alt+Tab':'Tab';let reached=false;
    for(let i=0;i<25;i++){await page.keyboard.press(tab);if(await page.locator('#reject').evaluate(n=>n===document.activeElement)){reached=true;break;}}
    assert.ok(reached,'Native rejection button reached by documented keyboard navigation');await page.keyboard.press('Enter');assert.ok(await page.locator('#filter').evaluate(n=>n===document.activeElement));await page.keyboard.press('Enter');
    assert.deepEqual((await results(page)).map(r=>r.verdict),['complete','complete']);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
    await page.screenshot({path:`${output}/${lang}-mobile.png`,fullPage:true});
   }finally{await context.close();}
  });
  await check(`${lang} JavaScript off retains catalog and explanation`,async()=>{
   const {context,page}=await ready(lang,{javaScriptEnabled:false});try{assert.ok(await page.locator('#accept').isDisabled());assert.equal(await page.locator('.products>li').count(),12);assert.ok(await page.locator('.no-js').isVisible());assert.ok(await page.locator('#setup').isHidden());}finally{await context.close();}
  });
 }
 await check('persisted lifecycle restores an interactive fresh attempt',async()=>{
  const {context,page}=await ready('en');try{await page.locator('#accept').click();await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});assert.ok(await page.locator('#accept').isEnabled());await page.locator('#reject').click();await page.locator('#filter').click();assert.deepEqual((await results(page)).map(r=>r.verdict),['complete','complete']);}finally{await context.close();}
 });
}finally{
 await writeFile(`${output}/checks.json`,JSON.stringify({at:new Date().toISOString(),engine,browser:browser.version(),node:process.version,sources,checks,passed:checks.filter(c=>c.pass).length,total:checks.length},null,2)+'\n');
 await browser.close();await server.close();
}
const failures=checks.filter(c=>!c.pass);console.log(JSON.stringify({engine,passed:checks.length-failures.length,total:checks.length,failures},null,2));if(failures.length)process.exitCode=1;
