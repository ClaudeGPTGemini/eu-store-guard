import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Liquid } from '../extensions/eu-store-guard/node_modules/liquidjs/dist/liquid.node.mjs';
import { packageDev } from './package-shopify-dev.mjs';

const parent = mkdtempSync(join(tmpdir(), 'esg-package-test-'));
const target = join(parent, 'es');
const report = packageDev({ output: target });
const block = readFileSync(join(target, 'extensions/eu-store-guard/blocks/guarantee-notice.liquid'), 'utf8').replace(/{% schema %}[\s\S]*?{% endschema %}/g, '');
const liquid = new Liquid({root:join(target,'extensions/eu-store-guard/snippets'),extname:'.liquid'});
for (const filter of ['asset_url','stylesheet_tag','script_tag','t']) liquid.registerFilter(filter, x => x);
const render = (locale, status='CONFIGURED') => liquid.parseAndRender(block, {request:{locale:{iso_code:locale}},block:{id:'test'},shop:{metafields:{eu_store_guard:{notice_status:{value:status}}}}});
test('section candidate renders only in opted-in DEV editor and preserves independent IDs', async () => {
  const source=readFileSync(join(target,'extensions/eu-store-guard/blocks/guarantee-notice-section-dev.liquid'),'utf8');
  const schema=JSON.parse(source.match(/{% schema %}([\s\S]*?){% endschema %}/)[1]);
  assert.equal(schema.target,'section');
  assert.equal(schema.settings.some(s=>s.id==='position'),false);
  const template=source.replace(/{% schema %}[\s\S]*?{% endschema %}/,'');
  const context={request:{design_mode:true,locale:{iso_code:'es'}},block:{id:'section-1',settings:{esg_dev_preview:true}},shop:{permanent_domain:'eu-store-guard-dev.myshopify.com',metafields:{eu_store_guard:{notice_status:{value:'NEEDS_INFORMATION'}}}}};
  const html=await liquid.parseAndRender(template,context);
  assert.match(html,/data-esg-position="inline"/);
  assert.match(html,/aria-controls="esg-notice-panel-section-1"/);
  assert.match(html,/id="esg-notice-panel-section-1"/);
  assert.match(html,/data-esg-status="NEEDS_INFORMATION"/);
  for(const status of ['NEEDS_INFORMATION','CONFIGURED','LIVE_PARTIAL','LIVE_VERIFIED']) {
    for(const mutate of [c=>{c.request.design_mode=false;},c=>{c.request.design_mode='true';},c=>{c.shop.permanent_domain='other.myshopify.com';},c=>{c.block.settings.esg_dev_preview=false;},c=>{c.request.locale.iso_code='en';}]) {
      const c=structuredClone(context); c.shop.metafields.eu_store_guard.notice_status.value=status; mutate(c);
      assert.equal((await liquid.parseAndRender(template,c)).trim(),'');
    }
  }
});
test('DEV package stays below limit and includes exactly three unchanged official assets', () => {
  assert.ok(report.extensionBytes < 10_000_000);
  assert.equal(Object.keys(report.officialAssets).length, 3);
  for (const name of Object.keys(report.officialAssets)) assert.deepEqual(readFileSync(join(target,'extensions/eu-store-guard/assets',name)),readFileSync(new URL(`../extensions/eu-store-guard/assets/${name}`,import.meta.url)));
  assert.equal(readdirSync(join(target,'extensions/eu-store-guard/assets')).length,5);
});
test('actual Liquid renders Spanish and regional Spanish only when configured', async () => {
  for (const locale of ['es','es-ES']) assert.match(await render(locale), /notice-es-rgb.svg/);
  for (const locale of ['en','fr','ca','xx']) {const html=await render(locale);assert.doesNotMatch(html, /<img|<button|notice-.*-rgb.svg/);assert.match(html,/LANGUAGE_REVIEW_REQUIRED/);}
  for(const status of ['UNKNOWN','NEEDS_INFORMATION','NOT_APPLICABLE','',null]) assert.doesNotMatch(await render('es',status), /<img|<button/);
});
test('rejects unsupported locale, oversized package, and existing destination before writing', () => {
  assert.throws(() => packageDev({output:target}), /new directory/);
  const bad=join(parent,'invalid');assert.throws(() => packageDev({output:bad,locales:['xx']}), /absent/);assert.equal(existsSync(bad),false);
  const all=join(parent,'all');assert.throws(() => packageDev({output:all,locales:'bg,hr,cs,da,nl,de,el,en,et,fi,fr,hu,ga,it,lt,lv,mt,pl,pt,ro,sk,sl,es,sv'.split(',')}),/10 MB/);assert.equal(existsSync(all),false);
});

