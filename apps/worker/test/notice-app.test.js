import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifySession, onlineSession, appSettings } from '../src/shopify-session.js';
import { configurationDecision } from '../src/notice-configuration.js';
import { handleNoticeApp } from '../src/notice-app.js';
import { noticeClient } from '../src/shopify-notice-client.js';
import { readFileSync } from 'node:fs';

const env = { APP_ENV: 'development', SHOPIFY_APP_ENABLED: 'true', SHOPIFY_CLIENT_ID: 'a'.repeat(32), SHOPIFY_CLIENT_SECRET: 'fixture-only-'.repeat(4), SHOPIFY_ALLOWED_SHOP: 'eu-store-guard-dev.myshopify.com' };
const settings = appSettings(env);
const now = Math.floor(Date.now() / 1000);
const claims = { aud: settings.clientId, dest: `https://${settings.shop}`, iss: `https://${settings.shop}/admin`, sub: '7', iat: now, nbf: now, exp: now + 60 };
const b64 = v => Buffer.from(JSON.stringify(v)).toString('base64url');

test('Shopify redirects are rejected and never retried at their Location', async () => {
  const request = new Request('https://worker.test/app/configuration', { headers: { Authorization: 'Bearer ' + await signed() } });
  for (const status of [301, 302, 303, 307, 308]) {
    let calls = 0;
    const redirect = async (_url, options) => { calls++; assert.equal(options.redirect, 'manual'); return new Response(null, { status, headers: { Location: 'https://untrusted.example' } }); };
    await assert.rejects(onlineSession(request, env, redirect), { message: 'SHOPIFY_AUTH_FAILED' });
    assert.equal(calls, 1);
    calls = 0;
    await assert.rejects(noticeClient({ shop: settings.shop, token: 'fixture' }, redirect).read(), { message: 'SHOPIFY_REQUEST_FAILED' });
    assert.equal(calls, 1);
  }
});

test('Shopify transport and non-JSON failures expose only fixed stage codes', async () => {
  const token = await signed();
  const request = new Request('https://worker.test/app/configuration', { headers: { Authorization: 'Bearer ' + token } });
  await assert.rejects(onlineSession(request, env, async () => { throw Error('private upstream detail'); }), { message: 'SHOPIFY_AUTH_UNREACHABLE' });
  await assert.rejects(onlineSession(request, env, async () => new Response('<html>private</html>')), { message: 'SHOPIFY_AUTH_INVALID_RESPONSE' });
  await assert.rejects(noticeClient({ shop: settings.shop, token: 'fixture' }, async () => { throw Error('private'); }).read(), { message: 'SHOPIFY_ADMIN_UNREACHABLE' });
  await assert.rejects(noticeClient({ shop: settings.shop, token: 'fixture' }, async () => new Response('<html>private</html>')).read(), { message: 'SHOPIFY_ADMIN_INVALID_RESPONSE' });
});
async function signed(overrides = {}, header = { alg: 'HS256', typ: 'JWT' }) {
  const raw = b64(header) + '.' + b64({ ...claims, ...overrides });
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(settings.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return raw + '.' + Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw))).toString('base64url');
}
const input = { enabled: true, sellsGoodsToConsumers: true, marketCountry: 'ES', locale: 'es' };
const snapshot = () => ({ shop: { id: 'gid://shopify/Shop/1', myshopifyDomain: settings.shop, notice: null }, currentAppInstallation: { id: 'gid://shopify/AppInstallation/2', config: null }, shopLocales: [{ locale: 'es', primary: true, published: true }] });
const manifest = JSON.parse(readFileSync(new URL('../../../extensions/eu-store-guard/assets-manifest.json', import.meta.url)));
const evidence = { reviewed: true, assetHash: manifest.assets['notice-es-rgb.svg'].sha256, officialHashes: [manifest.assets['notice-es-rgb.svg'].sha256], assetLocale: 'es', isRgb: true, entryPoint: 'header-section', shop: settings.shop, themeId:'159264309480', sectionId:'sections--22066757075176__17893321078e794eb7', reviewScope:'editor-placement', reviewRecord:'DEV-SECTION-COVERAGE.md', interactionsToFullNotice: 1, yourEuropeLinkPresent: true };
const reply = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
function fixture({ conflict = false, owner = true } = {}) {
  const writes = [], state = snapshot();
  return { writes, state, fetch: async (url, options) => {
    assert.equal(options.redirect, 'manual'); assert.ok(options.signal);
    const body = JSON.parse(options.body);
    if (url.endsWith('/admin/oauth/access_token')) {
      assert.equal(body.requested_token_type, 'urn:shopify:params:oauth:token-type:online-access-token');
      return reply({ access_token: 'test-online', expires_in: 60, associated_user: { id: 7, account_owner: owner } });
    }
    assert.equal(url, `https://${settings.shop}/admin/api/2026-07/graphql.json`);
    if (body.query.startsWith('query')) return reply({ data: state });
    writes.push(body.variables.metafields);
    return reply({ data: { metafieldsSet: { userErrors: conflict ? [{ code: 'INVALID_COMPARE_DIGEST' }] : [], metafields: body.variables.metafields.map((m, i) => ({ ...m, compareDigest: 'new-' + i })) } } });
  } };
}
async function request(value = input, options = {}) {
  return new Request('https://worker.example/app/configuration', { method: 'POST', headers: { Origin: 'https://worker.example', 'Content-Type': 'application/json', Authorization: 'Bearer ' + await signed(), ...options.headers }, body: JSON.stringify(value) });
}

