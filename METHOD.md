# Experimental method

Protocol version 1.0.0. The authority for exact settings and source hashes is `protocol-lock.json`; the actual run environment is in each `manifest.json`.

## Question and construct

Can a product-filter interaction receive a fast browser response while the correct products arrive later, or never arrive during observation, after a consent choice?

Six products are embedded in HTML. Shoes must produce exactly `shoe-01 / Canvas trainer` followed by `shoe-02 / Walking shoe`, with no other visible list item. This expected result lives in `tests/oracle.json`, separately from the application. The verifier checks product identity, name, order and visible layout boxes. It does not trust the application's status message, product category labels or success marker. It is a DOM check; it does not prove screen-reader output, physical pixels or absence of all possible occlusion.

The baseline deliberately awaits an unrelated offer request before updating the product list. The independent variant removes that wait. Both use the same promise, request, offer payload, consent logic, products, styling and controls. Both still show the offer when available. This is a constructed dependency fault; a large difference is not evidence of its prevalence on real sites.

## Matrix and execution

Two implementations × four consent states × three service modes = 24 conditions. States are fresh accept, fresh reject, seeded saved accept and seeded saved reject. Separate functional tests actually choose a preference and reload to verify persistence. Seeded saved preferences in the main experiment isolate the returning state; the cache is still cold. They are not a full repeat-visit simulation.

Service modes are a normal JSON response with a 600 ms server delay, an immediately destroyed connection, and a connection held pending until teardown. A connection failure and an indefinitely pending response are different interventions. The offer service is a second loopback origin, not a geographically remote third party. It receives no credentials. Rejection suppresses the request, so the three configured service modes are intentionally inactive negative controls in rejected conditions.

The pilot used two complete blocks (48 trials). Twenty complete blocks (480 trials) follow the freeze. Each block contains each condition exactly once. Fisher–Yates shuffling uses a fixed 32-bit LCG, seed 666202611; the full order is retained. No samples are trimmed and no failed task is rerun to replace it. This is an engineering replication count, not a power calculation or representative population sample.

One Chromium process runs trials sequentially. Each trial gets a fresh context, no service workers, cache disabled through CDP and `no-store` responses. The viewport is 1280 × 1000, device scale factor 1, locale en-GB, timezone UTC and motion preference no-preference. CPU slowdown is 4; the loopback network is otherwise unthrottled. It is not calibrated mobile hardware. Machine load, temperature and power state were not controlled. Local authoring and documentation work continued during the run; there was no concurrent browser campaign or global build.

The runner loads the page, clicks Accept or Reject when needed, waits 100 ms after that click (after page readiness for a saved choice), opens the filter, waits 50 ms, then clicks Shoes. Browser/automation overhead adds to those nominal waits. The actual gaps are recorded, not assumed. Every trial remains under observation for at least 1,500 ms after the Shoes click. Polling and collection can extend the final observation slightly; success must have been observed within the declared 1,500 ms. The pending request is closed at teardown. No claim about how much longer it would have remained pending is made.

## Separate endpoints

All browser timestamps use the document's performance time origin. Absolute wall times identify sessions, not interaction durations.

| Field | Start | End | Meaning |
|---|---|---|---|
| `consent_to_banner_dom_ms` | Consent click `event.timeStamp` | Setting `hidden` on the panel | Application DOM transition |
| `consent_to_banner_opportunity_ms` | Same click timestamp | Second nested animation-frame callback | Opportunity proxy, not a measured paint |
| `open_input_to_opportunity_ms` | Open-filter click timestamp | Second callback after opening | Opening feedback proxy |
| `filter_event_duration_ms` | Browser Event Timing start | Event Timing duration endpoint | Maximum recorded duration for events targeting Shoes with a nonzero interaction ID |
| `filter_to_correct_dom_ms` | Shoes click timestamp | Independent mutation observer sees exact products | Task completion in DOM, successful tasks only |
| `filter_to_correct_opportunity_ms` | Same click timestamp | Second callback, with correctness checked again | Rendering-opportunity proxy, successful tasks only |
| `consent_to_correct_dom_ms` | Fresh consent click timestamp | Independent correct DOM | Journey duration including intervening inputs and automation gaps |
| `saved_ready_to_correct_dom_ms` | Application-ready marker | Independent correct DOM | Separate returning-state endpoint; no invented consent click |
| `filter_input_delay_proxy_ms` | Shoes click timestamp | Start of application handler | Handler-entry proxy, not full interaction latency |
| `long_task_total_ms` | Navigation | End of observation | Sum of observed long-task durations, not third-party attribution |
| `commands[].elapsedMs` | Runner starts a click command | Command resolves | Automation duration; never substituted for browser latency |

