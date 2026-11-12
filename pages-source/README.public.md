# Consent task lab

**A handled click. A completed task?**

Choose consent, filter the shoes, and compare the products that actually appear. Both versions handle the click. When the optional offer never arrives, only the independent filter completes the task.

[Try the demo in English](https://edikkaweb.github.io/consent-task-lab/index-en.html) · [Essayer la démo en français](https://edikkaweb.github.io/consent-task-lab/) · [Experimental method](METHOD.md)

## Start with the comparison

1. Leave **Never answers** selected.
2. Choose **Accept optional service**.
3. Choose **Filter Shoes in both versions**. Compare the handled click with the actual product list.
4. Start again and reject the optional service. Then try failure and a delayed offer.

The public page is a browser simulation. One shared promise resolves after a 600 ms timer, rejects, or stays pending. It makes no offer request and stores no preference. Both panels run on the same main thread. Their observations are teaching checks, not speed scores, Event Timing durations or INP measurements. Waiting before you filter can let the delayed offer arrive first.

The expected result is exactly `shoe-01 / Canvas trainer`, then `shoe-02 / Walking shoe`, with no additional visible product. A match must be observed within 1,500 ms and still be present at the final check. The check reads styles and layout, adds work, and does not establish physical presentation, continuous correctness or absence of occlusion. A late checkpoint is identified on the page.

## Two distinct things

| | Public comparison | Original network experiment |
|---|---|---|
| Purpose | Make the dependency visible | Reproduce the measured journey |
| Service | Browser promise and timer | Second loopback HTTP origin |
| Consent | Fresh choice in memory | Fresh or saved acceptance/rejection |
| Interface | One button invokes two panels | Open the filter, then choose Shoes |
| Output | Product states and a fixed checkpoint | Raw records, timing endpoints, failures and traces |
| Evidence | Separate functional checks | 480 frozen main trials |

The simulated 600 ms timer is not a measured network latency. The public page does not reproduce the experiment's CPU slowdown, input spacing, saved preferences or network fault mechanisms. It never adds observations to the archived campaign.

## Inspect the evidence

The main campaign retained **480 trials: 400 successful tasks, 40 explicit errors and 40 tasks without completion within the observation window**. All 80 unfinished baseline tasks still recorded a 16 ms Event Timing duration. Across all trials, 479 Event Timing values were 16 ms and one was 112 ms. The outlier is retained; there is no trace for that trial and its cause is unknown.

These numbers describe a deliberately constructed dependency fault on one laboratory setup. They are not field INP, visitor behavior, a CMP ranking, a population estimate or evidence of how common the fault is.

- [All main trials](results/main/runs.jsonl), [CSV](results/main/runs.csv), [24-condition summary](results/main/summary.csv).
- [Environment and settings](results/main/manifest.json), [frozen source hashes](protocol-lock.json), [traces and screenshots](results/main/traces/).
- [Method, endpoints and limitations](METHOD.md).
- `results/pilot/`: 48 separate pilot trials, excluded from main estimates.
- `results/functional*/`: functional checks, including retained WebKit plain-Tab failures and separate Option-Tab checks.
- `results/guided*/`: observations from the earlier local HTTP teaching view, including failures before correction.
- `results/pages-functional/`: checks of this public browser simulation, separate from the campaign.

The `independent` name describes the filter's dependency. It does not mean independently reviewed. Code and analysis were assisted by AI; arithmetic cross-checks and AI review do not replace independent human validation.

## Reproduce the network experiment

Use **Node 22.12 or later**, in a dedicated checkout:

```sh
npm ci
npx playwright install chromium
node scripts/server.mjs
```

Open `http://127.0.0.1:4176/`. The optional service runs on port 4177; both bind to loopback. Choose a variant and service mode, make a consent choice, open the filter and choose Shoes. The original demo stores the preference in `localStorage`; clear it for a fresh-choice trial. Stop with Ctrl+C. There is no real CMP, tracking vendor or customer data.

Verify the existing archive without changing it:

```sh
node --test tests/*.test.mjs
node scripts/verify.mjs results/main
python3 scripts/independent-check.py results/main
```

The verifier prints a fresh receipt to stdout. To save it, add `--receipt=/path/to/new-receipt.json`; existing files cannot be overwritten. It checks the schedule, locked sources, reclassified outcomes, recorded diagnostics, products, requests, distributions and trace evidence. Failed tasks have no completion duration; a timeout is never turned into a 1,500 ms success.

Run a new campaign into a **new** output directory:

```sh
node scripts/measure.mjs --phase=main --repetitions=20 --output=reproduction-main
node scripts/analyze.mjs results/reproduction-main
node scripts/verify.mjs results/reproduction-main --receipt=results/reproduction-main/verification.json
python3 scripts/independent-check.py results/reproduction-main
```

Allow roughly 20 minutes. Trials run sequentially. Do not run other browser workloads concurrently. Record your machine and conditions: a CPU-throttling multiplier does not make different computers equivalent. Partial or failed runs are retained; use a new output name rather than merging or replacing them. See `METHOD.md` for the frozen runner's known diagnostic limitations and post-campaign verification changes.

Functional checks of the original instrument:

```sh
node scripts/functional.mjs
npx playwright install firefox webkit
node scripts/functional.mjs firefox
node scripts/functional.mjs webkit
```

The archived macOS WebKit plain-Tab journeys failed to reach native buttons; Option-Tab succeeded in a separate run. Both sets are retained. The actual OS preference was not read or changed. This is not a general accessibility claim.

## Build and test the public comparison

`pages-source/` supplies the public copy and simulated transport. `scripts/build-pages.mjs` derives the shared interaction behavior, styles and product oracle from the reviewed `guided/` sources, without changing the frozen instrument. `public/` is the generated local preview; `docs/` is its identical GitHub Pages copy.

```sh
node scripts/build-pages.mjs
node scripts/pages-server.mjs
```

Open `http://127.0.0.1:4230/consent-task-lab/` or `index-en.html`. The prefix deliberately exercises relative URLs as on GitHub Pages.

After changing public sources, `node scripts/build-pages.mjs --docs` also refreshes the identical `docs/` publishing directory. Review and test the result before pushing it.

```sh
node scripts/pages-check.mjs /tmp/consent-pages-chromium chromium
node scripts/pages-check.mjs /tmp/consent-pages-firefox firefox
node scripts/pages-check.mjs /tmp/consent-pages-webkit webkit
```

Each output directory must be new. Checks cover both languages, consent choices and modes, exact products, isolated observer errors, reset cancellation, language links, keyboard, mobile, reduced motion and JavaScript disabled. WebKit uses Option-Tab as documented above. These are functional checks, not cross-browser timing comparisons or tests on physical phones.

For the earlier network-based teaching view, run `node scripts/guided-server.mjs` and open `http://127.0.0.1:4190/`. Its fetch is real, unlike the public simulation; its original measuring interface is under `/lab/`. The private manuscript is not included in this repository.

## Scope and rights

Prepared by Bertrand Morel / [Edikka](https://www.edikka.com/). The repository contains the demo, reproduction code and laboratory evidence. Editorial correspondence, private AI-review conversations, the author portrait and the unpublished manuscript are excluded.

Copyright 2026 Bertrand Morel / Edikka. See [RIGHTS.md](RIGHTS.md). No new open-source license is granted by this release. Playwright and its dependencies retain their own licenses; dependency trees and browser binaries are not bundled.
