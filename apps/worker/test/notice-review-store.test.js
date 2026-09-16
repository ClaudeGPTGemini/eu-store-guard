import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {storedNoticeReview,noticeReviewSource,migrateDevReview} from '../src/notice-review-store.js';
import {noticeClient} from '../src/shopify-notice-client.js';
import {saveConfiguration} from '../src/notice-configuration.js';
import {handleNoticeApp} from '../src/notice-app.js';

const shop='eu-store-guard-dev.myshopify.com', time='2026-09-16T12:00:00Z', content='{"type":"header"}';
const now=new Date(time), input={enabled:true,sellsGoodsToConsumers:true,marketCountry:'ES',locale:'es'};
const hash=JSON.parse(readFileSync(new URL('../../../extensions/eu-store-guard/assets-manifest.json',import.meta.url))).assets['notice-es-rgb.svg'].sha256;
const evidence={reviewed:true,reviewScope:'editor-placement',reviewRecord:'DEV-SECTION-COVERAGE.md',shop,themeId:'123',sectionId:'sections--100__notice',entryPoint:'header-section',assetHash:hash,officialHashes:[hash],assetLocale:'es',isRgb:true,interactionsToFullNotice:1,yourEuropeLinkPresent:true,themeRevision:{reviewed:true,themeId:'123',updatedAt:time,reviewedAt:time,headerSha256:createHash('sha256').update(content).digest('hex')}};
const record=()=>({version:1,source:'reviewed-dev-migration',shop,shopId:'gid://shopify/Shop/1',installationId:'gid://shopify/AppInstallation/2',evidence:structuredClone(evidence)});
const state=()=>({shop:{id:'gid://shopify/Shop/1',myshopifyDomain:shop},currentAppInstallation:{id:'gid://shopify/AppInstallation/2'},shopLocales:[{locale:'es',primary:true,published:true}]});
const themes=()=>({pageInfo:{hasNextPage:false},nodes:[{id:'gid://shopify/OnlineStoreTheme/123',role:'MAIN',processing:false,processingFailed:false,updatedAt:time,files:{pageInfo:{hasNextPage:false},nodes:[{filename:'sections/header-group.json',body:{content}}]}}]});
const env={APP_ENV:'development',SHOPIFY_APP_ENABLED:'true',SHOPIFY_ALLOWED_SHOP:shop,SHOPIFY_CLIENT_ID:'a'.repeat(32),SHOPIFY_CLIENT_SECRET:'fixture-only-'.repeat(4),NOTICE_REVIEW_MIGRATION_ENABLED:'true',NOTICE_DEPLOYMENT_EVIDENCE:JSON.stringify(evidence)};
function fixture({saved=false,conflict=false,owner=true}={}) {
  const snapshot=state(),connection=themes(),writes=[];
  if(saved)snapshot.currentAppInstallation.review={type:'json',compareDigest:'review-v1',value:JSON.stringify(record())};
  const network=async(url,options)=>{
    if(url.endsWith('/admin/oauth/access_token'))return Response.json({access_token:'fixture',expires_in:60,associated_user:{id:7,account_owner:owner}});
    const b=JSON.parse(options.body);
    if(b.query.startsWith('query NoticeConfiguration'))return Response.json({data:snapshot});
    if(b.query.startsWith('query NoticePublishedTheme'))return Response.json({data:{themes:connection}});
    writes.push(b.variables.metafields);
    return Response.json({data:{metafieldsSet:{userErrors:conflict?[{code:'COMPARE_DIGEST_MISMATCH'}]:[],metafields:b.variables.metafields.map(f=>({...f,compareDigest:'saved'}))}}});
  };
  return {snapshot,connection,writes,network,client:noticeClient({shop,token:'fixture'},network)};
}
function request(path='/app/migrate-review',value={}) {
  const seconds=Math.floor(Date.now()/1000),b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
  const raw=b64({alg:'HS256',typ:'JWT'})+'.'+b64({aud:env.SHOPIFY_CLIENT_ID,dest:'https://'+shop,iss:'https://'+shop+'/admin',sub:'7',iat:seconds,nbf:seconds,exp:seconds+60});
  const token=raw+'.'+createHmac('sha256',env.SHOPIFY_CLIENT_SECRET).update(raw).digest('base64url');
  return new Request('https://worker.example'+path,{method:'POST',headers:{Origin:'https://worker.example','Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(value)});
}

test('review is bound to domain, shop ID and installation, including reinstall',()=>{
  const s=state();for(const change of [r=>r.shop='other.myshopify.com',r=>r.shopId='gid://shopify/Shop/9',r=>r.installationId='gid://shopify/AppInstallation/9',r=>r.evidence.shop='other.myshopify.com',r=>r.version=2,r=>r.source='merchant']) {
    const r=record();change(r);s.currentAppInstallation.review={value:JSON.stringify(r)};assert.equal(storedNoticeReview(s),null);
  }
  s.currentAppInstallation.review={value:JSON.stringify(record())};assert.deepEqual(storedNoticeReview(s),evidence);
});
test('stored mode never falls back to global DEV evidence for missing or malformed data',()=>{
  const resolve=noticeReviewSource({...env,NOTICE_REVIEW_SOURCE:'app-metafield'});
  for(const value of [undefined,'null','{}','[]','false','broken']) {const s=state();if(value!==undefined)s.currentAppInstallation.review={value};assert.equal(resolve(s),null);}
  assert.equal(noticeReviewSource({...env,NOTICE_REVIEW_SOURCE:'typo'})(state()),null);
});
test('explicit migration copies only reviewed matching live revision, creates one app field and no publishable status',async()=>{
  const f=fixture();assert.deepEqual(await migrateDevReview(f.client,env,now),{migrated:true,publicVerification:'pending'});
  assert.equal(f.writes.length,1);assert.equal(f.writes[0].length,1);
  const w=f.writes[0][0];assert.equal(w.key,'notice_review');assert.equal(w.compareDigest,null);assert.equal(w.ownerId,f.snapshot.currentAppInstallation.id);
  assert.deepEqual(JSON.parse(w.value).evidence,evidence);
});
test('migration rejects stale, foreign, unreviewed or existing records without writing',async()=>{
  for(const mutation of [e=>e.reviewed=false,e=>e.shop='other.myshopify.com',e=>e.themeId='456',e=>e.themeRevision.headerSha256='0'.repeat(64)]) {
    const f=fixture(),e=structuredClone(evidence);mutation(e);await assert.rejects(migrateDevReview(f.client,{...env,NOTICE_DEPLOYMENT_EVIDENCE:JSON.stringify(e)},now));assert.equal(f.writes.length,0);
  }
  const f=fixture({saved:true});await assert.rejects(migrateDevReview(f.client,env,now),/REVIEW_ALREADY_EXISTS/);assert.equal(f.writes.length,0);
});
test('configuration locks the selected review in the same publication CAS and propagates conflicts',async()=>{
  const f=fixture({saved:true});const r=await saveConfiguration(f.client,input,storedNoticeReview,now,true);assert.equal(r.status,'CONFIGURED');assert.equal(f.writes[0].length,4);
  const w=f.writes[0].find(x=>x.key==='notice_review');assert.equal(w.compareDigest,'review-v1');assert.equal(w.value,f.snapshot.currentAppInstallation.review.value);
  const c=fixture({saved:true,conflict:true});await assert.rejects(saveConfiguration(c.client,input,storedNoticeReview,now,true),/SAVE_REJECTED_RELOAD/);assert.equal(c.writes.length,1);
});
test('missing stored review retracts rather than using legacy evidence',async()=>{
  const f=fixture();const r=await saveConfiguration(f.client,input,noticeReviewSource({...env,NOTICE_REVIEW_SOURCE:'app-metafield'}),now,true);assert.equal(r.status,'NEEDS_INFORMATION');assert.equal(JSON.parse(f.writes[0].find(x=>x.key==='notice_presentation').value).publicationReady,false);
});
test('migration route requires owner, same origin, explicit flag, empty input and DEV',async()=>{
  for(const [requestValue,settings,owner,expected] of [[request(),env,true,200],[request(),env,false,403],[request(),{...env,NOTICE_REVIEW_MIGRATION_ENABLED:'false'},true,503],[request(),{...env,APP_ENV:'production'},true,503],[request('/app/migrate-review',{evidence}),env,true,400],[new Request('https://worker.example/app/migrate-review'),env,true,503]]) {
    const f=fixture({owner});const r=await handleNoticeApp(requestValue,settings,f.network);assert.equal(r.status,expected);assert.equal(f.writes.length,expected===200?1:0);
  }
  const f=fixture(),r=request();r.headers.set('Origin','https://other.example');assert.equal((await handleNoticeApp(r,env,f.network)).status,403);assert.equal(f.writes.length,0);
});
test('stored mode enforces live revision checks even if old recheck flag is absent',async()=>{
  const f=fixture({saved:true});f.connection.nodes[0].updatedAt='2026-09-16T12:01:00Z';
  const r=await handleNoticeApp(request('/app/configuration',input),{...env,NOTICE_REVIEW_SOURCE:'app-metafield'},f.network);
  assert.equal(r.status,200);assert.equal((await r.json()).status,'NEEDS_INFORMATION');
});
test('concurrent create-only migration cannot overwrite an existing review',async()=>{
  const f=fixture({conflict:true});await assert.rejects(migrateDevReview(f.client,env,now),/SAVE_REJECTED_RELOAD/);assert.equal(f.writes.length,1);assert.equal(f.writes[0][0].compareDigest,null);
});
