import test from 'node:test';
import assert from 'node:assert/strict';
import {schedule} from '../scripts/protocol.mjs';
import {distribution, derive} from '../scripts/metrics.mjs';
test('randomized complete blocks, deterministic seed, no duplicated cells', () => {
  const a = schedule(20);
  assert.equal(a.length, 480);
  assert.deepEqual(a, schedule(20));
  assert.notDeepEqual(a, schedule(20, 1));
  for (let b = 1; b <= 20; b++) {
    const cells = a.filter((r) => r.block === b);
    assert.equal(new Set(cells.map((r) => [r.variant, r.consent, r.mode].join('/'))).size, 24);
  }
});
test('quantiles are hand-checkable; empty data is null, never zero', () => {
  assert.deepEqual(distribution([1, 2, 3, 4]), {n:4,median:2.5,q1:1.75,q3:3.25,min:1,max:4,p95:4});
  assert.equal(distribution([]).median, null);
  assert.equal(distribution([0, 0, 0]).median, 0);
});
test('a failed task cannot acquire a completion time; absent Event Timing stays null', () => {
  const row = {consent:'accept', outcome:'explicit-error', snapshot:{app:{marks:{},events:[],longTasks:[]},verifier:{inputs:[{target:'shoes',timeStamp:100}],firstCorrectDOM:250,firstCorrectOpportunity:270}, observedAt:1600}};
  const m = derive(row);
  assert.equal(m.filter_to_correct_dom_ms, null);
  assert.equal(m.filter_event_duration_ms, null);
  assert.equal(m.consent_to_correct_dom_ms, null);
  assert.equal(m.observed_after_filter_ms,1500);
});
test('Event Timing maximum is separated from application completion', () => {
  const row = {consent:'saved-accept',outcome:'success',snapshot:{app:{marks:{'app-ready':10},events:[{target:'shoes',interactionId:5,duration:24},{target:'shoes',interactionId:5,duration:32}],longTasks:[{duration:60}]},verifier:{inputs:[{target:'shoes',timeStamp:100}],firstCorrectDOM:700,firstCorrectOpportunity:720},observedAt:1600}};
  const m = derive(row);
  assert.equal(m.filter_event_duration_ms,32);
  assert.equal(m.filter_to_correct_dom_ms,600);
  assert.equal(m.saved_ready_to_correct_dom_ms,690);
  assert.equal(m.consent_to_correct_dom_ms,null);
  assert.deepEqual(m.filter_event_interaction_ids,[5]);
});