test('DEV preview requires editor, exact development shop and explicit boolean opt-in', async () => {
  const base = {request:{design_mode:true,locale:{iso_code:'es'}},block:{id:'preview',settings:{position:'top-bar',esg_dev_preview:true}},shop:{permanent_domain:'eu-store-guard-dev.myshopify.com',metafields:{eu_store_guard:{notice_status:{value:'NEEDS_INFORMATION'}}}}};
  const html = await liquid.parseAndRender(block,base);
  assert.match(html,/data-esg-dev-preview="editor-only"/);
  assert.match(html,/No confirma publicación ni verificación/);
  assert.match(html,/data-esg-status="NEEDS_INFORMATION"/);
  assert.match(html,/notice-es-rgb.svg/);
  assert.doesNotMatch(html,/data-esg-status="(?:CONFIGURED|LIVE_)/);
  for (const mutate of [c=>{c.request.design_mode=false;},c=>{delete c.request.design_mode;},c=>{c.request.design_mode='true';},c=>{c.shop.permanent_domain='other.myshopify.com';},c=>{c.block.settings.esg_dev_preview=false;},c=>{c.block.settings.esg_dev_preview='true';},c=>{c.block.settings.position='bottom-right';},c=>{c.request.locale.iso_code='en';}]) {
    const c=structuredClone(base); mutate(c);
    assert.equal((await liquid.parseAndRender(block,c)).trim(),'');
  }
  const source=readFileSync(new URL('../extensions/eu-store-guard/blocks/guarantee-notice.liquid',import.meta.url),'utf8');
  assert.doesNotMatch(source,/esg_dev_preview/);
});

test('end-of-document candidate has a native link but cannot publish through the preview switch', async () => {
  const context={request:{design_mode:true,locale:{iso_code:'es'}},block:{id:'end-preview',settings:{position:'inline',esg_dev_preview:true}},shop:{permanent_domain:'eu-store-guard-dev.myshopify.com',metafields:{eu_store_guard:{notice_status:{value:'NEEDS_INFORMATION'}}}}};
  const html=await liquid.parseAndRender(block,context);
  assert.match(html,/data-esg-position="inline"/);
  assert.match(html,/<a href="notice-es-rgb.svg" class="esg-notice__trigger"/);
  assert.match(html,/data-esg-dev-preview="editor-only"/);
  assert.match(html,/data-esg-status="NEEDS_INFORMATION"/);
  for (const status of ['NEEDS_INFORMATION','CONFIGURED','LIVE_VERIFIED']) {
    const c=structuredClone(context); c.request.design_mode=false;
    c.shop.metafields.eu_store_guard.notice_status.value=status;
    assert.equal((await liquid.parseAndRender(block,c)).trim(),'');
  }
  const css=readFileSync(join(target,'extensions/eu-store-guard/assets/eu-store-guard.css'),'utf8');
  const candidate=css.match(/\.esg-notice\[data-esg-position="inline"\]\s*\{([^}]+)\}/)[1];
  assert.match(candidate,/position:\s*static/);
  assert.doesNotMatch(candidate,/fixed|absolute|sticky|transform|order\s*:/);
});
