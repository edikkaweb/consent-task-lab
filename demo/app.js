const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const variant = params.get('variant') === 'independent' ? 'independent' : 'baseline';
const mode = ['normal', 'fail', 'hang'].includes(params.get('mode')) ? params.get('mode') : 'normal';
const run = params.get('run') || 'manual';
const optionalOrigin = `${location.protocol}//${location.hostname}:${Number(location.port) + 1}`;
const state = window.lab = {variant, mode, marks: {}, events: [], longTasks: [], errors: [], optional: 'not-requested'};
const mark = (name) => { state.marks[name] = performance.now(); performance.mark(name); };
const opportunity = (name) => requestAnimationFrame(() => requestAnimationFrame(() => mark(name)));
state.supportedEntryTypes = PerformanceObserver.supportedEntryTypes;
if (state.supportedEntryTypes.includes('event')) {
  new PerformanceObserver((list) => state.events.push(...list.getEntries().map((e) => ({
    name: e.name, startTime: e.startTime, duration: e.duration,
    processingStart: e.processingStart, processingEnd: e.processingEnd,
    interactionId: e.interactionId, target: e.target?.id || null
  })))).observe({type: 'event', buffered: true, durationThreshold: 16});
}
if (state.supportedEntryTypes.includes('longtask')) {
  new PerformanceObserver((list) => state.longTasks.push(...list.getEntries().map((e) => e.toJSON())))
    .observe({type: 'longtask', buffered: true});
}
// This one promise and its visible optional feature are identical in both variants.
let optionalReady = Promise.resolve();
let requested = false;
function startOptional() {
  if (requested) return;
  requested = true;
  state.optional = 'pending';
  $('offers').textContent = 'Loading optional offer…';
  mark('optional-request');
  optionalReady = fetch(`${optionalOrigin}/offers?mode=${mode}&run=${encodeURIComponent(run)}`, {credentials: 'omit'})
    .then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
    .then((offer) => { state.optional = 'ready'; $('offers').textContent = offer.message; mark('optional-ready'); });
  // Attach a rejection handler immediately; keep the original rejecting promise for the baseline.
  optionalReady.catch((error) => { state.optional = 'failed'; state.errors.push(String(error)); $('offers').textContent = 'Optional offer unavailable'; mark('optional-failed'); });
}
function applyChoice(choice, saved = false) {
  state.choice = choice;
  if (!saved) { localStorage.setItem('consent-task-choice', choice); mark('consent-handler'); }
  $('consent').hidden = true;
  mark('banner-hidden-dom'); opportunity('banner-render-opportunity');
  $('choice-state').textContent = `${saved ? 'Saved preference' : 'Preference'}: ${choice === 'accept' ? 'accepted' : 'rejected'}`;
  $('open-filter').hidden = false;
  if (choice === 'accept') startOptional();
  if (!saved) $('open-filter').focus();
}
for (const id of ['accept', 'reject']) $(id).addEventListener('click', (event) => {
  state.marks['consent-input'] = event.timeStamp;
  applyChoice(id);
});
$('open-filter').addEventListener('click', (event) => {
  state.marks['open-input'] = event.timeStamp;
  const opening = $('filters').hidden;
  $('filters').hidden = !opening;
  $('open-filter').setAttribute('aria-expanded', String(opening));
  mark('open-handler'); opportunity('open-render-opportunity');
});
let selection = 0;
for (const category of ['shoes', 'bags', 'all']) $(category).addEventListener('click', async (event) => {
  const request = ++selection;
  state.marks['filter-input'] = event.timeStamp;
  mark('filter-handler');
  $('task-status').textContent = `Filtering ${category}…`;
  opportunity('filter-feedback-opportunity');
  try {
    // The only experimental treatment: remove an unrelated dependency from the task.
    if (variant === 'baseline') await optionalReady;
    if (request !== selection) return;
    let count = 0;
    for (const item of $('products').children) {
      item.hidden = category !== 'all' && item.dataset.category !== category;
      if (!item.hidden) count++;
    }
    for (const id of ['shoes', 'bags', 'all']) $(id).setAttribute('aria-pressed', String(id === category));
    $('task-status').textContent = `${count} ${category === 'all' ? 'products' : category}`;
    mark('filter-dom'); opportunity('filter-render-opportunity');
  } catch {
    if (request !== selection) return;
    $('task-status').textContent = 'Filter failed while waiting for the optional service.';
    mark('filter-error');
  }
});
document.querySelector('[name=variant]').value = variant;
document.querySelector('[name=mode]').value = mode;
$('reset').addEventListener('click', () => { localStorage.removeItem('consent-task-choice'); location.reload(); });
$('inspect').addEventListener('click', () => { $('readings').textContent = JSON.stringify(state, null, 2); });
const saved = localStorage.getItem('consent-task-choice');
if (saved === 'accept' || saved === 'reject') applyChoice(saved, true);
else { $('consent').hidden = false; $('choice-state').textContent = 'No saved preference'; }
mark('app-ready');
