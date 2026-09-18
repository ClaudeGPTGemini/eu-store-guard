import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Liquid } from 'liquidjs';
import { fileURLToPath } from 'node:url';

const engine = new Liquid({root:fileURLToPath(new URL('../snippets/',import.meta.url)),extname:'.liquid'});for(const filter of ['asset_url','t'])engine.registerFilter(filter,x=>x);
const source = name => readFileSync(new URL(`../blocks/${name}.liquid`,import.meta.url),'utf8').split('{% schema %}')[0];
const tpl = source('garan-label');
const asset = {url:'https://cdn.shopify.com/producer.svg',width:5,height:4,sha256:'a'.repeat(64),fileId:'gid://shopify/GenericFile/1'};
const ready = {state:'READY',operation:'test',full:asset,nested:asset};
const render = (value,extra={}) => engine.parseAndRenderSync(tpl,{block:{id:'test'},product:{metafields:{eu_store_guard:{garan_status:{value:'CONFIGURED'},garan_duration_years:{value:3},...(value===undefined?{}:{garan_assets_v1:{type:'json',value}}),...extra}}}}).trim();
test('presence and malformed envelopes never substitute official assets',()=>{
  for(const value of [{},[],null,'',false,{state:'BLOCKED'}, {...ready,full:null}, {...ready,nested:{}}, {...ready,state:'OTHER'}])assert.equal(render(value),'',JSON.stringify(value));
  assert.match(render(undefined),/garan-rgb.svg/);
  assert.match(render(ready),/producer.svg/);
});
test('all six legacy fields independently block, including false and empty values',()=>{
  for(const key of ['garan_producer_asset','garan_producer_nested_asset','garan_producer_asset_width','garan_producer_asset_height','garan_producer_nested_width','garan_producer_nested_height'])
    for(const value of ['',null,false,320])assert.equal(render(undefined,{[key]:{value}}),'',key);
});
test('both producer assets require numeric positive bounded integers',()=>{
  for(const variant of ['full','nested'])for(const field of ['width','height'])for(const value of ['400','Infinity',Infinity,NaN,null,true,false,0,-1,.5,100001,[],{}]){
    const envelope={...ready,[variant]:{...asset,[field]:value}};
    assert.equal(render(envelope),'',`${variant}.${field}=${value}`);
  }
});
test('URL type and CDN prefix are checked; accepted attributes remain escaped',()=>{
  for(const url of [123,null,{},[],true,'javascript:alert(1)','https://cdn.shopify.com.evil/x'])assert.equal(render({...ready,full:{...asset,url}}),'');
  const html=render({...ready,full:{...asset,url:'https://cdn.shopify.com/x" onerror="alert(1)'}});
  assert.match(html,/x(?:&quot;|&#34;) onerror=(?:&quot;|&#34;)/);
  assert.doesNotMatch(html,/onerror="/);
});
test('official proportions compare decimal integers from all 26 versioned SVGs',()=>{
  const dimension = str => {const [a,b='']=str.split('.');return [BigInt(a+b),10n**BigInt(b.length)];};
  const names=['garan-rgb.svg','garan-nested-rgb.svg',...'bg,hr,cs,da,nl,de,el,en,et,fi,fr,hu,ga,it,lt,lv,mt,pl,pt,ro,sk,sl,es,sv'.split(',').map(l=>`notice-${l}-rgb.svg`)];
  for(const name of names){
    const svg=readFileSync(new URL(`../assets/${name}`,import.meta.url),'utf8');
    const box=svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/);
    const html=name.startsWith('notice-')?engine.parseAndRenderSync(source('guarantee-notice'),{block:{id:'n'},shop:{metafields:{eu_store_guard:{notice_status:{value:'CONFIGURED'}}}},request:{locale:{iso_code:name.split('-')[1]}}}):render(undefined);
    const img=[...html.matchAll(/<img[^>]+>/g)].map(x=>x[0]).find(x=>x.includes(name));
    assert.ok(img,name);
    const w=BigInt(img.match(/width="(\d+)"/)[1]),h=BigInt(img.match(/height="(\d+)"/)[1]);
    const [vw,wd]=dimension(box[2]),[vh,hd]=dimension(box[3]);
    assert.equal(w*vh*wd,h*vw*hd,name);
  }
});
