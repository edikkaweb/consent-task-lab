import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {schedule, protocol} from './protocol.mjs';
import {derive} from './metrics.mjs';
import {sourceHashes} from './sources.mjs';
import {auditRecords, assertCompletionChronology} from './audit-records.mjs';
const args=process.argv.slice(2);
assert.ok(args.length<=2 && (!args[0] || !args[0].startsWith('--')) && (!args[1] || /^--receipt=.+/.test(args[1])), 'Usage: node scripts/verify.mjs [results/directory] [--receipt=new/path.json]');
const directory=path.resolve(args[0]||'results/main');
const receiptPath=args[1] ? path.resolve(args[1].slice('--receipt='.length)) : null;
const raw=await readFile(path.join(directory,'runs.jsonl'),'utf8');
const rows=raw.trim().split('\n').map(JSON.parse);
const manifest=JSON.parse(await readFile(path.join(directory,'manifest.json')));
const plan=JSON.parse(await readFile(path.join(directory,'schedule.json')));
const summary=JSON.parse(await readFile(path.join(directory,'summary.json')));
const complete=JSON.parse(await readFile(path.join(directory,'complete.json')));
const oracle=JSON.parse(await readFile(new URL('../tests/oracle.json',import.meta.url)));
const recordAudit=auditRecords(rows,summary,plan,oracle.shoes,protocol.observationAfterFilterMs);
assert.deepEqual(plan,schedule(manifest.repetitions));
assert.deepEqual(manifest.protocol,protocol,'Recorded protocol must match the frozen instrument');
assert.equal(manifest.seed,protocol.seed);
assert.equal(manifest.scheduleSha256,createHash('sha256').update(JSON.stringify(plan)).digest('hex'));
assert.equal(rows.length,plan.length);assert.equal(complete.runs,rows.length);
assert.equal(summary.rawSha256,createHash('sha256').update(raw).digest('hex'));
assert.deepEqual(manifest.sources,await sourceHashes());
for(let i=0;i<rows.length;i++){
  const r=rows[i];assert.equal(r.id,plan[i].id);assert.equal(r.index,i+1);
  assert.deepEqual(r.metrics,derive(r));
  assert.ok(Object.values(r.assertions).every(Boolean),`${r.id}: assertion failure`);
  const accepts=r.consent.endsWith('accept');
  if(r.outcome==='success'){
    assert.deepEqual(r.snapshot.products,oracle.shoes);
    assertCompletionChronology(r.metrics,protocol.observationAfterFilterMs);
  }else{assert.equal(r.metrics.filter_to_correct_dom_ms,null);assert.equal(r.metrics.filter_to_correct_opportunity_ms,null);}
  // Recompute refusal policy from independent browser requests AND server receipts.
  const optional=r.requests.filter(q=>new URL(q.url).port==='4177');
  assert.equal(optional.length,accepts?1:0);
  if(!accepts)assert.equal(r.serverRequests.length,0);
  if(accepts&&r.mode==='normal')assert.equal(r.snapshot.optionalText,'Offer available: free delivery on this collection.');
  if(accepts&&r.mode==='fail'){
    assert.ok(r.requestFailures.some(q=>new URL(q.url).port==='4177'));
    assert.ok(r.serverRequests.every(q=>q.response==='connection-destroyed'));
  }
  if(accepts&&r.mode==='hang')assert.ok(r.serverRequests.every(q=>q.response==='pending'));
  assert.ok(r.metrics.filter_event_interaction_ids.length<=1,'Single measured filter interaction expected');
  if(r.traced){
    const trace=JSON.parse(gunzipSync(await readFile(path.join(directory,r.tracePath))));
    assert.ok(trace.traceEvents.some(e=>e.name==='filter-handler'));
    assert.ok(trace.traceEvents.some(e=>e.name==='Screenshot'));
  }
}
const receipt={verifiedAt:new Date().toISOString(),runs:rows.length,conditions:summary.summary.length,traceCount:rows.filter(r=>r.traced).length,rawSha256:summary.rawSha256,...recordAudit,checks:['complete schedule/order and condition fields','source lock','raw-to-metric and full summary recalculation','outcome reclassified from recorded observations','retained harness diagnostics rejected','independent expected products','consent and optional requests','failure retention','trace user marks and screenshots'],pass:true};
// Checking an archive must preserve its dated receipt and checksum manifest.
// Explicit output is create-only, including for a newly reproduced campaign.
if(receiptPath) await writeFile(receiptPath,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(receipt,null,2));
