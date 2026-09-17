import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {acceptAssistedReview,approvalEvidence} from '../src/notice-assisted-review.js';
import {storedNoticeReview} from '../src/notice-review-store.js';
import {noticeClient} from '../src/shopify-notice-client.js';
import {saveConfiguration} from '../src/notice-configuration.js';
import {recheckNoticeTheme} from '../src/notice-theme-recheck.js';
import {handleNoticeApp} from '../src/notice-app.js';
const keys=await crypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']);
const b64=b=>Buffer.from(b).toString('base64url');
const env={NOTICE_ASSISTED_REVIEW_ENABLED:'true',NOTICE_REVIEW_SOURCE:'app-metafield',NOTICE_REVIEW_PUBLIC_KEY:b64(await crypto.subtle.exportKey('raw',keys.publicKey))};
const now=new Date('2026-09-17T12:00:00.000Z'),shop='test-shop.myshopify.com',content='{"type":"header"}';
const assetHash=JSON.parse(readFileSync(new URL('../../../extensions/eu-store-guard/assets-manifest.json',import.meta.url))).assets['notice-es-rgb.svg'].sha256;
const input={enabled:true,sellsGoodsToConsumers:true,marketCountry:'ES',locale:'es'};
function record(){return {version:2,source:'assisted-review',status:'approved',reviewId:'review_00001',reviewerId:'operator_01',reviewedAt:now.toISOString(),expiresAt:'2026-09-24T12:00:00.000Z',shop,shopId:'gid://shopify/Shop/1',installationId:'gid://shopify/AppInstallation/2',previousDigest:null,evidence:{reviewed:true,reviewScope:'assisted-placement',reviewRecord:'review_00001',shop,themeId:'123',sectionId:'sections--100__notice',entryPoint:'header-section',assetHash,officialHashes:[assetHash],assetLocale:'es',isRgb:true,interactionsToFullNotice:1,yourEuropeLinkPresent:true,themeRevision:{reviewed:true,themeId:'123',updatedAt:now.toISOString(),reviewedAt:now.toISOString(),headerSha256:createHash('sha256').update(content).digest('hex')}}};}
async function envelope(r=record()){const bytes=new TextEncoder().encode(JSON.stringify(r));return {payload:b64(bytes),signature:b64(await crypto.subtle.sign('Ed25519',keys.privateKey,bytes))};}
function fixture(){
  const state={shop:{id:'gid://shopify/Shop/1',myshopifyDomain:shop},currentAppInstallation:{id:'gid://shopify/AppInstallation/2'},shopLocales:[{locale:'es',primary:true,published:true}]},writes=[];
  const themes={pageInfo:{hasNextPage:false},nodes:[{id:'gid://shopify/OnlineStoreTheme/123',role:'MAIN',processing:false,processingFailed:false,updatedAt:now.toISOString(),files:{pageInfo:{hasNextPage:false},nodes:[{filename:'sections/header-group.json',body:{content}}]}}]};
  let conflict=false;
  const client=noticeClient({shop,token:'fixture'},async(_url,options)=>{
    const b=JSON.parse(options.body);
    if(b.query.startsWith('query NoticeConfiguration'))return Response.json({data:structuredClone(state)});
    if(b.query.startsWith('query NoticePublishedTheme'))return Response.json({data:{themes}});
    writes.push(b.variables.metafields);
    if(conflict)return Response.json({data:{metafieldsSet:{userErrors:[{code:'COMPARE_DIGEST_MISMATCH'}]}}});
    const result=b.variables.metafields.map(f=>({...f,compareDigest:'digest-'+writes.length+'-'+f.key}));
    for(const f of result){const target=f.ownerId===state.shop.id?state.shop:state.currentAppInstallation;target[({notice_status:'notice',notice_presentation:'presentation',notice_configuration:'config',notice_review:'review'})[f.key]]=f;}
    return Response.json({data:{metafieldsSet:{metafields:result,userErrors:[]}}});
  });return {state,themes,writes,client,conflict:()=>{conflict=true;}};
}
test('signed operator approval atomically stores review and disabled state; owner save alone then configures',async()=>{
  const f=fixture();await acceptAssistedReview(f.client,await envelope(),env,now);
  assert.equal(f.writes[0].length,4);assert.equal(f.state.shop.notice.value,'NEEDS_INFORMATION');
  assert.equal(JSON.parse(f.state.shop.presentation.value).publicationReady,false);
  assert.equal((await saveConfiguration(f.client,input,storedNoticeReview,now,true)).status,'CONFIGURED');
  assert.equal(JSON.parse(f.state.shop.presentation.value).publicVerification,'pending');
});
test('tampering, unsigned, wrong key and missing key cannot approve',async()=>{
  const good=await envelope();
  for(const [e,settings] of [[{...good,payload:b64(Buffer.from('{}'))},env],[{...good,signature:b64(new Uint8Array(64))},env],[good,{...env,NOTICE_REVIEW_PUBLIC_KEY:''}],[good,{...env,NOTICE_ASSISTED_REVIEW_ENABLED:'false'}]]){
    const f=fixture();await assert.rejects(acceptAssistedReview(f.client,e,settings,now));assert.equal(f.writes.length,0);
  }
});
test('expiry, future review and excessive duration rejected before writes',async()=>{
  for(const mutate of [r=>r.expiresAt=now.toISOString(),r=>r.reviewedAt='2026-09-18T12:00:00.000Z',r=>r.expiresAt='2027-01-01T00:00:00.000Z',r=>r.expiresAt='invalid']){
    const f=fixture(),r=record();mutate(r);assert.equal(approvalEvidence(r,now),null);await assert.rejects(acceptAssistedReview(f.client,await envelope(r),env,now));assert.equal(f.writes.length,0);
  }
});
test('signature bound to shop, installation, previous digest and exact current theme',async()=>{
  for(const mutate of [r=>r.shop='other.myshopify.com',r=>r.shopId='gid://shopify/Shop/9',r=>r.installationId='gid://shopify/AppInstallation/9',r=>r.previousDigest='old',r=>r.evidence.themeRevision.headerSha256='0'.repeat(64)]){
    const f=fixture(),r=record();mutate(r);await assert.rejects(acceptAssistedReview(f.client,await envelope(r),env,now));assert.equal(f.writes.length,0);
  }
});
test('old approval cannot be replayed; renewal needs new ID and current digest',async()=>{
  const f=fixture(),signed=await envelope();await acceptAssistedReview(f.client,signed,env,now);
  await assert.rejects(acceptAssistedReview(f.client,signed,env,now));
  const r=record();r.previousDigest=f.state.currentAppInstallation.review.compareDigest;
  await assert.rejects(acceptAssistedReview(f.client,await envelope(r),env,now));
  r.reviewId='review_00002';r.evidence.reviewRecord=r.reviewId;await acceptAssistedReview(f.client,await envelope(r),env,now);
  assert.equal(JSON.parse(f.state.currentAppInstallation.review.value).reviewId,r.reviewId);assert.equal(f.state.shop.notice.value,'NEEDS_INFORMATION');
});
test('physical removal persists invalidation; restoring bytes and saving cannot revive approval',async()=>{
  const f=fixture();await acceptAssistedReview(f.client,await envelope(),env,now);await saveConfiguration(f.client,input,storedNoticeReview,now,true);
  f.themes.nodes[0].files.nodes[0].body.content='{}';await recheckNoticeTheme(f.client,storedNoticeReview,now);
  assert.equal(JSON.parse(f.state.currentAppInstallation.review.value).status,'review_required');
  f.themes.nodes[0].files.nodes[0].body.content=content;
  assert.equal((await saveConfiguration(f.client,input,storedNoticeReview,now,true)).status,'NEEDS_INFORMATION');
});
test('expired review retracts on save and records persistent renewal requirement',async()=>{
  const f=fixture();await acceptAssistedReview(f.client,await envelope(),env,now);await saveConfiguration(f.client,input,storedNoticeReview,now,true);
  assert.equal((await saveConfiguration(f.client,input,storedNoticeReview,new Date('2026-09-25T12:00:00Z'),true)).status,'NEEDS_INFORMATION');
  assert.equal(JSON.parse(f.state.currentAppInstallation.review.value).status,'review_required');
});
test('approval publication transaction conflict is not retried or reported accepted',async()=>{
  const f=fixture();f.conflict();await assert.rejects(acceptAssistedReview(f.client,await envelope(),env,now),/SAVE_REJECTED_RELOAD/);assert.equal(f.writes.length,1);assert.equal(f.state.currentAppInstallation.review,undefined);
});
test('approval HTTP route enforces DEV, feature flag, owner session, same origin and signed body',async()=>{
  const settings={...env,APP_ENV:'development',SHOPIFY_APP_ENABLED:'true',SHOPIFY_CLIENT_ID:'a'.repeat(32),SHOPIFY_CLIENT_SECRET:'fixture-only-'.repeat(4),SHOPIFY_ALLOWED_SHOP:'eu-store-guard-dev.myshopify.com'};
  const seconds=Math.floor(Date.now()/1000),encode=v=>b64(Buffer.from(JSON.stringify(v)));
  const raw=encode({alg:'HS256',typ:'JWT'})+'.'+encode({aud:settings.SHOPIFY_CLIENT_ID,dest:'https://'+settings.SHOPIFY_ALLOWED_SHOP,iss:'https://'+settings.SHOPIFY_ALLOWED_SHOP+'/admin',sub:'7',iat:seconds,nbf:seconds,exp:seconds+60});
  const token=raw+'.'+createHmac('sha256',settings.SHOPIFY_CLIENT_SECRET).update(raw).digest('base64url');
  for(const [override,origin,auth,owner,expected] of [[{},'https://worker.example',true,true,409],[{},'https://worker.example',false,true,401],[{},'https://other.example',true,true,403],[{},'https://worker.example',true,false,403],[{NOTICE_ASSISTED_REVIEW_ENABLED:'false'},'https://worker.example',true,true,503],[{APP_ENV:'production'},'https://worker.example',true,true,503]]){
    const request=new Request('https://worker.example/app/accept-review',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+token}:{})},body:'{}'});
    let adminCalls=0;
    const response=await handleNoticeApp(request,{...settings,...override},async url=>{
      if(url.endsWith('/admin/oauth/access_token'))return Response.json({access_token:'fixture',expires_in:60,associated_user:{id:7,account_owner:owner}});
      adminCalls++;throw Error('No Admin mutation expected');
    });assert.equal(response.status,expected);assert.equal(adminCalls,0);
  }
  const page=await handleNoticeApp(new Request('https://worker.example/app'),settings);
  assert.match(await page.text(),/Aplicar revisión recibida/);
  const disabled=await handleNoticeApp(new Request('https://worker.example/app'),{...settings,NOTICE_ASSISTED_REVIEW_ENABLED:'false'});
  assert.doesNotMatch(await disabled.text(),/id="review-file"/);
});
