import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { activationScript } from '../src/notice-activation.js';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

test('Worker bundler keepNames transformation cannot inject helpers into browser source', async () => {
  const source = readFileSync(new URL('../src/notice-activation.js', import.meta.url), 'utf8');
  const built = await transform(source, { format: 'cjs', keepNames: true, minify: false });
  const module = { exports: {} };
  runInNewContext(built.code, { module, exports: module.exports });
  assert.equal(module.exports.activationScript, activationScript);
  assert.doesNotMatch(module.exports.activationScript, /__name/);
  const listeners = {};
  runInNewContext(module.exports.activationScript, { document: { querySelector: () => ({ addEventListener: (event, fn) => { listeners[event] = fn; } }) } });
  assert.equal(typeof listeners.click, 'function');
});

const { noticeActivation } = runInNewContext(activationScript + ';({noticeActivation})', { document: { querySelector: () => null } });
const fixture = () => [{ handle: 'eu-store-guard', type: 'theme_app_extension', activations: [{ handle: 'guarantee-notice', target: 'body', status: 'active', activations: [{ target: 'theme', themeId: 'gid://shopify/OnlineStoreTheme/123' }] }] }];

test('activation identifies only our notice on a published-theme placement', () => {
  assert.equal(noticeActivation(fixture()), 'active');
  for (const change of [
    f => { f[0].handle = 'another-app'; },
    f => { f[0].type = 'ui_extension'; },
    f => { f[0].activations[0].handle = 'garan-label'; },
    f => { f[0].activations[0].target = 'section'; },
    f => { f[0].activations[0].activations[0].themeId = '123'; },
    f => { f[0].activations[0].activations[0].target = 'template--product'; },
    f => { f[0].activations[0].activations = []; },
    f => { f.push(structuredClone(f[0])); },
    f => { f[0].activations.push(structuredClone(f[0].activations[0])); }
  ]) { const f = fixture(); change(f); assert.equal(noticeActivation(f), 'unknown'); }
});

test('missing, malformed and contradictory observations never count as active', () => {
  for (const f of [null, {}, [], false, [null], [{ handle: 'eu-store-guard', type: 'theme_app_extension' }]]) assert.equal(noticeActivation(f), 'unknown');
  const f = fixture(); f[0].activations[0].status = 'available';
  assert.equal(noticeActivation(f), 'unknown');
  f[0].activations[0].activations = [];
  assert.equal(noticeActivation(f), 'inactive');
  f[0].activations[0].status = 'unavailable';
  assert.equal(noticeActivation(f), 'unavailable');
});

function browser(bridge, timers = { setTimeout, clearTimeout }) {
  const listeners = {}, button = { disabled: false, addEventListener: (name, fn) => { listeners[name] = fn; } }, output = { textContent: '', dataset: {} };
  runInNewContext(activationScript, { document: { querySelector: selector => selector === '#check-activation' ? button : output }, shopify: bridge, ...timers });
  return { button, output, click: listeners.click };
}

test('served browser code performs a read-only query and retains the public-verification warning', async () => {
  let calls = 0;
  const ui = browser({ app: { extensions: async () => { calls++; return fixture(); } } });
  assert.equal(calls, 0);
  await ui.click();
  assert.equal(calls, 1); assert.equal(ui.button.disabled, false);
  assert.match(ui.output.textContent, /activado en el tema publicado/);
  assert.match(ui.output.textContent, /no confirma que se muestre/);
  assert.equal(ui.output.dataset.esgActivationDiagnostic, 'classified');
});

test('rechecking clears stale success before waiting and after a failed query', async () => {
  let reject;
  const bridge = { app: { extensions: async () => fixture() } };
  const ui = browser(bridge); await ui.click();
  bridge.app.extensions = () => new Promise((_, r) => { reject = r; });
  const pending = ui.click();
  assert.equal(ui.button.disabled, true);
  assert.equal(ui.output.textContent, 'Consultando el tema publicado…');
  reject(Error('upstream-private-details')); await pending;
  assert.match(ui.output.textContent, /No se ha podido confirmar/);
  assert.doesNotMatch(ui.output.textContent, /upstream/);
});

test('missing App Bridge and timed-out queries stay unknown and allow retry', async () => {
  const absent = browser(undefined); await absent.click();
  assert.match(absent.output.textContent, /No se ha podido confirmar/);
  assert.equal(absent.output.dataset.esgActivationDiagnostic, 'api_unavailable');
  const timed = browser({ app: { extensions: () => new Promise(() => {}) } }, { setTimeout: fn => { queueMicrotask(fn); return 1; }, clearTimeout: () => {} });
  await timed.click(); assert.equal(timed.button.disabled, false);
  assert.match(timed.output.textContent, /No se ha podido confirmar/);
  assert.equal(timed.output.dataset.esgActivationDiagnostic, 'timeout');
});

test('diagnostic distinguishes missing block and invalid shape without exposing response data', async () => {
  const missing = browser({ app: { extensions: async () => [{ ...fixture()[0], activations: [] }] } });
  await missing.click(); assert.equal(missing.output.dataset.esgActivationDiagnostic, 'block_absent');
  const bad = browser({ app: { extensions: async () => ({ private: 'must-not-leak' }) } });
  await bad.click(); assert.equal(bad.output.dataset.esgActivationDiagnostic, 'invalid_response');
  assert.doesNotMatch(JSON.stringify(bad.output), /must-not-leak/);
});
