import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash, createHmac} from 'node:crypto';
import {observePublishedTheme} from '../src/notice-theme-observation.js';
import {handleNoticeApp} from '../src/notice-app.js';

const content = '{"private-setting":"do-not-expose"}';
const connection = () => ({pageInfo:{hasNextPage:false}, nodes:[{id:'gid://shopify/OnlineStoreTheme/123', role:'MAIN', updatedAt:'2026-09-15T12:00:00Z', processing:false, processingFailed:false, files:{pageInfo:{hasNextPage:false}, nodes:[{filename:'sections/header-group.json',body:{content}}]}}]});
const now = new Date('2026-09-16T12:00:00Z');
test('observation returns exact header hash and pagination, never raw content or approval',async()=>{
  const result=await observePublishedTheme({readPublishedTheme:async()=>connection()},now);
  assert.equal(result.headerSha256,createHash('sha256').update(content).digest('hex'));
  assert.equal(result.themeCount,1); assert.equal(result.fileCount,1);
  assert.equal(result.themeId,'123'); assert.equal(result.reviewed,false);
  assert.equal(result.reason,'observation_only');
  assert.doesNotMatch(JSON.stringify(result),/private-setting|do-not-expose|LIVE|CONFIGURED/);
});
test('incomplete pagination, missing header and future theme date cannot supply a baseline hash',async()=>{
  for(const mutate of [c=>{c.pageInfo.hasNextPage=true;},c=>{c.nodes=[];},c=>{c.nodes[0].files.pageInfo.hasNextPage=true;},c=>{c.nodes[0].files.nodes=[];},c=>{c.nodes[0].updatedAt='2099-01-01T00:00:00Z';}]) {
    const c=connection();mutate(c);const result=await observePublishedTheme({readPublishedTheme:async()=>c},now);
    assert.equal(result.headerSha256,undefined);assert.equal(result.reviewed,false);
  }
});
test('owner-authenticated DEV route reads Shopify once without any metafield mutation',async()=>{
  const shop='eu-store-guard-dev.myshopify.com';
  const env={APP_ENV:'development',SHOPIFY_APP_ENABLED:'true',SHOPIFY_CLIENT_ID:'a'.repeat(32),SHOPIFY_CLIENT_SECRET:'fixture-only-'.repeat(4),SHOPIFY_ALLOWED_SHOP:shop};
  const seconds=Math.floor(Date.now()/1000), b64=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
  const raw=b64({alg:'HS256',typ:'JWT'})+'.'+b64({aud:env.SHOPIFY_CLIENT_ID,dest:'https://'+shop,iss:'https://'+shop+'/admin',sub:'7',iat:seconds,nbf:seconds,exp:seconds+60});
  const token=raw+'.'+createHmac('sha256',env.SHOPIFY_CLIENT_SECRET).update(raw).digest('base64url');
  const requests=[];
  const network=async(url,options)=>{
    if(url.endsWith('/admin/oauth/access_token'))return Response.json({access_token:'fixture-only',expires_in:60,associated_user:{id:7,account_owner:true}});
    const query=JSON.parse(options.body).query;requests.push(query);assert.match(query,/^query NoticePublishedTheme/);
    return Response.json({data:{themes:connection()}});
  };
  const request=new Request('https://worker.example/app/theme-observation',{headers:{Authorization:'Bearer '+token}});
  const response=await handleNoticeApp(request,env,network);assert.equal(response.status,200);assert.equal((await response.json()).reviewed,false);assert.equal(requests.length,1);
  assert.equal((await handleNoticeApp(new Request(request.url),env,network)).status,401);
  assert.equal((await handleNoticeApp(new Request(request.url,{method:'POST'}),env,network)).status,405);
  assert.equal((await handleNoticeApp(request,{...env,APP_ENV:'production'},network)).status,503);
  assert.equal(requests.length,1);
});
