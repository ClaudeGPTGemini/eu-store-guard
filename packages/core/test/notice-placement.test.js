import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadRules, evaluate} from '../src/engine.js';

const rule=loadRules().find(r=>r.requirement==='EU_LEGAL_GUARANTEE_NOTICE');
const old=JSON.parse(readFileSync(new URL('../rule-history/EU_LEGAL_GUARANTEE_NOTICE_2026_01.v1.json',import.meta.url)));
const base={market:{marketCountry:'ES',storefrontLocale:'es'},activations:{EMPCO_2024_825:{markets:{ES:{status:'VERIFIED_ACTIVE'}}}},evidence:{assetHash:'fixture',officialHashes:['fixture'],assetLocale:'es',isRgb:true,entryPoint:'top-bar',reviewed:true,interactionsToFullNotice:1,yourEuropeLinkPresent:true,surfacesVerified:['storefront','checkout','confirmation_email']}};

test('placement correction is versioned and the original interpretation remains reproducible',()=>{
  assert.equal(old.version,1); assert.equal(rule.version,2);
  assert.ok(evaluate(old,base).reasons.includes('entry_point_not_accepted'));
  assert.deepEqual(evaluate(rule,base).reasons,[]);
  assert.equal(evaluate(rule,base).status,'CONFIGURED');
});

test('a reviewed declaration and surface list alone cannot produce a LIVE state',()=>{
  for(const verification of [undefined,{}, {noticePresentation:false}]) {
    assert.equal(evaluate(rule,{...base,verification}).status,'CONFIGURED');
  }
  assert.equal(evaluate(rule,{...base,verification:{noticePresentation:true}}).status,'LIVE_VERIFIED');
});

test('evidence log identifies exact rule and separates reported verification from review',()=>{
  const result=evaluate(rule,base);
  assert.equal(result.log.rule_version,2);
  assert.equal(result.log.rule_sha256,createHash('sha256').update(JSON.stringify(rule)).digest('hex'));
  assert.deepEqual(result.log.presentation,{interpretation_revision:'NOTICE-PLACEMENT-2026-09-13',entry_point:'top-bar',review_declared:true,verification_reported:false});
  assert.notEqual(result.log.rule_sha256,evaluate(old,base).log.rule_sha256);
});

test('every theme position has an explicit policy; supported values reach the rule check',()=>{
  const liquid=readFileSync(new URL('../../../extensions/eu-store-guard/blocks/guarantee-notice.liquid',import.meta.url),'utf8');
  const schema=JSON.parse(liquid.split('{% schema %}')[1].split('{% endschema %}')[0]);
  const position=schema.settings.find(s=>s.id==='position');
  assert.deepEqual(position.options.map(o=>o.value).sort(),Object.keys(rule.presentation_policy.positions).sort());
  for(const option of position.options) {
    const policy=rule.presentation_policy.positions[option.value];
    assert.ok(['supported_with_review','review_required'].includes(policy.decision));
    const result=evaluate(rule,{...base,evidence:{...base.evidence,entryPoint:option.value}});
    if(policy.decision==='supported_with_review') {
      assert.equal(policy.entry_point,option.value);
      assert.ok(rule.accepted_entry_points.includes(option.value));
      assert.deepEqual(result.reasons,[]);
    } else assert.ok(result.reasons.includes('entry_point_not_supported_by_product_policy'));
  }
  assert.equal(position.default,'top-bar');
});

