import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auditRecords, observedOutcome, assertCompletionChronology} from '../scripts/audit-records.mjs';
const data=new URL('../results/main/',import.meta.url);
const rows=(await readFile(new URL('runs.jsonl',data),'utf8')).trim().split('\n').map(JSON.parse);
const summary=JSON.parse(await readFile(new URL('summary.json',data)));
const plan=JSON.parse(await readFile(new URL('schedule.json',data)));
const expected=JSON.parse(await readFile(new URL('oracle.json',import.meta.url))).shoes;
const check=(r=rows,s=summary)=>auditRecords(r,s,plan,expected,1500);
test('all original observations and distributions agree; the 112 ms event is retained',()=>{
  assert.deepEqual(check(),{expectedBehaviorDifferences:[],eventDurations:{16:479,112:1}});
});
test('a late harness diagnostic cannot hide behind a success outcome',()=>{
  const r=structuredClone(rows);r[0].error='Synthetic screenshot failure after classification';
  assert.equal(observedOutcome(r[0],expected,1500),'harness-error');
  assert.throws(()=>check(r),/retained harness diagnostic/);
});
test('a missing snapshot is quarantined even with a harness-error label',()=>{
  const r=structuredClone(rows);r[0].snapshot=null;r[0].outcome='harness-error';
  assert.throws(()=>check(r),/retained harness diagnostic: missing snapshot/);
});
test('a completed DOM result does not require the optional second-frame diagnostic',()=>{
  assert.doesNotThrow(()=>assertCompletionChronology({filter_to_correct_dom_ms:1499,filter_to_correct_opportunity_ms:null},1500));
  assert.doesNotThrow(()=>assertCompletionChronology({filter_to_correct_dom_ms:1499,filter_to_correct_opportunity_ms:1510},1500));
  for(const callback of [1498,NaN,Infinity,undefined]) {
    assert.throws(()=>assertCompletionChronology({filter_to_correct_dom_ms:1499,filter_to_correct_opportunity_ms:callback},1500),/second callback/);
  }
  assert.throws(()=>assertCompletionChronology({filter_to_correct_dom_ms:1501,filter_to_correct_opportunity_ms:null},1500),/observation window/);
});
test('a changed median is rejected even when the raw hash is unchanged',()=>{
  const s=structuredClone(summary);s.summary.find(g=>g.success).metrics.filter_to_correct_dom_ms.median+=1;
  assert.throws(()=>check(rows,s),/distribution/);
});
test('a schedule label change is rejected even if the run ID is retained',()=>{
  const r=structuredClone(rows);r[0].mode='fail';
  assert.throws(()=>check(r),/schedule mode/);
});
test('an outcome label must agree with the observed product state',()=>{
  const r=structuredClone(rows);r[0].outcome='deadline';
  assert.throws(()=>check(r),/outcome must follow observations/);
});
test('wrong products and negative completion times cannot be successful observations',()=>{
  const r=structuredClone(rows[0]);r.snapshot.products[0].name='Wrong shoe';
  assert.equal(observedOutcome(r,expected,1500),'deadline');
  r.snapshot.products=expected;r.snapshot.verifier.firstCorrectDOM=0;
  assert.equal(observedOutcome(r,expected,1500),'deadline');
});
