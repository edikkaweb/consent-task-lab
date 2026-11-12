import {chromium, firefox, webkit} from 'playwright';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startServers} from './server.mjs';
import {installOracle} from './observer.mjs';
import {schedule} from './protocol.mjs';
const oracle = JSON.parse(await readFile(new URL('../tests/oracle.json', import.meta.url)));
const engine = process.argv[2] || 'chromium';
const keyboardStep = process.argv[4] || 'Tab';
if (!['Tab','Alt+Tab'].includes(keyboardStep)) throw new Error('Keyboard step must be Tab or Alt+Tab');
const inputModes = process.argv[5] ? process.argv[5].split(',') : engine === 'firefox' ? ['keyboard'] : ['keyboard','touch'];
if (inputModes.some(mode=>!['keyboard','touch'].includes(mode))) throw new Error('Unknown input mode');
if (!['chromium','firefox','webkit'].includes(engine)) throw new Error('Unknown browser');
const outputName = process.argv[3] || `functional-${engine}-${new Date().toISOString().replace(/[:.]/g,'-')}`;
const out = new URL(`../results/${outputName}/`, import.meta.url);
console.log(`Functional evidence: ${out.pathname}`);
await mkdir(out, {recursive: false});
const results = [];
const servers = await startServers();
const browser = await ({chromium, firefox, webkit})[engine].launch({headless:true});
await writeFile(new URL('environment.json',out),JSON.stringify({engine,version:browser.version(),node:process.version,observedAt:new Date().toISOString(),keyboardStep,inputModes,note:'Functional checks only; not performance comparisons. Firefox touch emulation not included.'},null,2));
async function check(name, fn) {
  try {await fn(); results.push({name,pass:true});}
  catch (error) {results.push({name,pass:false,error:String(error.stack || error)});}
  await writeFile(new URL('checks.json',out),JSON.stringify(results,null,2));
  console.log(`${results.at(-1).pass ? 'PASS' : 'FAIL'} ${name}`);
}
async function keyboardTo(page, id) {
  for (let i=0; i<30; i++) {
    if (await page.evaluate((id)=>document.activeElement?.id===id,id)) {await page.keyboard.press('Enter'); return;}
    await page.keyboard.press(keyboardStep);
  }
  throw new Error(`Cannot reach ${id} by keyboard`);
}
try {
  for (const inputMode of inputModes) for (const cell of schedule(1)) {
    await check(`${inputMode}/${cell.variant}/${cell.consent}/${cell.mode}`,async()=>{
      const context=await browser.newContext(inputMode==='touch'?{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}:{viewport:{width:1280,height:1000}});
      try {
        if(cell.consent.startsWith('saved-'))await context.addInitScript((choice)=>localStorage.setItem('consent-task-choice',choice),cell.consent.slice(6));
        const page=await context.newPage();
        const requests=[];page.on('request',r=>requests.push(r.url()));
        const activate=async(id)=>inputMode==='keyboard'?keyboardTo(page,id):page.locator(`#${id}`).tap();
        await page.goto(`${servers.url}/?variant=${cell.variant}&mode=${cell.mode}&run=functional-${inputMode}-${cell.id}`);
        if(!cell.consent.startsWith('saved-'))await activate(cell.consent);
        await activate('open-filter');await activate('shoes');
        await page.waitForTimeout(850);
        const expectedSuccess=cell.variant==='independent'||cell.consent.endsWith('reject')||cell.mode==='normal';
        const visible=await page.locator('#products>li:visible').evaluateAll(items=>items.map(i=>({id:i.dataset.id,name:i.querySelector('h3').textContent})));
        if(expectedSuccess)assert.deepEqual(visible,oracle.shoes);
        else assert.notDeepEqual(visible,oracle.shoes);
        assert.equal(requests.filter(u=>u.startsWith('http://127.0.0.1:4177/')).length,cell.consent.endsWith('reject')?0:1);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        if(cell.variant==='independent'&&cell.consent==='accept'&&cell.mode==='normal')await page.screenshot({path:new URL(`${inputMode}.png`,out).pathname,fullPage:true});
      } finally {await context.close();}
    });
  }
  for(const choice of ['accept','reject'])await check(`actual-storage-reload/${choice}`,async()=>{
    const context=await browser.newContext();try{
      const page=await context.newPage();let requests=0;page.on('request',r=>{if(r.url().includes(':4177/'))requests++;});
      await page.goto(servers.url);await page.locator(`#${choice}`).click();await page.waitForTimeout(650);await page.reload();await page.waitForTimeout(650);
      assert.equal(await page.locator('#consent').isVisible(),false);
      assert.equal(await page.evaluate(()=>localStorage.getItem('consent-task-choice')),choice);
      assert.equal(requests,choice==='accept'?2:0);
    }finally{await context.close();}
  });
  for(const width of [390,1280])await check(`no-javascript/${width}`,async()=>{
    const context=await browser.newContext({javaScriptEnabled:false,viewport:{width,height:900}});try{
      const page=await context.newPage();let optional=0;page.on('request',r=>{if(r.url().includes(':4177/'))optional++;});
      await page.goto(servers.url);assert.equal(await page.locator('#products>li:visible').count(),6);assert.equal(optional,0);
      assert.equal(await page.locator('#open-filter').isVisible(),false);
    }finally{await context.close();}
  });
  await check('reduced-motion/independent/failure',async()=>{
    const context=await browser.newContext({reducedMotion:'reduce'});try{
      const page=await context.newPage();await page.goto(`${servers.url}/?variant=independent&mode=fail`);
      await page.locator('#accept').click();await page.locator('#open-filter').click();await page.locator('#shoes').click();
      assert.equal(await page.locator('#products>li:visible').count(),2);
    }finally{await context.close();}
  });
  await check('observer-negative-control/wrong-product-name',async()=>{
    const context=await browser.newContext();try{
      await context.addInitScript(installOracle,oracle.shoes);const page=await context.newPage();await page.goto(`${servers.url}/?variant=independent`);
      await page.locator('#reject').click();await page.locator('#open-filter').click();
      await page.locator('[data-id=shoe-01] h3').evaluate(e=>e.textContent='Wrong product');await page.locator('#shoes').click();await page.waitForTimeout(100);
      assert.equal(await page.evaluate(()=>window.verifier.firstCorrectDOM),null);
    }finally{await context.close();}
  });
  if (engine === 'chromium') await check('event-timing-and-long-task-positive-control',async()=>{
    const context=await browser.newContext();try{
      const page=await context.newPage();await page.goto(`${servers.url}/?variant=independent`);await page.locator('#reject').click();await page.locator('#open-filter').click();
      await page.evaluate(()=>document.querySelector('#shoes').addEventListener('click',()=>{const until=performance.now()+180;while(performance.now()<until){}},{capture:true}));
      await page.locator('#shoes').click();await page.waitForTimeout(400);
      const app=await page.evaluate(()=>window.lab);
      assert.ok(app.events.some(e=>e.target==='shoes'&&e.duration>=160&&e.interactionId>0));
      assert.ok(app.longTasks.some(e=>e.duration>=160));
      await writeFile(new URL('positive-control.json',out),JSON.stringify(app,null,2));
    }finally{await context.close();}
  });
  for(const variant of ['baseline','independent'])await check(`latest-selection-wins/${variant}`,async()=>{
    const context=await browser.newContext();try{
      const page=await context.newPage();await page.goto(`${servers.url}/?variant=${variant}`);await page.locator('#accept').click();await page.locator('#open-filter').click();await page.locator('#shoes').click();await page.locator('#bags').click();await page.waitForTimeout(700);
      assert.deepEqual(await page.locator('#products>li:visible').evaluateAll(items=>items.map(i=>({id:i.dataset.id,name:i.querySelector('h3').textContent}))),oracle.bags);
    }finally{await context.close();}
  });
}finally{await browser.close();await servers.close();}
if(results.some(r=>!r.pass))process.exitCode=1;
