import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
const run=(...args)=>spawnSync(process.execPath,['scripts/verify.mjs','results/main',...args],{cwd:root,encoding:'utf8'});

test('verification preserves the archived receipt by default',async()=>{
  const receipt=path.join(root,'results/main/verification.json');
  const before=await readFile(receipt);
  const result=run();
  assert.equal(result.status,0,result.stderr);
  assert.equal(JSON.parse(result.stdout).pass,true);
  assert.deepEqual(await readFile(receipt),before);
});

test('an explicit verification receipt is create-only',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'consent-receipt-'));
  try{
    const destination=path.join(directory,'receipt.json');
    const first=run(`--receipt=${destination}`);
    assert.equal(first.status,0,first.stderr);
    assert.equal(JSON.parse(await readFile(destination,'utf8')).pass,true);
    const before=await readFile(destination);
    const second=run(`--receipt=${destination}`);
    assert.notEqual(second.status,0);
    assert.match(second.stderr,/EEXIST/);
    assert.deepEqual(await readFile(destination),before);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('unknown options fail before touching an existing file',async()=>{
  const result=run('--write');
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Usage:/);
});
