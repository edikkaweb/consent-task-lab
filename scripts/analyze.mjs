import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {derive, distribution} from './metrics.mjs';
const directory = path.resolve(process.argv[2] || 'results/main');
const raw = await readFile(path.join(directory, 'runs.jsonl'), 'utf8');
const rows = raw.trim().split('\n').map(JSON.parse);
const metricNames = ['filter_to_correct_dom_ms','filter_to_correct_opportunity_ms','filter_event_duration_ms','consent_to_banner_dom_ms','consent_to_banner_opportunity_ms','consent_to_correct_dom_ms','saved_ready_to_correct_dom_ms','open_input_to_opportunity_ms','filter_input_delay_proxy_ms','long_task_total_ms','actual_consent_to_open_gap_ms','actual_open_to_filter_gap_ms'];
const groups = new Map();
for (const row of rows) {
  row.metrics = derive(row);
  const key = [row.variant, row.consent, row.mode].join('/');
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(row);
}
const summary = [...groups.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([key, group]) => {
  const summarize = (sample) => Object.fromEntries(metricNames.map((m) => [m, distribution(sample.map((r) => r.metrics[m]))]));
  return {key, variant:group[0].variant, consent:group[0].consent, mode:group[0].mode, n:group.length,
    success:group.filter((r)=>r.outcome==='success').length,
    explicitError:group.filter((r)=>r.outcome==='explicit-error').length,
    deadline:group.filter((r)=>r.outcome==='deadline').length,
    harnessError:group.filter((r)=>r.outcome==='harness-error').length,
    assertionFailures:group.filter((r)=>Object.values(r.assertions).some((v)=>!v)).length,
    eventTimingMissing:group.filter((r)=>r.metrics.filter_event_duration_ms==null).length,
    optionalRequests:group.map((r)=>r.requests.filter((q)=>new URL(q.url).port==='4177').length),
    metrics:summarize(group), untraced:summarize(group.filter((r)=>!r.traced)),
    runIds:group.map((r)=>r.id)};
});
const result={rawSha256:createHash('sha256').update(raw).digest('hex'),runs:rows.length,summary};
await writeFile(path.join(directory,'summary.json'),JSON.stringify(result,null,2)+'\n');
const csv=(row)=>row.map((value)=>JSON.stringify(value??'')).join(',');
const fields=['id','block','variant','consent','mode','traced','outcome',...metricNames];
await writeFile(path.join(directory,'runs.csv'),[csv(fields),...rows.map((row)=>csv(fields.map((key)=>row[key]??row.metrics[key])))].join('\n')+'\n');
const headers=['variant','consent','service','n','success','explicit_error','deadline','harness_error','median_dom_ms','q1_dom_ms','q3_dom_ms','min_dom_ms','max_dom_ms','p95_dom_ms','median_opportunity_ms','median_event_ms','missing_event'];
await writeFile(path.join(directory,'summary.csv'),[csv(headers),...summary.map((r)=>{
  const d=r.metrics.filter_to_correct_dom_ms;
  return csv([r.variant,r.consent,r.mode,r.n,r.success,r.explicitError,r.deadline,r.harnessError,d.median,d.q1,d.q3,d.min,d.max,d.p95,r.metrics.filter_to_correct_opportunity_ms.median,r.metrics.filter_event_duration_ms.median,r.eventTimingMissing]);
})].join('\n')+'\n');
const fmt=(x)=>x==null?'—':x.toFixed(1);
const html='<table><caption>All conditions. Completion times describe successful tasks only; failures are counted separately. Milliseconds.</caption><thead><tr><th>Variant</th><th>Consent</th><th>Service</th><th>Completed</th><th>DOM median [Q1–Q3]</th><th>Second rAF median (diagnostic)</th><th>Event Timing median</th><th>Error / deadline</th></tr></thead><tbody>'+summary.map((r)=>`<tr><td>${r.variant}</td><td>${r.consent}</td><td>${r.mode}</td><td>${r.success}/${r.n}</td><td>${fmt(r.metrics.filter_to_correct_dom_ms.median)} [${fmt(r.metrics.filter_to_correct_dom_ms.q1)}–${fmt(r.metrics.filter_to_correct_dom_ms.q3)}]</td><td>${fmt(r.metrics.filter_to_correct_opportunity_ms.median)}</td><td>${fmt(r.metrics.filter_event_duration_ms.median)}</td><td>${r.explicitError} / ${r.deadline}</td></tr>`).join('')+'</tbody></table>';
await mkdir(path.join(directory,'derived'),{recursive:true});
await writeFile(path.join(directory,'derived/table.html'),html+'\n');
console.log(JSON.stringify({runs:rows.length,conditions:summary.length,success:summary.reduce((s,r)=>s+r.success,0),explicitError:summary.reduce((s,r)=>s+r.explicitError,0),deadline:summary.reduce((s,r)=>s+r.deadline,0),harnessError:summary.reduce((s,r)=>s+r.harnessError,0)}));
