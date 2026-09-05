import { readFileSync, readdirSync } from "node:fs";
import { evaluateRule } from "./evaluator.js";
import { evidenceEntry } from "./evidenceLog.js";
import { activationFor, ACTIVATION } from "./activation.js";
import { validateRule } from "./lint.js";

const RANK = { NEEDS_INFORMATION: 0, CONFIGURED: 1, LIVE_PARTIAL: 2, LIVE_VERIFIED: 3 };

export function loadRules(dir = new URL("../rules/", import.meta.url)) {
  return readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => validateRule(JSON.parse(readFileSync(new URL(f, dir), "utf8"))));
}
export function activeRules(rules, on = new Date()) {
  const byReq = {};
  for (const r of rules) if (new Date(r.effective_from) <= on && (!byReq[r.requirement] || byReq[r.requirement].version < r.version)) byReq[r.requirement] = r;
  return Object.values(byReq);
}
// Sin evaluadores por requisito. technical_status = resultado del intérprete; status = tras MarketActivation.
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