test('Session verifies signature and binds app, DEV shop and owner identity', async () => {
  assert.deepEqual(await verifySession(await signed(), settings, now), { shop: settings.shop, userId: '7' });
  const bad = [{ aud: 'wrong' }, { dest: 'https://evil.example' }, { iss: 'https://evil.example/admin' }, { dest: `https://${settings.shop}.evil.example` }, { exp: now }, { nbf: now + 1 }, { iat: now + 1 }, { exp: now + 10000 }, { sub: 7 }];
  for (const c of bad) await assert.rejects(verifySession(await signed(c), settings, now), /INVALID_SESSION/);
  await assert.rejects(verifySession(await signed({}, { alg: 'none' }), settings, now), /INVALID_SESSION/);
  const valid = await signed();
  await assert.rejects(verifySession(valid.slice(0, -8) + 'AAAAAAAA', settings, now), /INVALID_SESSION/);
});

test('Missing credentials or production environment fail closed', async () => {
  for (const e of [{}, { ...env, APP_ENV: 'production' }, { ...env, SHOPIFY_CLIENT_SECRET: '' }, { ...env, SHOPIFY_ALLOWED_SHOP: 'other.myshopify.com' }]) {
    const r = await handleNoticeApp(new Request('https://worker.example/app'), e);
    assert.equal(r.status, 503);
  }
});

test('Invalid session makes no outbound request', async () => {
  let called = false;
  const r = await handleNoticeApp(await request(input, { headers: { Authorization: 'Bearer bad' } }), env, async () => { called = true; });
  assert.equal(r.status, 401); assert.equal(called, false);
  assert.equal(r.headers.get('X-Shopify-Retry-Invalid-Session-Request'), '1');
});

test('Online exchange respects user permissions and rejects a non-owner', async () => {
  const f = fixture({ owner: false });
  await assert.rejects(onlineSession(await request(), env, f.fetch), /SHOP_OWNER_REQUIRED/);
  assert.equal(f.writes.length, 0);
});

test('Only complete Spanish configuration with reviewed deployment reaches CONFIGURED', () => {
  assert.equal(configurationDecision(input, snapshot(), evidence).status, 'CONFIGURED');
  for (const e of [null, { ...evidence, reviewed: false }, { ...evidence, entryPoint: 'bottom-right' }, { ...evidence, officialHashes: [] }, { ...evidence, interactionsToFullNotice: 2 }, { ...evidence, isRgb: false }]) assert.equal(configurationDecision(input, snapshot(), e).status, 'NEEDS_INFORMATION');
});

test('header-section configuration records v3 without claiming public verification', () => {
  const result = configurationDecision(input, snapshot(), { ...evidence, entryPoint: 'header-section', surfacesVerified: ['storefront','checkout','confirmation_email'], verification: {noticePresentation:true} });
  assert.equal(result.status, 'CONFIGURED');
  assert.equal(result.publicVerification, 'pending');
  assert.equal(result.evaluationLog.rule_version, 3);
  assert.equal(result.evaluationLog.presentation.entry_point, 'header-section');
  assert.equal(result.evaluationLog.presentation.verification_reported, false);
  assert.match(result.evaluationLog.rule_sha256, /^[a-f0-9]{64}$/);
  assert.equal(configurationDecision(input, snapshot(), {...evidence,entryPoint:'header-section',reviewed:false}).status,'NEEDS_INFORMATION');
});

