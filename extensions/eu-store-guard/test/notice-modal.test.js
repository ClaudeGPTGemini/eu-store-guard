import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Liquid} from 'liquidjs';
import {runInNewContext} from 'node:vm';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
const sha=b=>createHash('sha256').update(b).digest('hex');
const engine=new Liquid({root:fileURLToPath(new URL('snippets/',root)),extname:'.liquid'});
engine.registerFilter('asset_url',v=>'/assets/'+v);
engine.registerFilter('t',v=>v);
const render=(locale='es',status='CONFIGURED')=>engine.parseAndRenderSync(read('blocks/guarantee-notice.liquid').split('{% schema %}')[0],{block:{id:'notice-17',settings:{position:'bottom-left'}},request:{locale:{iso_code:locale}},shop:{metafields:{eu_store_guard:{notice_status:{value:status}}}}});
test('Spanish transcript tied to reviewed official bytes and its own bytes',()=>{
  const m=JSON.parse(read('transcriptions/es.json'));
  assert.equal(sha(readFileSync(new URL('assets/'+m.asset,root))),m.assetSha256);
  assert.equal(sha(read('snippets/notice-transcript-es.liquid')),m.transcriptSha256);
  assert.equal(m.status,'visually-checked');
  assert.match(m.reviewedAt,/^\d{4}-\d{2}-\d{2}$/);
  assert.equal(m.independentAudit,'pending');
});
test('Spanish renders native closed dialog and structured transcript without changing image ratio',()=>{
  const html=render();
  assert.match(html,/<dialog id="esg-notice-panel-notice-17"[^>]*aria-labelledby="esg-notice-title-notice-17"/);
  assert.doesNotMatch(html,/<dialog[^>]*\sopen(?:\s|>|=)/);
  assert.match(html,/tabindex="-1" autofocus/);
  assert.match(html,/<form method="dialog">/);
  assert.match(html,/data-esg-position="bottom-left"/);
  assert.match(html,/data-esg-transcription="visually-checked"/);
  assert.match(html,/<section[^>]*lang="es"/);
  assert.match(html,/<ol><li>Póngase/);
  assert.match(html,/width="59528" height="84189"/);
});
test('Unreviewed locale keeps its official SVG, never borrows Spanish transcript',()=>{
  const html=render('el');
  assert.match(html,/notice-el-rgb.svg/);
  assert.match(html,/data-esg-transcription="pending"/);
  assert.doesNotMatch(html,/class="esg-notice__transcript"/);
  assert.doesNotMatch(html,/Póngase/);
});
test('Retracted state suppresses modal and transcript together',()=>{
  for(const state of ['UNKNOWN','NEEDS_INFORMATION','NOT_APPLICABLE','',null]) assert.equal(render('es',state).trim(),'');
});

test('Notice has a native asset link before any JavaScript runs',()=>{
  for(const locale of ['es','el']) assert.match(render(locale),new RegExp('<a href="/assets/notice-'+locale+'-rgb.svg" class="esg-notice__trigger"'));
});

test('Image is redundant only with transcript; pending images have a distinct description',()=>{
  const es=render().match(/<img[^>]+>/)[0], el=render('el').match(/<img[^>]+>/)[0];
  assert.match(es,/alt="" aria-hidden="true"/);
  assert.doesNotMatch(es,/role=|aria-labelledby=/);
  assert.match(el,/alt="guarantee.image_description"/);
  assert.doesNotMatch(el,/aria-hidden|aria-labelledby/);
});

function clickNotice(dialog,extra={}) {
  const listeners={}; let prevented=false;
  const trigger={getAttribute:()=> 'panel',setAttribute:()=>{},matches:()=>true};
  const document={addEventListener:(name,fn)=>{listeners[name]=fn;},getElementById:()=>dialog};
  runInNewContext(read('assets/eu-store-guard.js'),{window:{},document});
  listeners.click({target:{closest:()=>trigger},button:0,preventDefault:()=>{prevented=true;},...extra});
  return prevented;
}

test('Missing or failing modal support preserves native link navigation',()=>{
  assert.equal(clickNotice(null),false);
  assert.equal(clickNotice({}),false);
  assert.equal(clickNotice({addEventListener(){},showModal(){throw Error('unsupported');}}),false);
});

test('Only successful ordinary modal clicks suppress navigation',()=>{
  let opened=0,focused=0;
  const dialog={addEventListener(){},showModal(){opened++;},querySelector:()=>({focus(){focused++;}})};
  assert.equal(clickNotice(dialog),true);
  assert.equal(opened,1); assert.equal(focused,1);
  for(const extra of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{button:1},{defaultPrevented:true}]) assert.equal(clickNotice(dialog,extra),false);
  assert.equal(opened,1);
});
