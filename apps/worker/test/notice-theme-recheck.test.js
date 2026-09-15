import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compareThemeRevision,recheckNoticeTheme} from '../src/notice-theme-recheck.js';
import {noticeClient} from '../src/shopify-notice-client.js';
import {handleNoticeApp} from '../src/notice-app.js';
import {saveConfiguration} from '../src/notice-configuration.js';
import {readFileSync} from 'node:fs';

const shop='eu-store-guard-dev.myshopify.com',time='2026-09-15T12:00:00.000Z';
const header=JSON.stringify({type:'header',sections:{notice:{blocks:{real:{type:'fixture-header'}}}},order:['notice']});
const baseline={shop,themeId:'123',sectionId:'sections--100__notice',themeRevision:{reviewed:true,themeId:'123',updatedAt:time,reviewedAt:time,headerSha256:createHash('sha256').update(header).digest('hex')}};
const connection=()=>({pageInfo:{hasNextPage:false},nodes:[{id:'gid://shopify/OnlineStoreTheme/123',role:'MAIN',updatedAt:time,processing:false,processingFailed:false,files:{pageInfo:{hasNextPage:false},nodes:[{filename:'sections/header-group.json',body:{content:header}}]}}]});
const presentation={version:1,mechanism:'header-section',themeId:'123',sectionId:'sections--100__notice',publicationReady:true,publicVerification:'pending'};
const config={version:2,input:{enabled:true,sellsGoodsToConsumers:true,marketCountry:'ES',locale:'es'},decision:{status:'CONFIGURED',presentation}};
const field=(value,type)=>({value,type,compareDigest:'original'});
const snapshot=()=>({shop:{id:'gid://shopify/Shop/1',myshopifyDomain:shop,notice:field('CONFIGURED','single_line_text_field'),presentation:field(JSON.stringify(presentation),'json')},currentAppInstallation:{id:'gid://shopify/AppInstallation/2',config:field(JSON.stringify(config),'json')},shopLocales:[{locale:'es',primary:true,published:true}]});
function fixture({state=snapshot(),themes=connection(),unavailable=false,conflict=false}={}) {
  const writes=[];
  return {state,writes,fetch:async(_url,options)=>{
    assert.equal(options.redirect,'manual');assert.ok(options.signal);
    const body=JSON.parse(options.body);
    if(body.query.startsWith('query NoticeConfiguration')) return Response.json({data:state});
    if(body.query.startsWith('query NoticePublishedTheme')) {
      assert.match(body.query,/roles:\[MAIN\]/);assert.match(body.query,/sections\/header-group.json/);
      return Response.json(unavailable?{errors:[{message:'private access error'}]}:{data:{themes}});
    }
    assert.match(body.query,/mutation SaveNotice/);writes.push(body.variables.metafields);
    return Response.json({data:{metafieldsSet:{userErrors:conflict?[{code:'COMPARE_DIGEST_MISMATCH'}]:[],metafields:body.variables.metafields.map(f=>({...f,compareDigest:'new'}))}}});
  }};
}
const client=f=>noticeClient({shop,token:'fixture-only'},f.fetch);
const check=(f,b=baseline)=>recheckNoticeTheme(client(f),b,new Date(time));

