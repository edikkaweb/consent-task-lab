import {WINDOW_MS,readProducts,matches,classify,observeProducts} from './oracle.mjs';
const $ = id => document.getElementById(id);
const panels = [...document.querySelectorAll('[data-variant]')];
const modeText = {
  hang:'The offer request stays pending. Can the product task still finish?',
  fail:'The server closes the connection. An optional offer becomes unavailable.',
  normal:'The server waits 600 ms before responding. If you wait before filtering, the offer may already be ready.'
};
let config,expected,initialized=false,mode='hang',attempt=null,sequence=0;
const setText=(root,selector,value)=>{const node=root.querySelector(selector);if(node.textContent!==value)node.textContent=value;};
function announce(text){$('announcement').textContent=text;}
function dispose() {
  if (!attempt) return;
  attempt.active=false;clearTimeout(attempt.timer);
  attempt.controller.abort();
  for(const p of attempt.panels)p.disconnect?.();
}
function reset(nextMode=mode) {
  dispose();mode=nextMode;
  attempt={id:++sequence,active:true,choice:null,inputAt:null,checked:false,timer:null,controller:new AbortController(),panels:[]};
  for(const root of panels){
    for(const item of root.querySelectorAll('.products > li'))item.hidden=false;
    root.dataset.verdict='idle';
    setText(root,'.input-state','Not yet');setText(root,'.result-state','Not requested');
    setText(root,'.offer-state','Not requested');setText(root,'.feedback','All 6 products');
    setText(root,'.offer-at-input','');
    setText(root,'.product-count','6');setText(root,'.product-caption','products in the catalog');
    attempt.panels.push({root,variant:root.dataset.variant,offer:'idle',promise:Promise.resolve(),firstMatch:null,errorAt:null,harnessError:false,handled:false,disconnect:null});
  }
  $('accept').disabled=false;$('reject').disabled=false;$('filter').disabled=true;$('replay').disabled=true;
  $('filter').removeAttribute('aria-disabled');
  $('choice').textContent='Choose for both versions. No preference is saved.';
  $('checkpoint').textContent='Choose consent, then filter Shoes.';
  $('checkpoint').dataset.state='idle';
  $('checkpoint-note').textContent='The expected result is Canvas trainer, then Walking shoe, with no extra products.';
  $('takeaway').textContent='Start with a service that never answers. The same optional offer sits behind both versions.';
  $('scenario-description').textContent=modeText[mode];
  for(const input of document.querySelectorAll('[data-mode]'))input.checked=input.dataset.mode===mode;
}
function current(run){return attempt===run&&run.active;}
function failPanel(run,p){
  if(!current(run)||p.harnessError)return;
  p.harnessError=true;p.disconnect?.();p.disconnect=null;
  if(!run.checked)p.root.dataset.verdict='harness';
  // Fault reporting must survive a missing presentation node too.
  for(const [selector,text] of [['.result-state','Teaching-view error'],['.feedback','Teaching-view error. Start again; do not treat this as a service failure.']]){
    const node=p.root.querySelector(selector);if(node)node.textContent=text;
  }
}
function readResult(run,p){
  if(!current(run)||run.inputAt===null||p.harnessError)return [];
  try {
  const actual=readProducts(p.root.querySelector('.products'));
  const correct=matches(actual,expected);
  if(correct&&p.firstMatch===null)p.firstMatch=performance.now();
  setText(p.root,'.product-count',String(actual.length));
  setText(p.root,'.product-caption',correct?'correct shoes verified':'products currently visible');
  setText(p.root,'.result-state',correct?'Exact pair verified':p.errorAt!==null||run.checked?'No correct result':'No correct result yet');
  if(!run.checked)p.root.dataset.verdict=correct?'complete':p.errorAt!==null?'error':p.handled?'pending':'idle';
  return actual;
  } catch {
    failPanel(run,p);
    return [];
  }
}
function choose(choice){
  const run=attempt;if(run.choice!==null)return;
  run.choice=choice;$('accept').disabled=true;$('reject').disabled=true;$('filter').disabled=false;$('replay').disabled=false;
  $('choice').textContent=choice==='accept'?'Accepted. Both versions share one optional offer fetch.':'Rejected. No optional offer fetch is started.';
  let shared=Promise.resolve();
  if(choice==='accept'){
    shared=fetch(`${config.optionalOrigin}/offers?mode=${mode}&run=guided-${run.id}`,{credentials:'omit',signal:run.controller.signal})
      .then(response=>{if(!response.ok)throw new Error(`HTTP ${response.status}`);return response.json();})
      .then(offer=>{
        if(!current(run)||run.controller.signal.aborted)return;
        for(const p of run.panels){p.offer='ready';setText(p.root,'.offer-state',offer.message);}
      });
    shared.catch(error=>{
      if(!current(run)||run.controller.signal.aborted||error.name==='AbortError')return;
      for(const p of run.panels){p.offer='failed';setText(p.root,'.offer-state','Unavailable · request failed');}
    });
  }
  for(const p of run.panels){
    if(choice==='reject'){setText(p.root,'.offer-state','Not requested · rejected');continue;}
    p.offer='pending';setText(p.root,'.offer-state','Waiting for response');
    p.promise=shared;
  }
  announce(choice==='accept'?'Accepted. Now filter Shoes to compare the results.':'Rejected. Now filter Shoes; no optional service is requested.');
  $('filter').focus();
}
async function filterPanel(run,p){
  p.handled=true;setText(p.root,'.input-state','Handled');setText(p.root,'.feedback','Filtering Shoes…');
  p.root.dataset.verdict='pending';
  setText(p.root,'.offer-at-input',`At the filter click: ${{idle:'not requested',pending:'still waiting',failed:'already failed',ready:'already available'}[p.offer]}.`);
  p.disconnect=observeProducts(p.root.querySelector('.products'),()=>readResult(run,p));
  readResult(run,p);
  if(p.harnessError)return;
  try {
    if(p.variant==='baseline')await p.promise;
  } catch(error) {
    if(!current(run)||run.controller.signal.aborted||p.harnessError||error.name==='AbortError')return;
    p.errorAt=performance.now();setText(p.root,'.feedback','Filter error: optional offer unavailable.');
    readResult(run,p);
    return;
  }
  if(!current(run)||run.controller.signal.aborted||p.harnessError)return;
  // DOM/observer faults belong to the outer harness guard, never to service failure.
  for(const item of p.root.querySelectorAll('.products > li'))item.hidden=item.dataset.category!=='shoes';
  setText(p.root,'.feedback','2 shoes');
}
function checkpoint(run){
  if(!current(run))return;
  // A throttled/background tab can deliver the timer late: never call that an on-time sample.
  const observedAt=performance.now();
  if(observedAt-run.inputAt<WINDOW_MS){run.timer=setTimeout(()=>checkpoint(run),WINDOW_MS-(observedAt-run.inputAt));return;}
  run.checked=true;
  const outcomes=run.panels.map(p=>{
    const actual=readResult(run,p);
    p.verdict=p.harnessError?'harness':classify({firstMatch:p.firstMatch,inputAt:run.inputAt,actual,expected,errorAt:p.errorAt});
    p.root.dataset.verdict=p.verdict;
    return p.verdict;
  });
  const label={complete:'completed',error:'explicit error',incomplete:'no completion within the window',harness:'teaching-view error; result not usable'};
  $('checkpoint').textContent=`Waits for offer: ${label[outcomes[0]]}. Independent filter: ${label[outcomes[1]]}.`;
  $('checkpoint').dataset.state='done';
  const late=observedAt-run.inputAt>WINDOW_MS+250;
  $('checkpoint-note').textContent=late?'This tab delivered the checkpoint late. First-match eligibility still uses the 1,500 ms window; the final DOM check happened later. Replay in an active tab.':'Completion requires an exact pair observed within 1,500 ms and still present at this checkpoint. This is a teaching observation, not a benchmark.';
  $('takeaway').textContent=outcomes.includes('harness')?'The teaching view encountered an error. Start again; this attempt does not establish a comparison.':outcomes.every(x=>x==='complete')?(run.choice==='reject'?'Both filters finished without an optional request. Refusal removed this dependency.':run.offerAtInput==='pending'?'Both tasks completed. Version A waited for the offer, which arrived inside the observation window. Try “Never answers” to keep that dependency pending.':'Both tasks completed. The offer was already available when you filtered, so the wait was over. Try “Never answers” to expose the dependency.'):run.choice==='accept'&&outcomes[0]!=='complete'&&outcomes[1]==='complete'?'Both handlers ran. Only one product task completed. The optional offer remains separate from the independent filter.':'Read the actual states above. A missing or incorrect product pair is not a completed task.';
  announce($('checkpoint').textContent);
}
function filter(event){
  const run=attempt;if(!run.choice||run.inputAt!==null)return;
  run.inputAt=event.timeStamp;$('filter').setAttribute('aria-disabled','true');
  run.offerAtInput=run.panels[0].offer;
  $('checkpoint').textContent='Observing the product result for 1,500 ms…';
  $('checkpoint-note').textContent='The two grids are checked separately against the same expected product pair.';
  for(const p of run.panels)void filterPanel(run,p).catch(()=>failPanel(run,p));
  run.timer=setTimeout(()=>checkpoint(run),WINDOW_MS);
  announce('Both filter handlers ran. The product checks are separate.');
}
for(const input of document.querySelectorAll('[data-mode]'))input.addEventListener('change',()=>{reset(input.dataset.mode);announce('Scenario changed. Choose consent again.');});
$('accept').addEventListener('click',()=>choose('accept'));$('reject').addEventListener('click',()=>choose('reject'));
$('filter').addEventListener('click',filter);$('replay').addEventListener('click',()=>{reset();announce('Comparison reset. Choose consent again.');$('accept').focus();});
window.addEventListener('pagehide',dispose);
window.addEventListener('pageshow',event=>{if(event.persisted&&initialized){reset();announce('Page restored. Choose consent again.');}});
try {
  const responses=await Promise.all([fetch('/guided/config.json'),fetch('/tests/oracle.json')]);
  if(responses.some(r=>!r.ok))throw new Error('Guided server unavailable');
  [config,{shoes:expected}]=await Promise.all(responses.map(r=>r.json()));
  const endpoint=new URL(config.optionalOrigin);
  if(endpoint.protocol!==location.protocol||endpoint.hostname!==location.hostname||endpoint.port!==String(Number(location.port)+1)||!Array.isArray(expected)||expected.length!==2)throw new Error('Invalid guide configuration');
  reset();for(const b of document.querySelectorAll('[data-mode]'))b.disabled=false;
  initialized=true;
  $('setup').hidden=true;
} catch {
  $('setup').hidden=false;$('setup').textContent='Open this guide through its server using 127.0.0.1, not localhost or a file URL. From the laboratory folder, run node scripts/guided-server.mjs, then open http://127.0.0.1:4190/ (or your configured port). The catalog and explanation remain readable below.';
  const link=document.createElement('a');link.href='http://127.0.0.1:4190/';link.textContent=' Open the running local guide.';$('setup').append(link);
}
