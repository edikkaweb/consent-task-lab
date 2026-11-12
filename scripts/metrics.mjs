export function quantile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const x = (sorted.length - 1) * p, i = Math.floor(x);
  return sorted[i] + (sorted[Math.ceil(x)] - sorted[i]) * (x - i);
}
export function distribution(values) {
  const x = values.filter(Number.isFinite).sort((a, b) => a - b);
  return {n: x.length, median: quantile(x, .5), q1: quantile(x, .25), q3: quantile(x, .75), min: x[0] ?? null, max: x.at(-1) ?? null, p95: x.length ? x[Math.ceil(x.length * .95) - 1] : null};
}
export function derive(row) {
  if (!row.snapshot) return {};
  const {app, verifier} = row.snapshot;
  const input = (id) => verifier.inputs.find((i) => i.target === id)?.timeStamp ?? null;
  const delta = (a, b) => Number.isFinite(a) && Number.isFinite(b) ? a - b : null;
  const filterInput = input('shoes');
  const consentInput = input('accept') ?? input('reject');
  const eventEntries = app.events.filter((e) => e.target === 'shoes' && e.interactionId > 0);
  const interactionIDs = [...new Set(eventEntries.map((e) => e.interactionId))];
  const filterEventDuration = eventEntries.length ? Math.max(...eventEntries.map((e) => e.duration)) : null;
  return {
    consent_to_banner_dom_ms: delta(app.marks['banner-hidden-dom'], consentInput),
    consent_to_banner_opportunity_ms: delta(app.marks['banner-render-opportunity'], consentInput),
    open_input_to_opportunity_ms: delta(app.marks['open-render-opportunity'], input('open-filter')),
    filter_input_delay_proxy_ms: delta(app.marks['filter-handler'], filterInput),
    filter_event_duration_ms: filterEventDuration, filter_event_interaction_ids: interactionIDs,
    filter_to_correct_dom_ms: row.outcome === 'success' ? delta(verifier.firstCorrectDOM, filterInput) : null,
    filter_to_correct_opportunity_ms: row.outcome === 'success' ? delta(verifier.firstCorrectOpportunity, filterInput) : null,
    consent_to_correct_dom_ms: row.outcome === 'success' ? delta(verifier.firstCorrectDOM, consentInput) : null,
    saved_ready_to_correct_dom_ms: row.consent.startsWith('saved-') && row.outcome === 'success' ? delta(verifier.firstCorrectDOM, app.marks['app-ready']) : null,
    actual_consent_to_open_gap_ms: delta(input('open-filter'), consentInput),
    actual_open_to_filter_gap_ms: delta(filterInput, input('open-filter')),
    observed_after_filter_ms: delta(row.snapshot.observedAt, filterInput),
    long_task_total_ms: app.longTasks.reduce((sum, item) => sum + item.duration, 0),
    long_task_count: app.longTasks.length
  };
}
