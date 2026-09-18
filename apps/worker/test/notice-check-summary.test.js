import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {checkSummary} from '../src/notice-check-summary.js';
import {handleNoticeApp} from '../src/notice-app.js';

const now=new Date('2026-09-16T12:00:00.000Z');
test('historical summary rejects missing, malformed and future timestamps without exposing raw data',()=>{
  for(const check of [null,{}, {scope:'other',checkedAt:now.toISOString()}, {scope:'admin-theme-revision',checkedAt:'bad'}, {scope:'admin-theme-revision',checkedAt:'2027-01-01T00:00:00.000Z'}]) assert.equal(checkSummary(check,now),null);
  assert.deepEqual(checkSummary({scope:'admin-theme-revision',checkedAt:now.toISOString(),reason:'reviewed_revision_unchanged',privateData:'secret'},now),{checkedAt:now.toISOString(),unchanged:true});
  assert.equal(checkSummary({scope:'admin-theme-revision',checkedAt:now.toISOString(),reason:'theme_check_unavailable'},now).unchanged,false);
});
test('served UI describes dated observations in the past and warns about the monitoring gap',async()=>{
  const env={APP_ENV:'development',SHOPIFY_APP_ENABLED:'true',SHOPIFY_CLIENT_ID:'a'.repeat(32),SHOPIFY_CLIENT_SECRET:'fixture-only-'.repeat(4),SHOPIFY_ALLOWED_SHOP:'eu-store-guard-dev.myshopify.com'};
  const response=await handleNoticeApp(new Request('https://worker.example/app/app.js'),env);
  const source=await response.text();
  const context={document:{querySelector:selector=>['#inspect-theme','#theme-observation','#review-file','#review-message'].includes(selector)?null:{}}};
  runInNewContext(source.split("form.addEventListener('submit'")[0],context);
  const result=context.describeCheck({checkedAt:now.toISOString(),unchanged:true});
  assert.match(result,/16\/9\/2026/);assert.match(result,/En ese momento/);assert.match(result,/No hay vigilancia continua/);assert.match(result,/no confirma que el aviso sea visible/);
  assert.match(context.describeCheck(null),/No hay una comprobación/);
  assert.match(context.describeCheck({checkedAt:now.toISOString(),unchanged:false}),/No se confirmó/);
  assert.match(source,/describe\(d.status\)\+describeCheck\(d.themeCheck\)/);
  assert.match(source,/describe\(current.status\)\+describeCheck\(current.themeCheck\)/);
});