test('unchanged reviewed revision only preserves CONFIGURED, never creates LIVE evidence',async()=>{
  const f=fixture(),result=await check(f);
  assert.equal(result.status,'CONFIGURED');assert.equal(result.config.decision.publicVerification,'pending');
  assert.equal(result.config.decision.themeCheck.reason,'reviewed_revision_unchanged');assert.equal(f.writes.length,1);
});
test('physical section removal changes file hash and atomically retracts all publication data',async()=>{
  const themes=connection();themes.nodes[0].files.nodes[0].body.content=JSON.stringify({type:'header',sections:{},order:[]});
  const f=fixture({themes}),r=await check(f);
  assert.equal(r.status,'NEEDS_INFORMATION');assert.equal(r.config.decision.themeCheck.reason,'header_configuration_changed');
  assert.equal(f.writes.length,1);assert.equal(f.writes[0].length,3);assert.ok(f.writes[0].every(x=>x.compareDigest==='original'));
  assert.equal(JSON.parse(f.writes[0][2].value).publicationReady,false);
});
test('another published theme cannot reuse identical reviewed header bytes',async()=>{
  const themes=connection();themes.nodes[0].id='gid://shopify/OnlineStoreTheme/456';
  const r=await check(fixture({themes}));assert.equal(r.status,'NEEDS_INFORMATION');assert.equal(r.config.decision.themeCheck.reason,'published_theme_changed');
});
test('theme modification invalidates the review even if the header file is unchanged',async()=>{
  const themes=connection();themes.nodes[0].updatedAt='2026-09-15T12:01:00.000Z';
  assert.equal((await check(fixture({themes}))).config.decision.themeCheck.reason,'theme_revision_changed');
});
test('missing permissions and ambiguous API responses retract rather than preserving success',async()=>{
  for(const themes of [null,{}, {pageInfo:{hasNextPage:false},nodes:[]}, {...connection(),pageInfo:{hasNextPage:true}}, {...connection(),nodes:[...connection().nodes,...connection().nodes]}]) assert.equal((await check(fixture({themes}))).status,'NEEDS_INFORMATION');
  const r=await check(fixture({unavailable:true}));assert.equal(r.status,'NEEDS_INFORMATION');assert.equal(r.config.decision.themeCheck.reason,'theme_check_unavailable');assert.doesNotMatch(JSON.stringify(r),/private access/);
});
test('missing, malformed, future or foreign review cannot preserve publication',async()=>{
  for(const b of [null,{...baseline,shop:'other.myshopify.com'},{...baseline,sectionId:'other'}, {...baseline,themeRevision:null}, {...baseline,themeRevision:{...baseline.themeRevision,reviewedAt:'2099-01-01T00:00:00Z'}}, {...baseline,themeRevision:{...baseline.themeRevision,themeId:'456'}}]) assert.equal((await check(fixture(),b)).status,'NEEDS_INFORMATION');
});
test('file absence, wrong type and incomplete file pagination are not positive evidence',async()=>{
  for(const files of [null,{nodes:[]}, {pageInfo:{hasNextPage:true},nodes:connection().nodes[0].files.nodes},{pageInfo:{hasNextPage:false},nodes:[{filename:'sections/header-group.json',body:{content:null}}]}]) {
    const themes=connection();themes.nodes[0].files=files;assert.notEqual(await compareThemeRevision(themes,baseline,new Date(time)),'reviewed_revision_unchanged');
  }
});
test('a successful comparison cannot reactivate disabled, rejected or LIVE legacy states',async()=>{
  for(const status of ['NEEDS_INFORMATION','UNKNOWN','LIVE_PARTIAL','LIVE_VERIFIED','NOT_APPLICABLE']) {
    const state=snapshot();state.shop.notice.value=status;assert.notEqual((await check(fixture({state}))).status,'CONFIGURED');
  }
  const state=snapshot();const c=structuredClone(config);c.input.enabled=false;state.currentAppInstallation.config.value=JSON.stringify(c);assert.equal((await check(fixture({state}))).status,'NEEDS_INFORMATION');
});
test('CAS failure cannot report successful invalidation or overwrite a later save',async()=>{
  const f=fixture({conflict:true});await assert.rejects(check(f),/SAVE_REJECTED_RELOAD/);assert.equal(f.writes.length,1);
});
test('legacy configuration is not silently migrated by a theme check',async()=>{
  const state=snapshot();state.shop.presentation=null;const f=fixture({state});await assert.rejects(check(f),/METAFIELD_MIGRATION_REQUIRED/);assert.equal(f.writes.length,0);
});
test('route is disabled by default and rejects unauthenticated or foreign-origin writes',async()=>{
  const env={APP_ENV:'development',SHOPIFY_APP_ENABLED:'true',SHOPIFY_CLIENT_ID:'a'.repeat(32),SHOPIFY_CLIENT_SECRET:'fixture-only-'.repeat(4),SHOPIFY_ALLOWED_SHOP:shop};
  const request=origin=>new Request('https://worker.example/app/recheck-theme',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});
  let calls=0;const fetch=async()=>{calls++;throw Error('unexpected');};
  assert.equal((await handleNoticeApp(request('https://worker.example'),env,fetch)).status,503);
  env.NOTICE_THEME_RECHECK_ENABLED='true';assert.equal((await handleNoticeApp(request('https://other.example'),env,fetch)).status,403);
  assert.equal((await handleNoticeApp(request('https://worker.example'),env,fetch)).status,401);assert.equal(calls,0);
});
test('owner-authenticated HTTP route executes the invalidation mutation and rejects caller evidence',async()=>{
  const env={APP_ENV:'development',SHOPIFY_APP_ENABLED:'true',SHOPIFY_CLIENT_ID:'a'.repeat(32),SHOPIFY_CLIENT_SECRET:'fixture-only-'.repeat(4),SHOPIFY_ALLOWED_SHOP:shop,NOTICE_THEME_RECHECK_ENABLED:'true',NOTICE_DEPLOYMENT_EVIDENCE:JSON.stringify(baseline)};
  const seconds=Math.floor(Date.now()/1000),b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
  const raw=b64({alg:'HS256',typ:'JWT'})+'.'+b64({aud:env.SHOPIFY_CLIENT_ID,dest:'https://'+shop,iss:'https://'+shop+'/admin',sub:'7',iat:seconds,nbf:seconds,exp:seconds+60});
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.SHOPIFY_CLIENT_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const token=raw+'.'+Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(raw))).toString('base64url');
  const themes=connection();themes.nodes[0].id='gid://shopify/OnlineStoreTheme/456';const f=fixture({themes});
  const network=(url,options)=>url.endsWith('/admin/oauth/access_token')?Response.json({access_token:'fixture',expires_in:60,associated_user:{id:7,account_owner:true}}):f.fetch(url,options);
  const request=body=>new Request('https://worker.example/app/recheck-theme',{method:'POST',headers:{Origin:'https://worker.example',Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result=await handleNoticeApp(request({}),env,network);assert.equal(result.status,200);assert.equal((await result.json()).status,'NEEDS_INFORMATION');assert.equal(f.writes.length,1);
  for(const input of [true,[],{themeId:'123'}]) assert.equal((await handleNoticeApp(request(input),env,network)).status,400);
  assert.equal(f.writes.length,1);
});
test('ordinary save cannot re-enable a changed theme before writing when the guard is enabled',async()=>{
  const path=new URL('../../../extensions/eu-store-guard/assets-manifest.json',import.meta.url);
  const assetHash=JSON.parse(readFileSync(path)).assets['notice-es-rgb.svg'].sha256;
  const review={...baseline,reviewed:true,reviewScope:'editor-placement',reviewRecord:'DEV-SECTION-COVERAGE.md',entryPoint:'header-section',assetHash,officialHashes:[assetHash],assetLocale:'es',isRgb:true,interactionsToFullNotice:1,yourEuropeLinkPresent:true};
  const themes=connection();themes.nodes[0].files.nodes[0].body.content='{}';const f=fixture({themes});
  const result=await saveConfiguration(client(f),config.input,review,new Date(time),true);
  assert.equal(result.status,'NEEDS_INFORMATION');assert.equal(f.writes.length,1);assert.equal(f.writes[0][0].value,'NEEDS_INFORMATION');assert.equal(JSON.parse(f.writes[0][2].value).publicationReady,false);
});