Event Timing uses a requested 16 ms threshold, the API minimum, and durations rounded to 8 ms. An absent entry is `null`, never zero and never proof of a particular duration. The maximum is taken over recorded events for the one Shoes interaction; the raw interaction IDs are retained. This is not a page-lifetime INP calculation. Click timestamps and Event Timing event start times need not be identical; their endpoints are intentionally kept separate.

The independent observer calls computed-style/layout APIs and thus adds work. Both implementations receive the same instrumentation. Timing distributions are conditional on this setup. Long Tasks support and Event Timing support are detected. A separate positive control blocks a click handler for 180 ms and must generate both signals; a negative control renames a product and must fail the oracle.

The first block has CDP timeline capture with screenshots; the remaining 19 blocks do not. Traced runs remain in the primary result and are identified in JSONL. `summary.json` also provides untraced distributions. Tracing is confounded with block order and elapsed session time: this is a descriptive subset comparison, not an estimate of trace overhead. Screenshots at the end verify state, not exact presentation time. Nested requestAnimationFrame callbacks are not treated as screenshot or compositor evidence.

## Outcomes and calculations

`success`: exact products observed within 1,500 ms, with the exact final DOM still present. `explicit-error`: application reports a filter error and correct products were not observed in time. `deadline`: no correct products in time and no explicit filter error. `harness-error`: automation/infrastructure error, retained with diagnostic text and kept distinct from task failure.

Completion durations are null on failure; a deadline is not a 1,500 ms completion. Report each failure type and denominator beside success-only timing distributions. Median and quartiles use linear interpolation at `(n−1) × p`. p95 is nearest rank `ceil(.95 × n)`, useful as a descriptive order statistic with only 20 observations, not a reliable population tail estimate. No confidence intervals or significance claims are made.

Node recomputes every metric from raw state. A separate Python stdlib implementation independently recomputes completion elapsed times, counts, medians, inclusive quartiles and nearest-rank p95. This is a software cross-check, not independent scientific review. Raw hashes bind summaries to JSONL; a package integrity manifest binds all deliverables.

## Applicability

Only the programmed journey and local failure mechanisms were measured. A slower human can let the offer finish before choosing Shoes and hide the baseline defect in the normal mode. A real third party can consume CPU, execute scripts or change layout; this optional JSON service does none of those. The correction only removes a dependency wait and cannot prevent unrelated main-thread contention. Real integration decisions require functional ownership, consent requirements and product expectations to be established first.

Keyboard, touch emulation, reduced motion and JavaScript-disabled checks are functional coverage. They are not an accessibility audit, screen-reader study or physical-device benchmark. The demo contains no reveal animation or Edikka shared frontend component. No production or user traffic was measured.

The macOS WebKit plain-Tab matrix produced 24 failures to reach native buttons. A bare control page reproduced the omission; Option-Tab reached the buttons there and passed the separate 24-condition journey matrix. The touch matrix and other WebKit checks passed. Both runs are retained. The exact OS/browser preference was not read or changed, so this is an observed environment-dependent result rather than an assertion about a particular setting or Safari users generally. Chromium's 57 checks and Firefox's 32 checks passed in their tested configurations.

## Editorial and analysis review, 10 November 2026

The frozen instrument and raw JSONL were not changed. The article now calls `filter_to_correct_dom_ms` **time to verified DOM**: it ends after the observer's style/layout reads have established a match. Those reads can force synchronous layout, and the document-wide mutation observer also runs after status/offer changes. It measures correctness under this instrumentation, not bare mutation cost. Moving its timestamp before verification would change the endpoint; subtracting the difference from the app's marker would not establish an uninstrumented latency. Its first-match timestamp and final-state check do not prove continuous correctness between samples or visual presentation.

All 24 Event Timing medians are 16 ms, but only 479 of the 480 observations equal 16. Trial `0450-independent-saved-accept-normal` (untraced block 19) records 112 ms. Its verified-DOM elapsed time is 4.299999952316284 ms and its second-rAF elapsed time is 29.899999976158142 ms. These are distinct endpoints; the raw data do not identify the cause of the 112 ms value. No trace exists for that trial. Thresholding and 8 ms quantization are documented API behavior; an exact 60 Hz presentation cadence is not established. A nested rAF adds a scheduling step and is not a display timestamp.

The full raw record check establishes that all 80 accepted-service connection failures (both variants) happened before the Shoes click. In the baseline, `await optionalReady` therefore encounters an already-rejected promise. The frozen UI's generic “while waiting” error must not be interpreted as a newly pending network wait during that click. A delayed rejection during an active filter wait is outside this protocol. The request starts a median 194.85 ms before Shoes in the fresh-accept normal baseline and 286.55 ms before Shoes in the saved-accept normal baseline; these are observed input/request gaps, not fixed user behavior.

