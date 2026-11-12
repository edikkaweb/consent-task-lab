import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export const sourceFiles = ['package.json','package-lock.json','demo/index.html','demo/style.css','demo/app.js','tests/oracle.json','scripts/protocol.mjs','scripts/server.mjs','scripts/observer.mjs','scripts/metrics.mjs','scripts/measure.mjs','scripts/sources.mjs'];
export async function sourceHashes() {
  return Object.fromEntries(await Promise.all(sourceFiles.map(async (file) => [file, createHash('sha256').update(await readFile(new URL(`../${file}`, import.meta.url))).digest('hex')])));
}
