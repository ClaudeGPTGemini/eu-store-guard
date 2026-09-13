import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectSvg, exactRatio } from '../src/producer-svg.js';
import { importProducerPair, LEGACY, KEY, SCHEMA } from '../src/producer-import.js';
import { shopifyProducerClient } from '../src/shopify-producer-client.js';
import { Liquid } from 'liquidjs';
import { readFileSync } from 'node:fs';

const svg = body => new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320">${body}</svg>`);
const args = { ownerId: 'gid://shopify/Product/1', full: svg(''), nested: svg('') };
test('XML parser uses actual root, exact ratios and complete document', () => {
  assert.deepEqual(exactRatio('1.4','1'), {width:7,height:5});
  const commented = new TextEncoder().encode('<!-- <svg viewBox="0 0 1 1"/> -->'+new TextDecoder().decode(svg('')));
  assert.equal(inspectSvg(commented).width,5);
  for(const text of ['<html><svg viewBox="0 0 1 1"/></html>', '<svg xmlns="http://www.w3.org/2000/svg" width="10cm" height="10mm"/>', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><g></svg>', '<!DOCTYPE svg><svg/>']) assert.throws(()=>inspectSvg(new TextEncoder().encode(text)));
  for(const body of [' '.repeat(8100)+'<image href="https://example.com/x"/>','<script/>','<style/>','<g onclick="x"/>','<g xmlns="http://www.w3.org/2001/XInclude"/>','<rect fill="url(https://example.com/x)"/>']) assert.throws(()=>inspectSvg(svg(body)));
  assert.throws(()=>inspectSvg(new Uint8Array(2_000_001)));
});
function fakeClient(failAt) {
  let state=null, revision=0;
  const files=new Map(), calls=[];
  const client={
    async read(){ return state && {value:JSON.stringify(state),compareDigest:String(revision)}; },
    async write(owner,value,digest){
      calls.push(value.state);
      if(digest !== (state ? String(revision):null)) throw Error('conflict');
      if(failAt==='final'&&value.state==='READY') throw Error('write failed');
      state=structuredClone(value); revision++;
      if(failAt==='lost response'&&value.state==='READY') throw Error('lost response');
      return {compareDigest:String(revision)};
    },
    async upload(bytes,filename,onCreated){
      calls.push('upload'); if(failAt==='upload')throw Error('upload failed');
      const id=`gid://shopify/GenericFile/${files.size+1}`,url=`https://cdn.shopify.com/${filename}`;
      files.set(url,new Uint8Array(bytes));onCreated(id);return{id,url};
    },
    async download(url){return failAt==='bytes'?svg('<rect/>'):files.get(url);},
    async removeLegacy(){calls.push('delete');if(failAt==='delete')throw Error('delete failed');}
  };
  return {client,calls,files,state:()=>state};
}
test('import blocks first, uploads exact bytes, removes legacy, and commits pair once',async()=>{
  const f=fakeClient();await importProducerPair({...args,client:f.client});
  assert.deepEqual(f.calls,['BLOCKED','upload','upload','delete','READY']);
  assert.equal(f.state().state,'READY');
  assert.deepEqual(f.files.get(f.state().full.url),args.full);
  assert.equal(f.state().full.width,5);
});
test('invalid input and each failed phase retain persisted BLOCKED',async()=>{
  const engine = new Liquid();for(const filter of ['asset_url','t'])engine.registerFilter(filter,x=>x);
  const template = readFileSync(new URL('../../../extensions/eu-store-guard/blocks/garan-label.liquid',import.meta.url),'utf8').split('{% schema %}')[0];
  for(const phase of ['input','upload','bytes','delete','final']){
    const f=fakeClient(phase);
    await assert.rejects(importProducerPair({...args,full:phase==='input'?svg('<script/>'):args.full,client:f.client}));
    assert.equal(f.state().state,'BLOCKED',phase);
    const html=engine.parseAndRenderSync(template,{block:{id:'test'},product:{metafields:{eu_store_guard:{garan_status:{value:'CONFIGURED'},garan_duration_years:{value:3},garan_assets_v1:{type:'json',value:f.state()}}}}});
    assert.equal(html.trim(),'',`failure ${phase} must remove whole block, including official fallback`);
    await assert.rejects(importProducerPair({...args,client:f.client}),/reconcile/);
  }
});
test('successful persisted envelope renders uploaded pair with extracted ratio',async()=>{
  const f=fakeClient();await importProducerPair({...args,client:f.client});
  const engine=new Liquid();for(const filter of ['asset_url','t'])engine.registerFilter(filter,x=>x);
  const template=readFileSync(new URL('../../../extensions/eu-store-guard/blocks/garan-label.liquid',import.meta.url),'utf8').split('{% schema %}')[0];
  const html=engine.parseAndRenderSync(template,{block:{id:'test'},product:{metafields:{eu_store_guard:{garan_status:{value:'CONFIGURED'},garan_duration_years:{value:3},garan_assets_v1:{type:'json',value:f.state()}}}}});
  assert.equal((html.match(/width="5" height="4"/g)||[]).length,2);
  assert.ok(html.includes(f.state().full.url));assert.ok(html.includes(f.state().nested.url));
  assert.doesNotMatch(html,/garan-rgb.svg|garan-nested-rgb.svg/);
});
test('concurrent import cannot acquire the same digest twice',async()=>{
  const f=fakeClient();const result=await Promise.allSettled([importProducerPair({...args,client:f.client}),importProducerPair({...args,client:f.client})]);
  assert.equal(result.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(f.calls.filter(x=>x==='upload').length,2);
});
test('lost final response never deletes files potentially referenced by READY',async()=>{
  const f=fakeClient('lost response');await assert.rejects(importProducerPair({...args,client:f.client}));
  assert.equal(f.state().state,'READY');assert.equal(f.files.size,2);
});

test('real Shopify adapter sends staged bytes, checks responses and commits GraphQL inputs',async()=>{
  let state=null,rev=0,lastBytes,uploaded=0;
  const mutations=[];
  const fetchImpl=async(url,options)=>{
    if(url==='https://storage.googleapis.com/stage'){
      assert.equal(options.headers,undefined);lastBytes=new Uint8Array(await options.body.get('file').arrayBuffer());uploaded++;
      return new Response('',{status:201});
    }
    if(url.startsWith('https://cdn.shopify.com/')){assert.equal(options.headers,undefined);return new Response(lastBytes);}
    assert.equal(options.headers['X-Shopify-Access-Token'],'test-only');
    const {query,variables:v}=JSON.parse(options.body);let data;
    if(query.includes('query Definition'))data={metafieldDefinitions:{nodes:[]}};
    else if(query.includes('DefinitionCreate')){assert.equal(v.definition.validations[0].name,'schema');assert.deepEqual(JSON.parse(v.definition.validations[0].value),SCHEMA);data={metafieldDefinitionCreate:{createdDefinition:{id:'definition'},userErrors:[]}};}
    else if(query.includes('ProducerState'))data={product:{id:args.ownerId,metafield:state?{value:JSON.stringify(state),compareDigest:String(rev)}:null}};
    else if(query.includes('ProducerSet')){
      const m=v.metafields[0];assert.equal(m.key,KEY);assert.equal(m.compareDigest,state?String(rev):null);
      state=JSON.parse(m.value);rev++;mutations.push(state.state);
      data={metafieldsSet:{metafields:[{value:m.value,compareDigest:String(rev)}],userErrors:[]}};
    } else if(query.includes('mutation Stage'))data={stagedUploadsCreate:{stagedTargets:[{url:'https://storage.googleapis.com/stage',resourceUrl:'https://storage.googleapis.com/resource',parameters:[]}],userErrors:[]}};
    else if(query.includes('CreateFile')){assert.equal(v.files[0].contentType,'FILE');data={fileCreate:{files:[{id:`gid://shopify/GenericFile/${uploaded}`,fileStatus:'UPLOADED'}],userErrors:[]}};}
    else if(query.includes('FileStatus'))data={node:{id:v.id,fileStatus:'READY',url:`https://cdn.shopify.com/${uploaded}.svg`}};
    else if(query.includes('LegacyDelete')){assert.deepEqual(v.metafields.map(x=>x.key),LEGACY);data={metafieldsDelete:{deletedMetafields:[],userErrors:[]}};}
    else throw Error('Unexpected operation');
    return Response.json({data});
  };
  const client=shopifyProducerClient({shop:'example.myshopify.com',token:'test-only',fetchImpl});
  await client.ensureDefinition();await importProducerPair({...args,client});
  assert.deepEqual(mutations,['BLOCKED','READY']);assert.equal(uploaded,2);
});
test('adapter rejects HTTP, GraphQL and userErrors instead of accepting 200',async()=>{
  for(const response of [new Response('',{status:403}),Response.json({errors:[{message:'error'}]}),Response.json({data:{metafieldsSet:{userErrors:[{message:'conflict'}]}}})]){
    const client=shopifyProducerClient({shop:'example.myshopify.com',token:'test-only',fetchImpl:async()=>response});
    await assert.rejects(client.write(args.ownerId,{state:'BLOCKED'},null));
  }
});