Post-campaign changes affect `audit-records.mjs`, `verify.mjs`, the article generator, documentation, figure labels and evidence tests. Verification now reclassifies each recorded outcome from the observed state, checks condition fields against the schedule, and recalculates every full/untraced summary distribution. Unexpected task outcomes are listed separately; request policy, offer state and other contract assertions still stop verification when they fail. The frozen runner has a known limitation: a screenshot exception after task classification can leave its outcome label intact, and an exception during context setup/teardown can stop a partial campaign. The revised verification rejects any retained `error` even on a successful row, or a missing snapshot, and requires the complete schedule/completion receipt. It stops at that quarantine check: unreachable downstream harness-error aggregation was removed during final review. A null second-rAF diagnostic does not invalidate a completed DOM task; a recorded callback must be finite and follow verification. These post-analysis checks do not alter the frozen completion definition. All included main rows have no such diagnostic and the schedule is complete. Future partial runs must be retained and investigated, not merged or silently retried.

The oracle/control/browser claims were checked against their retained artifacts during review. The negative control and persistence checks have assertion receipts, not full raw browser traces; the positive control includes its event and long-task records. AI reviews by Claude and Gemini are advisory and do not substitute for author or independent human review. No new campaign was needed to narrow the interpretation of these unchanged observations. The private review correspondence is outside the repository package; operational follow-up remains in Edikka action #666.

## Guided teaching companion, 10 November 2026

`guided/` and `scripts/guided-server.mjs` are additional presentation code. They do not replace `demo/`, alter `protocol-lock.json` or participate in `measure.mjs`. The original instrument, raw records, traces and estimates remain unchanged. The article's new link identifies the distinction explicitly.

One user choice starts **one shared optional fetch** on acceptance, none on rejection. A Firefox diagnostic observed one fetch and one Playwright request event producing ten server receipts after a socket failure; a single-fetch control did the same. WebKit initially produced four receipts. Application calls and transport attempts are therefore counted separately in the functional tests. These observations do not alter the frozen campaign. One Filter button invokes the waiting variant first, then the independent variant, on the same main thread. This deliberately holds the offer promise constant to explain the dependency; it is not a measurement between isolated pages. The same six products are rendered twice, with panel-scoped selectors and the expected fixture from `tests/oracle.json`. Names, IDs and order are verified from visible DOM nodes. The observer's layout reads add work. No interaction duration, paint time or speed score is displayed.

The view shows service state at the Filter click and current service state separately. It uses the human's own input spacing; a 600 ms server response can arrive before filtering. Fresh choices are kept in memory; saved-choice cases remain in the original lab. The panel fact “Click handler: Handled” reports code execution and DOM feedback, not Event Timing or physical presentation. The 1,500 ms check requires a first exact match within the window and the exact pair still present at the check. If browser scheduling delays the check by over 250 ms, a visible note flags the late sample; this 250 ms display threshold has no scientific meaning. The later live DOM may differ from the fixed checkpoint. There is no assertion of continuous correctness, visibility against occlusion, or human perception.

Reset and scenario changes invalidate the attempt, abort its shared request, cancel its timer and disconnect its observers. All asynchronous completions guard attempt identity. Functional checks include ten pending resets followed by normal response, an old response after reset, a wrong name in one panel, and an initially correct but finally wrong result. The guide observer was simplified to avoid duplicate layout reads; no new dependency was added. DOM failures are classified separately from optional-request failures. A failing panel observer is disconnected; guarded reads prevent a persistent oracle fault from skipping the healthy panel at the checkpoint. Regression checks inject faults both before filtering and during observation. The lifecycle restore guard is tested with synthetic events, not as proof of actual cache eligibility. Receipts and earlier failed checks are retained in `results/guided-functional/`, outside the measured campaign. Additional review receipts and preserved failing checks from 11 November are in `results/guided-review-2026-11-11/`. No guided observation is merged into the 480 trials. Claude and Gemini supplied additional advisory design/code reviews; they are not independent human validation.

On 12 November, a package review reproduced an integrity problem in the verification command: a successful check replaced the archived receipt with a new timestamp. Verification now prints its fresh receipt without writing by default; an explicit `--receipt=PATH` creates a new file and refuses to overwrite any existing file. The archived receipts and main observations remain unchanged. Figure and table labels were clarified, including a filter-error marker at its recorded input-relative time; these are presentation changes only.
