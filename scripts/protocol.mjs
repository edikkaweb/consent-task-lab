export const protocol = {
  version: '1.0.0', seed: 666202611, repetitions: 20,
  variants: ['baseline', 'independent'],
  consentStates: ['accept', 'reject', 'saved-accept', 'saved-reject'],
  serviceModes: ['normal', 'fail', 'hang'],
  viewport: {width: 1280, height: 1000}, deviceScaleFactor: 1,
  cpuSlowdown: 4, network: 'Unthrottled loopback; optional normal response delayed 600 ms at server',
  cache: 'Fresh browser context per trial; CDP cache disabled; all responses no-store',
  consentSettleMs: 100, filterSettleMs: 50,
  observationAfterFilterMs: 1500, eventDurationThresholdMs: 16,
  trace: 'Chromium CDP timeline and screenshots, first block only; marked and summarized separately',
  success: 'Independent DOM observer finds exactly shoe-01/Canvas trainer and shoe-02/Walking shoe, visible and in order; final oracle must agree',
  failure: 'No correct result by 1500 ms after filter input: explicit-error or deadline; harness errors kept separately',
  analysis: 'All runs retained. Success-only median, Q1/Q3, min/max and nearest-rank p95; failures counted separately. No field INP or causal population estimate.'
};
export function schedule(repetitions, seed = protocol.seed) {
  let value = seed >>> 0;
  const random = () => {value = (Math.imul(1664525, value) + 1013904223) >>> 0; return value / 4294967296;};
  const result = [];
  for (let block = 1; block <= repetitions; block++) {
    const cells = protocol.variants.flatMap(variant => protocol.consentStates.flatMap(consent => protocol.serviceModes.map(mode => ({variant, consent, mode, block}))));
    for (let i = cells.length - 1; i > 0; i--) {const j = Math.floor(random() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]];}
    result.push(...cells);
  }
  return result.map((cell, index) => ({...cell, index: index + 1, id: `${String(index + 1).padStart(4, '0')}-${cell.variant}-${cell.consent}-${cell.mode}`}));
}
