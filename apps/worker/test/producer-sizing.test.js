import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectSvg} from '../src/producer-svg.js';

const dimensions = attributes => {
  const {width,height}=inspectSvg(new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg" ${attributes}/>`));
  return {width,height};
};
test('whole dimensions preserve their scale without gcd reduction',()=>{
  assert.deepEqual(dimensions('viewBox="0 0 400 320"'),{width:400,height:320});
  assert.deepEqual(dimensions('viewBox="0 0 5 4"'),{width:5,height:4});
  assert.deepEqual(dimensions('viewBox="0 0 99991 99989"'),{width:99991,height:99989});
});
test('root absolute viewport takes precedence over different viewBox ratio',()=>{
  for(const suffix of ['', 'px']) assert.deepEqual(dimensions(`viewBox="0 0 100 100" width="800${suffix}" height="200${suffix}"`),{width:800,height:200});
  assert.deepEqual(dimensions('width="800" height="200"'),{width:800,height:200});
});
test('fractional sizes retain exact ratio and viewBox origin does not change extent',()=>{
  assert.deepEqual(dimensions('width="120.4" height="60.6" viewBox="0 0 100 100"'),{width:602,height:303});
  assert.deepEqual(dimensions('viewBox="10 10 400 320"'),dimensions('viewBox="0 0 400 320"'));
  assert.deepEqual(dimensions('viewBox="-10 -10 1.4 1"'),{width:7,height:5});
});
test('ambiguous root lengths are rejected even with valid viewBox',()=>{
  for(const root of ['width="800"','height="200"','width="100%" height="100%"','width="10cm" height="10mm"','width="0" height="1"','width="100001" height="1"']) assert.throws(()=>dimensions(`viewBox="0 0 100 100" ${root}`));
});
