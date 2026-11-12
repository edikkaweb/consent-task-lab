"""Second arithmetic implementation, Python stdlib only; not an independent human review."""
import csv
import hashlib
import json
import math
import statistics
import sys
from pathlib import Path

root = Path(sys.argv[1] if len(sys.argv) > 1 else 'results/main')
raw = (root / 'runs.jsonl').read_bytes()
rows = [json.loads(line) for line in raw.splitlines()]
summary = json.loads((root / 'summary.json').read_text())
assert hashlib.sha256(raw).hexdigest() == summary['rawSha256']
with (root / 'runs.csv').open() as source:
    csv_rows = list(csv.DictReader(source))
assert len(rows) == len(csv_rows)
assert [r['id'] for r in rows] == [r['id'] for r in csv_rows]
event_counts = {}
for row in rows:
    assert not row.get('error'), 'Retained harness error needs investigation'
    durations = [e['duration'] for e in row['snapshot']['app']['events'] if e['target'] == 'shoes' and e['interactionId'] > 0]
    event_duration = max(durations) if durations else None
    assert event_duration == row['metrics']['filter_event_duration_ms']
    event_counts[str(event_duration)] = event_counts.get(str(event_duration), 0) + 1
for group in summary['summary']:
    sample = [r for r in rows if '/'.join((r['variant'], r['consent'], r['mode'])) == group['key']]
    assert len(sample) == group['n']
    for field, outcome in [('success','success'), ('explicitError','explicit-error'), ('deadline','deadline'), ('harnessError','harness-error')]:
        assert sum(r['outcome'] == outcome for r in sample) == group[field]
    values = []
    for row in sample:
        if row['outcome'] != 'success':
            assert row['metrics']['filter_to_correct_dom_ms'] is None
            continue
        event = next(e for e in row['snapshot']['verifier']['inputs'] if e['target'] == 'shoes')
        elapsed = row['snapshot']['verifier']['firstCorrectDOM'] - event['timeStamp']
        assert math.isclose(elapsed, row['metrics']['filter_to_correct_dom_ms'], abs_tol=1e-8)
        values.append(elapsed)
    d = group['metrics']['filter_to_correct_dom_ms']
    if values:
        assert d['n'] == len(values) and d['min'] == min(values) and d['max'] == max(values)
        assert statistics.median(values) == d['median']
        q = statistics.quantiles(values, n=4, method='inclusive') if len(values) > 1 else [values[0]] * 3
        assert math.isclose(q[0], d['q1'], abs_tol=1e-8)
        assert math.isclose(q[2], d['q3'], abs_tol=1e-8)
        assert sorted(values)[math.ceil(.95 * len(values)) - 1] == d['p95']
    else:
        assert d['n'] == 0 and d['median'] is None
print(json.dumps({'pass': True, 'runs': len(rows), 'conditions': len(summary['summary']), 'eventDurations': event_counts, 'implementation': 'Python stdlib; raw completion timestamps, completion distributions, all outcome counts, Event Timing maxima and CSV identities'}))