test('B2C, locale, disable and market gates retract publication', () => {
  assert.equal(configurationDecision({ ...input, enabled: false }, snapshot(), evidence).status, 'NEEDS_INFORMATION');
  assert.equal(configurationDecision({ ...input, sellsGoodsToConsumers: false }, snapshot(), evidence).status, 'NOT_APPLICABLE');
  assert.equal(configurationDecision({ ...input, sellsGoodsToConsumers: undefined }, snapshot(), evidence).status, 'NEEDS_INFORMATION');
  assert.equal(configurationDecision({ ...input, locale: 'ca' }, snapshot(), evidence).status, 'UNKNOWN');
  assert.equal(configurationDecision({ ...input, marketCountry: 'FR' }, snapshot(), evidence).status, 'UNKNOWN');
  assert.equal(configurationDecision(input, { ...snapshot(), shopLocales: [{ locale: 'en', primary: true, published: true }] }, evidence).status, 'NEEDS_INFORMATION');
});

test('Client cannot supply state, verification evidence or owner identifiers', () => {
  for (const key of ['status', 'evidence', 'ownerId', 'verification']) assert.throws(() => configurationDecision({ ...input, [key]: 'injected' }, snapshot(), evidence), /INVALID_CONFIGURATION/);
});

test('Authenticated save executes one atomic CAS mutation with server-owned identifiers', async () => {
  const f = fixture();
  const r = await handleNoticeApp(await request(), { ...env, NOTICE_DEPLOYMENT_EVIDENCE: JSON.stringify(evidence) }, f.fetch);
  assert.equal(r.status, 200); assert.equal((await r.json()).status, 'CONFIGURED');
  assert.equal(f.writes.length, 1);
  assert.deepEqual(f.writes[0].map(m => m.ownerId), ['gid://shopify/Shop/1', 'gid://shopify/AppInstallation/2', 'gid://shopify/Shop/1']);
  assert.ok(f.writes[0].every(m => m.compareDigest === null));
  assert.deepEqual(f.writes[0].map(m => m.key), ['notice_status', 'notice_configuration', 'notice_presentation']);
});

test('Existing live state retracts when deployment evidence is missing', async () => {
  const f = fixture(); f.state.shop.notice = { value: 'LIVE_VERIFIED', type: 'single_line_text_field', compareDigest: 'previous' };
  const r = await handleNoticeApp(await request(), env, f.fetch);
  assert.equal(r.status, 200); assert.equal(f.writes[0][0].value, 'NEEDS_INFORMATION');
  assert.equal(f.writes[0][0].compareDigest, 'previous');
});

test('Concurrency conflict never reports success or retries overwriting newer data', async () => {
  const f = fixture({ conflict: true });
  const r = await handleNoticeApp(await request(), env, f.fetch);
  assert.equal(r.status, 409); assert.equal(f.writes.length, 1);
});

test('Foreign origin and excessive bodies fail before authentication', async () => {
  let calls = 0; const network = async () => { calls++; };
  assert.equal((await handleNoticeApp(await request(input, { headers: { Origin: 'https://evil.example' } }), env, network)).status, 403);
  assert.equal((await handleNoticeApp(await request({ value: 'x'.repeat(5000) }), env, network)).status, 413);
  assert.equal(calls, 0);
});

test('Shopify errors and unexpected identities are rejected without exposing tokens', async () => {
  const f = fixture(); f.state.shop.myshopifyDomain = 'other.myshopify.com';
  const r = await handleNoticeApp(await request(), env, f.fetch);
  assert.equal(r.status, 502); assert.equal(f.writes.length, 0);
  assert.doesNotMatch(await r.text(), /test-online|fixture-only/);
  const client = noticeClient({ shop: settings.shop, token: 'test-online' }, async () => reply({ errors: [{ message: 'private upstream detail' }] }));
  await assert.rejects(client.read(), /SHOPIFY_QUERY_REJECTED/);
});

test('App shell uses App Bridge and never contains a client secret', async () => {
  const r = await handleNoticeApp(new Request('https://worker.example/app'), env);
  assert.equal(r.status, 200); assert.match(r.headers.get('Content-Security-Policy'), /frame-ancestors https:\/\/admin.shopify.com/);
  const html = await r.text(); assert.match(html, /shopify-api-key/); assert.doesNotMatch(html, new RegExp(env.SHOPIFY_CLIENT_SECRET));
});
