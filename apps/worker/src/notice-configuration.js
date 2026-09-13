import { evaluate } from './core-bundle.js';
import { RULES, ACTIVATIONS } from './rules-bundle.js';
import { AppError } from './shopify-session.js';

const rule = RULES.find(r => r.rule_id === 'EU_LEGAL_GUARANTEE_NOTICE_2026_01');
export function configurationDecision(input, snapshot, deployment) {
  if (!input || Array.isArray(input) || typeof input !== 'object' ||
      Object.keys(input).some(k => !['enabled','sellsGoodsToConsumers','marketCountry','locale'].includes(k)) ||
      typeof input.enabled !== 'boolean') throw new AppError('INVALID_CONFIGURATION');
  if (!input.enabled) return { status: 'NEEDS_INFORMATION', reasons: ['disabled_by_merchant'] };
  if (typeof input.sellsGoodsToConsumers !== 'boolean') return { status: 'NEEDS_INFORMATION', reasons: ['b2c_goods_confirmation_required'] };
  if (!input.sellsGoodsToConsumers) return { status: 'NOT_APPLICABLE', reasons: ['merchant_declares_no_b2c_goods'] };
  if (input.marketCountry !== 'ES' || input.locale !== 'es') return { status: 'UNKNOWN', reasons: ['outside_spanish_mvp'] };
  if (!snapshot.shopLocales.some(l => l.primary === true && l.published === true && l.locale === 'es')) return { status: 'NEEDS_INFORMATION', reasons: ['spanish_primary_locale_required'] };
  // Explicit migration: old deployment evidence cannot enable the new mechanism.
  if (deployment?.entryPoint !== 'header-section' || deployment.shop !== snapshot.shop.myshopifyDomain ||
      typeof deployment.themeId !== 'string' || !/^[1-9][0-9]*$/.test(deployment.themeId) ||
      deployment.reviewScope !== 'editor-placement' || deployment.reviewRecord !== 'DEV-SECTION-COVERAGE.md') {
    return { status: 'NEEDS_INFORMATION', reasons: ['header_section_review_pending'] };
  }
  // Server-owned presentation review is not merchant self-certification.
  // Positions are supported product policy, not an exhaustive legal whitelist.
  if (!deployment || deployment.reviewed !== true || !/^[a-f0-9]{64}$/.test(deployment.assetHash ?? '') ||
      !Array.isArray(deployment.officialHashes) || !deployment.officialHashes.includes(deployment.assetHash) ||
      !rule.accepted_entry_points.includes(deployment.entryPoint) || deployment.assetLocale !== 'es' ||
      deployment.isRgb !== true || deployment.interactionsToFullNotice !== 1 || deployment.yourEuropeLinkPresent !== true) {
    return { status: 'NEEDS_INFORMATION', reasons: ['deployment_evidence_pending'] };
  }
  const result = evaluate(rule, { storeId: snapshot.shop.id, market: { marketCountry: 'ES', storefrontLocale: 'es' },
    activations: ACTIVATIONS, evidence: deployment });
  // CONFIGURED with failed configuration checks is not permission to publish.
  if (result.status !== 'CONFIGURED' || result.reasons.length) return { status: 'NEEDS_INFORMATION', reasons: ['core_configuration_rejected', ...result.reasons] };
  return { status: 'CONFIGURED', reasons: [], effectiveFrom: rule.effective_from, publicVerification: 'pending', evaluationLog: result.log,
    presentation: {version:1,mechanism:'header-section',themeId:deployment.themeId,publicationReady:true,publicVerification:'pending'} };
}

export async function saveConfiguration(client, input, deployment, now = new Date()) {
  const snapshot = await client.read();
  const decision = configurationDecision(input, snapshot, deployment);
  const config = { version: 2, input, decision, updatedAt: now.toISOString() };
  return client.write(snapshot, decision.status, config);
}
