import {readFile, writeFile} from 'node:fs/promises';
import {sourceHashes} from './sources.mjs';
import {protocol} from './protocol.mjs';
const pilot = JSON.parse(await readFile(new URL('../results/pilot/complete.json', import.meta.url)));
const runs = (await readFile(new URL('../results/pilot/runs.jsonl', import.meta.url), 'utf8')).trim().split('\n').map(JSON.parse);
if (runs.some((r) => r.outcome === 'harness-error' || Object.values(r.assertions).some((v) => !v))) throw new Error('Unresolved pilot instrumentation failures');
await writeFile(new URL('../protocol-lock.json', import.meta.url), JSON.stringify({frozenAt: new Date().toISOString(), protocol, sources: await sourceHashes(), pilot, decision: 'Retain all 24 conditions, 20 blocks. Pilot excluded from main analysis. No outcome-based run exclusions.'}, null, 2), {flag: 'wx'});
console.log('Protocol frozen');
