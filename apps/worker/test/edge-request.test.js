import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare';
import { readFileSync } from 'node:fs';

test('real Worker runtime accepts the Shopify request options without following redirects', async () => {
  // Read the actual options from both adapters, then construct requests in workerd.
  for (const file of ['shopify-session.js', 'shopify-notice-client.js']) {
    const source = readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');
    assert.match(source, /redirect: 'manual'/);
    assert.doesNotMatch(source, /redirect: 'follow'|redirect: 'error'/);
  }
  const mf = new Miniflare({ cf: false, workers: [{ config: {
    name: 'request-test', type: 'worker', compatibilityDate: '2026-08-01',
    manifest: { mainModule: 'index.js', modules: { 'index.js': { type: 'esm', contents:
      `export default {fetch(){const r=new Request('https://example.com',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(15000),body:'{}'});return Response.json({redirect:r.redirect,method:r.method})}}`
    } } }
  } }] });
  try { assert.deepEqual(await (await mf.dispatchFetch('https://local.test')).json(), { redirect: 'manual', method: 'POST' }); }
  finally { await mf.dispose(); }
});
