import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateOffer} from '../pages-source/simulation.mjs';
test('normal resolves a fictional offer; failure rejects',async()=>{
 assert.equal((await simulateOffer('normal')).message,'Available · simulated offer');
 await assert.rejects(simulateOffer('fail'),/Simulated service failure/);
});
for(const mode of ['normal','fail','hang'])test(`reset cancels ${mode} before it can settle`,async()=>{
 const controller=new AbortController();const offer=simulateOffer(mode,{signal:controller.signal});controller.abort();await assert.rejects(offer,{name:'AbortError'});
 await assert.rejects(simulateOffer(mode,{signal:controller.signal}),{name:'AbortError'});
});
test('hang remains pending without inventing a deadline result',async()=>{
 const controller=new AbortController();let settled=false;
 const offer=simulateOffer('hang',{signal:controller.signal}).then(()=>{settled=true;},()=>{settled=true;});
 await new Promise(r=>setTimeout(r,650));assert.equal(settled,false);controller.abort();await offer;
});
