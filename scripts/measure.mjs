import {chromium} from 'playwright';
import {mkdir, readFile, writeFile, appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import os from 'node:os';
import {performance} from 'node:perf_hooks';
import {createRequire} from 'node:module';
import {protocol, schedule} from './protocol.mjs';
import {startServers} from './server.mjs';
import {installOracle} from './observer.mjs';
import {derive} from './metrics.mjs';
import {sourceHashes} from './sources.mjs';
const opts = Object.fromEntries(process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')));
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 12)) throw new Error('Node >=22.12 required; inspect npm PATH if it selects a different Node binary');
const phase = opts.phase || 'pilot';
if (!['pilot', 'main'].includes(phase)) throw new Error('phase must be pilot or main');
const repetitions = Number(opts.repetitions || (phase === 'main' ? 20 : 2));
if (!Number.isInteger(repetitions) || repetitions < 1) throw new Error('Invalid repetitions');
if (phase === 'main' && repetitions !== protocol.repetitions) throw new Error('Main repetitions must match frozen protocol');
const out = new URL(`../results/${opts.output || phase}/`, import.meta.url);
// Never overwrite a partial or completed campaign.
await mkdir(out, {recursive: false});
await mkdir(new URL('traces/', out));
const sources = await sourceHashes();
if (phase === 'main') {
  const frozen = JSON.parse(await readFile(new URL('../protocol-lock.json', import.meta.url)));
  if (JSON.stringify(frozen.sources) !== JSON.stringify(sources)) throw new Error('Source drift since protocol freeze');
}
const expected = JSON.parse(await readFile(new URL('../tests/oracle.json', import.meta.url))).shoes;
const plan = schedule(repetitions);
await writeFile(new URL('schedule.json', out), JSON.stringify(plan, null, 2));
let servers, browser;
const startedAt = new Date().toISOString();
try {
  servers = await startServers();
  browser = await chromium.launch({headless: true});
  const manifest = {phase, startedAt, protocol, repetitions, seed: protocol.seed, sources, browser: browser.version(), playwright: createRequire(import.meta.url)('playwright/package.json').version,
    node: process.version, platform: os.platform(), architecture: os.arch(), release: os.release(), cpu: os.cpus()[0].model, logicalCPUs: os.cpus().length, totalMemoryBytes: os.totalmem(), headless: true,
    notes: ['Single sequential browser process; fresh context for each trial', 'Machine load, thermal state and power profile not controlled', 'No real CMP, external vendor, network or mobile hardware', 'Trace overhead: first block only; separate sensitivity summary'], scheduleSha256: createHash('sha256').update(JSON.stringify(plan)).digest('hex')};
  await writeFile(new URL('manifest.json', out), JSON.stringify(manifest, null, 2));
  for (const cell of plan) {
    const row = {...cell, phase, startedAt: new Date().toISOString(), traced: cell.block === 1, outcome: 'harness-error', assertions: {}, commands: [], requests: [], requestFailures: [], pageErrors: []};
    const context = await browser.newContext({viewport: protocol.viewport, deviceScaleFactor: protocol.deviceScaleFactor, reducedMotion: 'no-preference', locale: 'en-GB', timezoneId: 'UTC', serviceWorkers: 'block'});
    if (cell.consent.startsWith('saved-')) await context.addInitScript((choice) => localStorage.setItem('consent-task-choice', choice), cell.consent.replace('saved-', ''));
    await context.addInitScript(installOracle, expected);
    const page = await context.newPage();
    page.on('request', (req) => row.requests.push({url: req.url(), method: req.method()}));
    page.on('requestfailed', (req) => row.requestFailures.push({url: req.url(), error: req.failure()?.errorText}));
    page.on('pageerror', (error) => row.pageErrors.push(String(error)));
    const cdp = await context.newCDPSession(page);
    const traceEvents = [];
    cdp.on('Tracing.dataCollected', ({value}) => traceEvents.push(...value));
    let tracing = false;
    try {
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', {cacheDisabled: true});
      await cdp.send('Emulation.setCPUThrottlingRate', {rate: protocol.cpuSlowdown});
      if (row.traced) {await cdp.send('Tracing.start', {categories: 'devtools.timeline,blink.user_timing,loading,disabled-by-default-devtools.screenshot', transferMode: 'ReportEvents'}); tracing = true;}
      await page.goto(`${servers.url}/?variant=${cell.variant}&mode=${cell.mode}&run=${cell.id}`, {waitUntil: 'load'});
      await page.waitForFunction(() => window.lab?.marks['app-ready'] != null);
      const command = async (target) => {const start = performance.now(); await page.locator(`#${target}`).click(); row.commands.push({target, elapsedMs: performance.now() - start});};
      if (!cell.consent.startsWith('saved-')) await command(cell.consent);
      await page.waitForTimeout(protocol.consentSettleMs);
      await command('open-filter');
      await page.waitForTimeout(protocol.filterSettleMs);
      await command('shoes');
      await page.waitForFunction((horizon) => performance.now() - window.lab.marks['filter-input'] >= horizon, protocol.observationAfterFilterMs, {timeout: 5000});
      row.snapshot = await page.evaluate(() => ({
        app: window.lab, verifier: {...window.verifier, read: undefined}, products: window.verifier.read(),
        statusText: document.querySelector('#task-status').textContent, choice: localStorage.getItem('consent-task-choice'),
        optionalText: document.querySelector('#offers').textContent, observedAt: performance.now(),
        resources: performance.getEntriesByType('resource').map((e) => e.toJSON())
      }));
      const exact = JSON.stringify(row.snapshot.products) === JSON.stringify(expected);
      const input = row.snapshot.verifier.inputs.find((i) => i.target === 'shoes')?.timeStamp;
      const completion = row.snapshot.verifier.firstCorrectDOM;
      row.outcome = exact && Number.isFinite(completion) && completion - input <= protocol.observationAfterFilterMs ? 'success' : row.snapshot.app.marks['filter-error'] ? 'explicit-error' : 'deadline';
      row.serverRequests = structuredClone(servers.requests.filter((req) => req.run === cell.id));
      const accepts = cell.consent.endsWith('accept');
      const optionalRequests = row.requests.filter((req) => new URL(req.url).port === '4177');
      row.assertions = {
        trustedInputs: row.snapshot.verifier.inputs.every((i) => i.trusted) && row.snapshot.verifier.inputs.some((i) => i.target === 'shoes'),
        consentPersisted: row.snapshot.choice === (accepts ? 'accept' : 'reject'),
        optionalRequestPolicy: accepts ? optionalRequests.length === 1 && row.serverRequests.length >= 1 : optionalRequests.length === 0 && row.serverRequests.length === 0,
        optionalState: row.snapshot.app.optional === (!accepts ? 'not-requested' : cell.mode === 'normal' ? 'ready' : cell.mode === 'fail' ? 'failed' : 'pending'),
        observedFullHorizon: row.snapshot.observedAt - input >= protocol.observationAfterFilterMs,
        exactProductsOnSuccess: row.outcome !== 'success' || exact,
        noUnhandledErrors: row.pageErrors.length === 0,
        eventTimingSupported: row.snapshot.app.supportedEntryTypes.includes('event')
      };
      row.metrics = derive(row);
      if (row.traced) await page.screenshot({path: new URL(`traces/${cell.id}.png`, out).pathname, fullPage: true});
    } catch (error) {row.error = String(error.stack || error);}
    finally {
      if (tracing) {
        const end = new Promise((resolve) => cdp.once('Tracing.tracingComplete', resolve));
        await cdp.send('Tracing.end'); await end;
        const path = `traces/${cell.id}.trace.json.gz`;
        await writeFile(new URL(path, out), gzipSync(JSON.stringify({traceEvents})));
        row.tracePath = path;
      }
      await context.close();
    }
    await appendFile(new URL('runs.jsonl', out), JSON.stringify(row) + '\n');
    console.log(`${phase} ${cell.index}/${plan.length} ${cell.id}: ${row.outcome}${Object.values(row.assertions).some((v) => !v) ? ' ASSERTION FAILURE' : ''}`);
  }
  await writeFile(new URL('complete.json', out), JSON.stringify({completedAt: new Date().toISOString(), runs: plan.length}, null, 2));
} finally {await browser?.close(); await servers?.close();}
