# Setup attempts before the measured pilot

Two launch attempts failed before any browser trial was measured. These are infrastructure failures, not product-task failures and not exclusions from a performance dataset.

1. `npm run pilot` selected Node 20.10.0 on the original host and the sandbox denied binding `127.0.0.1:4176` (`listen EPERM`). A schedule was written; no browser or measured trial started.
2. After adding the Node version guard, the elevated shell still selected Node 20.10.0 and the runner rejected it before creating an output directory.

The measured pilot used an explicit Node 22.12.0 executable with loopback permission. Its complete 48 trials are retained separately in `results/pilot/`. The root experiment requires Node >=22.12, while Playwright itself supports an older minimum. Full console logs of the failed launches remain in the internal action evidence; they are not needed for public reproduction.
