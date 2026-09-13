import assert from 'node:assert/strict';

// Fixed DEV origin. These are public/negative checks, NOT token certification.
const origin = 'https://eu-store-guard-dev.mfdavid-6dd.workers.dev';
const cases = [
  ['/health', 'GET', {}, 200, { ok: true }],
  ['/rules', 'GET', {}, 401, { error: 'unauthorized' }],
  ['/evaluate', 'POST', {}, 401, { error: 'unauthorized' }],
  ['/rules', 'GET', { Authorization: 'Bearer invalid-probe' }, 401, { error: 'unauthorized' }],
  ['/evaluate', 'POST', { Authorization: 'Bearer invalid-probe' }, 401, { error: 'unauthorized' }],
  ['/app/configuration', 'GET', {}, 401, { error: 'INVALID_SESSION' }]
];
let passed = false;
for (let attempt = 0; attempt < 6 && !passed; attempt++) {
  try {
    for (const [path, method, headers, status, body] of cases) {
      const response = await fetch(origin + path, { method, headers, redirect: 'error', signal: AbortSignal.timeout(15000) });
      assert.equal(response.status, status);
      assert.match(response.headers.get('content-type') ?? '', /application\/json/i);
      assert.deepEqual(await response.json(), body);
    }
    passed = true;
  } catch {
    // Do not log response bodies or upstream exception details.
    console.log(`DEV probe attempt ${attempt + 1}: not confirmed`);
    if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 10000));
  }
}
if (!passed) throw Error('DEV health or authentication boundary not confirmed');
console.log('DEV: health and five negative authentication checks passed; authenticated certification still pending');
