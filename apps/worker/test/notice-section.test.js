import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {Liquid} from 'liquidjs';
import {runInNewContext} from 'node:vm';
import {configurationDecision,saveConfiguration} from '../src/notice-configuration.js';
import {noticeClient} from '../src/shopify-notice-client.js';
import {activationScript} from '../src/notice-activation.js';

const extension=new URL('../../../extensions/eu-store-guard/',import.meta.url);
const source=name=>readFileSync(new URL('blocks/'+name+'.liquid',extension),'utf8').replace(/{% schema %}[\s\S]*?{% endschema %}/,'');
const engine=new Liquid({root:fileURLToPath(new URL('snippets/',extension)),extname:'.liquid'});
for(const name of ['t','asset_url']) engine.registerFilter(name,x=>x);
const snapshot={shop:{id:'gid://shopify/Shop/1',myshopifyDomain:'eu-store-guard-dev.myshopify.com'},currentAppInstallation:{id:'gid://shopify/AppInstallation/2'},shopLocales:[{locale:'es',primary:true,published:true}]};
const hash=JSON.parse(readFileSync(new URL('assets-manifest.json',extension))).assets['notice-es-rgb.svg'].sha256;
const evidence={reviewed:true,reviewScope:'editor-placement',reviewRecord:'DEV-SECTION-COVERAGE.md',shop:snapshot.shop.myshopifyDomain,themeId:'159264309480',sectionId:'sections--22066757075176__17893321078e794eb7',entryPoint:'header-section',assetHash:hash,officialHashes:[hash],assetLocale:'es',isRgb:true,interactionsToFullNotice:1,yourEuropeLinkPresent:true};
const input={enabled:true,sellsGoodsToConsumers:true,marketCountry:'ES',locale:'es'};

test('saved configuration drives real header HTML and atomically suppresses legacy embed',async()=>{
  const schema=JSON.parse(readFileSync(new URL('blocks/guarantee-notice-header.liquid',extension),'utf8').match(/{% schema %}([\s\S]*?){% endschema %}/)[1]);
  assert.deepEqual(schema.enabled_on,{groups:['header']});
  assert.doesNotMatch(source('guarantee-notice-header'),/section\.location|theme\.id/);
  let written;
  const client=noticeClient({shop:snapshot.shop.myshopifyDomain,token:'fixture'},async(_url,options)=>{
    const body=JSON.parse(options.body);
    if(body.query.startsWith('query')) return Response.json({data:snapshot});
    written=body.variables.metafields;
    return Response.json({data:{metafieldsSet:{userErrors:[],metafields:written.map(f=>({...f,compareDigest:'saved'}))}}});
  });
  await saveConfiguration(client,input,evidence);
  const fields=Object.fromEntries(written.filter(f=>f.ownerId===snapshot.shop.id).map(f=>[f.key,{value:f.type==='json'?JSON.parse(f.value):f.value}]));
  const context={shop:{metafields:{eu_store_guard:fields}},theme:{id:159264309480},section:{id:evidence.sectionId},request:{locale:{iso_code:'es'},design_mode:false},block:{id:'real-header'}};
  assert.match(await engine.parseAndRender(source('guarantee-notice-header'),context),/notice-es-rgb.svg/);
  assert.equal((await engine.parseAndRender(source('guarantee-notice'),context)).trim(),'');
  for(const mutate of [c=>{c.section.id='sections--123__other';},c=>{c.section.id='template--123__main';},c=>{delete c.section.id;},c=>{c.shop.metafields.eu_store_guard.notice_presentation.value.publicationReady='true';},c=>{c.shop.metafields.eu_store_guard.notice_status.value='NEEDS_INFORMATION';},c=>{delete c.shop.metafields.eu_store_guard.notice_presentation;}]) {
    const c=structuredClone(context);mutate(c);
    assert.equal((await engine.parseAndRender(source('guarantee-notice-header'),c)).trim(),'');
  }
});

test('old, foreign or incomplete placement records cannot migrate into publication',()=>{
  for(const override of [{entryPoint:'top-bar'},{shop:'other.myshopify.com'},{themeId:159264309480},{themeId:''},{sectionId:''},{sectionId:'template--123__main'},{reviewScope:'public-verified'},{reviewRecord:null},{reviewed:false}]) assert.equal(configurationDecision(input,snapshot,{...evidence,...override}).status,'NEEDS_INFORMATION');
  const result=configurationDecision(input,snapshot,evidence);
  assert.equal(result.status,'CONFIGURED');assert.equal(result.publicVerification,'pending');
  assert.equal(result.evaluationLog.presentation.verification_reported,false);
});

test('section observation distinguishes the mechanism without claiming placement or coverage',()=>{
  const {noticeActivation}=runInNewContext(activationScript+';({noticeActivation})',{document:{querySelector:()=>null}});
  const f=[{handle:'eu-store-guard',type:'theme_app_extension',activations:[{handle:'guarantee-notice-header',target:'section',status:'active',activations:[{themeId:'gid://shopify/OnlineStoreTheme/123',target:'template--product/main/block'}]}]}];
  assert.equal(noticeActivation(f,'guarantee-notice-header','section'),'active');
  assert.equal(noticeActivation(f),'unknown');
  f[0].activations[0].activations.push({themeId:'gid://shopify/OnlineStoreTheme/456',target:'header/block'});
  assert.equal(noticeActivation(f,'guarantee-notice-header','section'),'unknown');
});
