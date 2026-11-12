import test from 'node:test';
import assert from 'node:assert/strict';
import {matches,classify} from '../guided/oracle.mjs';
const expected=[{id:'shoe-01',name:'Canvas trainer'},{id:'shoe-02',name:'Walking shoe'}];
const good={inputAt:100,firstMatch:110,actual:expected,expected,errorAt:null};
test('guide completion requires exact IDs, names, order and final result',()=>{
  assert.equal(classify(good),'complete');
  for(const actual of [expected.slice().reverse(),expected.slice(0,1),[...expected,...expected],expected.map(p=>({...p,name:'Wrong'}))]) {
    assert.equal(matches(actual,expected),false);
    assert.equal(classify({...good,actual}),'incomplete');
  }
});
test('guide excludes late/negative/null matches and keeps late success out of the checkpoint',()=>{
  for(const firstMatch of [null,99,1601,NaN,Infinity])assert.equal(classify({...good,firstMatch}),'incomplete');
  assert.equal(classify({...good,firstMatch:1600}),'complete');
  assert.equal(classify({...good,firstMatch:null,errorAt:120}),'error');
  assert.equal(classify({...good,firstMatch:null,errorAt:99}),'incomplete');
});
