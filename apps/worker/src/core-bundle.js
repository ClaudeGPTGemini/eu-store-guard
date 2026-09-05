import { evaluateRule } from "@eu-store-guard/core/evaluator";
import { evidenceEntry } from "@eu-store-guard/core/evidence";
import { activationFor, ACTIVATION } from "@eu-store-guard/core/activation";
import { validateRule } from "@eu-store-guard/core/lint";
export { activeRules } from "@eu-store-guard/core";
const RANK = { NEEDS_INFORMATION: 0, CONFIGURED: 1, LIVE_PARTIAL: 2, LIVE_VERIFIED: 3 };
export function loadRulesFromObjects(objs) { return objs.map(validateRule); }
// Misma lógica que core/engine.evaluate, sin acceso a disco.
export function evaluate(rule, ctx) {
  const tech = evaluateRule(rule, ctx);
  let status = tech.status, reasons = [...tech.reasons], activation = null;
  const ma = rule.market_activation;
  if (ma?.required) {
    activation = activationFor(ctx.activations, ma.regime, ctx.market?.marketCountry);
    if (activation.status !== ACTIVATION.VERIFIED_ACTIVE && RANK[status] !== undefined) {
      const max = ma.max_status_when_not_verified_active ?? "CONFIGURED";
      if (RANK[status] > RANK[max]) { status = max; reasons.push(`market_activation_${activation.status}`); }
    }
  }
  const log = evidenceEntry({ storeId: ctx.storeId, marketCountry: ctx.market?.marketCountry, locale: ctx.market?.storefrontLocale, productId: ctx.productId ?? null, ruleId: rule.rule_id, ruleVersion: rule.version, status, technicalStatus: tech.status, reasons, assetHash: ctx.evidence?.assetHash ?? null, activation });
  return { status, technical_status: tech.status, reasons, derived: tech.derived, activation, log };
}
