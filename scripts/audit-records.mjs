// Post-campaign checks. These do not change the frozen measuring instrument.
import assert from 'node:assert/strict';
import {derive, distribution} from './metrics.mjs';

export function observedOutcome(row, expected, horizon) {
  // The frozen runner can retain a task outcome if a later screenshot throws.
  // Never let that diagnostic disappear behind a successful task label.
  if (row.error || !row.snapshot) return 'harness-error';
  const {verifier, products, app} = row.snapshot;
  const input = verifier.inputs.find(e => e.target === 'shoes')?.timeStamp;
  const elapsed = verifier.firstCorrectDOM - input;
  const correct = JSON.stringify(products) === JSON.stringify(expected);
  if (correct && Number.isFinite(input) && Number.isFinite(verifier.firstCorrectDOM) && elapsed >= 0 && elapsed <= horizon) return 'success';
  return Number.isFinite(app.marks['filter-error']) ? 'explicit-error' : 'deadline';
}

export function assertCompletionChronology(metrics, horizon) {
  const dom = metrics.filter_to_correct_dom_ms;
  const callback = metrics.filter_to_correct_opportunity_ms;
  assert.ok(Number.isFinite(dom) && dom >= 0 && dom <= horizon, 'Verified DOM must be inside the observation window');
  // The optional diagnostic is not part of the completion definition.
  assert.ok(callback === null || (Number.isFinite(callback) && callback >= dom), 'A recorded second callback must follow verified DOM');
}

export function auditRecords(rows, summary, plan, expected, horizon) {
  assert.equal(rows.length, plan.length, 'Complete planned population required');
  assert.equal(summary.runs, rows.length);
  const expectedBehaviorDifferences = [];
  for (const [i, row] of rows.entries()) {
    for (const [field, value] of Object.entries(plan[i])) assert.deepEqual(row[field], value, `${row.id}: schedule ${field}`);
    assert.equal(row.traced, row.block === 1, `${row.id}: trace assignment`);
    const observed = observedOutcome(row, expected, horizon);
    assert.notEqual(observed, 'harness-error', `${row.id}: retained harness diagnostic: ${row.error || 'missing snapshot'}`);
    assert.equal(row.outcome, observed, `${row.id}: outcome must follow observations`);
    const {verifier, app, observedAt} = row.snapshot;
    const inputs = verifier.inputs.filter(e => e.target === 'shoes');
    assert.equal(inputs.length, 1, `${row.id}: one task input`);
    assert.ok(verifier.inputs.every(e => e.trusted && Number.isFinite(e.timeStamp)), `${row.id}: trusted finite input timestamps`);
    assert.ok(observedAt - inputs[0].timeStamp >= horizon, `${row.id}: observation horizon`);
    assert.deepEqual(row.pageErrors, [], `${row.id}: unhandled page errors`);
    if (verifier.firstCorrectDOM !== null) {
      assert.ok(verifier.firstCorrectDOM >= inputs[0].timeStamp && verifier.firstCorrectDOM <= observedAt, `${row.id}: completion chronology`);
      assert.equal(verifier.matches[0]?.at, verifier.firstCorrectDOM);
      assert.deepEqual(verifier.matches[0]?.products, expected, `${row.id}: observed match products`);
    }
    const anticipated = row.variant === 'independent' || !row.consent.endsWith('accept') || row.mode === 'normal'
      ? 'success' : row.mode === 'fail' ? 'explicit-error' : 'deadline';
    // An unexpected task outcome is evidence, not an integrity failure.
    if (row.outcome !== anticipated) expectedBehaviorDifferences.push({id: row.id, anticipated, observed: row.outcome});
    assert.ok(Array.isArray(app.events));
  }
  const keys = [...new Set(rows.map(r => [r.variant, r.consent, r.mode].join('/')))].sort();
  assert.deepEqual(summary.summary.map(g => g.key).sort(), keys, 'Exactly the observed condition groups');
  for (const group of summary.summary) {
    const sample = rows.filter(r => [r.variant, r.consent, r.mode].join('/') === group.key);
    const metrics = sample.map(derive);
    assert.equal(group.n, sample.length);
    assert.deepEqual([group.variant, group.consent, group.mode].join('/'), group.key);
    for (const [field, outcome] of Object.entries({success:'success', explicitError:'explicit-error', deadline:'deadline', harnessError:'harness-error'})) {
      assert.equal(group[field], sample.filter(r => r.outcome === outcome).length, `${group.key}: ${field}`);
    }
    assert.equal(group.assertionFailures, sample.filter(r => Object.values(r.assertions).some(v => !v)).length);
    assert.equal(group.eventTimingMissing, metrics.filter(m => m.filter_event_duration_ms == null).length);
    assert.deepEqual(group.runIds, sample.map(r => r.id));
    assert.deepEqual(group.optionalRequests, sample.map(r => r.requests.filter(q => new URL(q.url).port === '4177').length));
    for (const [metric, value] of Object.entries(group.metrics)) {
      assert.deepEqual(value, distribution(metrics.map(m => m[metric])), `${group.key}: ${metric} distribution`);
      assert.deepEqual(group.untraced[metric], distribution(sample.filter(r => !r.traced).map(r => derive(r)[metric])), `${group.key}: untraced ${metric}`);
    }
  }
  const eventDurations = {};
  for (const row of rows) {
    const key = String(derive(row).filter_event_duration_ms ?? 'missing');
    eventDurations[key] = (eventDurations[key] || 0) + 1;
  }
  return {expectedBehaviorDifferences, eventDurations};
}
