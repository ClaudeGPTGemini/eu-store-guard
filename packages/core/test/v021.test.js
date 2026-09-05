import { test } from "node:test";
import assert from "node:assert/strict";
import { evalExpr } from "../src/evaluator.js";
import { validateRule } from "../src/lint.js";
import { loadRules, evaluate } from "../src/engine.js";
import { loadActivations, activationFor } from "../src/activation.js";
import { STATUS } from "../src/status.js";

test("ternario simétrico: eq/gt con segundo operando desconocido → unknown", () => {
  const ctx = { a: 3, u: undefined, s: "UNKNOWN" };
  assert.equal(evalExpr({ eq: ["$a", "$u"] }, ctx), null);
  assert.equal(evalExpr({ eq: ["$a", "$s"] }, ctx), null);
  assert.equal(evalExpr({ gt: ["$a", "$u"] }, ctx), null);
  assert.equal(evalExpr({ gt: [5, "$s"] }, ctx), null);
});
test("ternario simétrico: in con lista desconocida → unknown; lista inválida → error de definición", () => {
  assert.equal(evalExpr({ in: ["$a", "$lista"] }, { a: 1 }), null);
  assert.equal(evalExpr({ in: ["$a", "$lista"] }, { a: 1, lista: "unknown" }), null);
  assert.throws(() => evalExpr({ in: ["$a", "$lista"] }, { a: 1, lista: "no-es-array" }), /array/);
});
test("ternario simétrico: has con elemento desconocido → unknown; conjunto inválido → error", () => {
  assert.equal(evalExpr({ has: ["$set", "$x"] }, { set: new Set(["a"]) }), null);
  assert.equal(evalExpr({ has: ["$set", "$x"] }, { x: "a" }), null);
  assert.throws(() => evalExpr({ has: ["$set", "$x"] }, { set: 42, x: "a" }), /iterable/);
  assert.equal(evalExpr({ has: ["$set", "$x"] }, { set: ["a"], x: "a" }), true);
});
test("ternario: not/all/any propagan unknown; present(UNKNOWN) es false", () => {
  assert.equal(evalExpr({ not: { eq: ["$u", 1] } }, {}), null);
  assert.equal(evalExpr({ all: [true, { eq: ["$u", 1] }] }, {}), null);
  assert.equal(evalExpr({ any: [false, { eq: ["$u", 1] }] }, {}), null);
  assert.equal(evalExpr({ present: "$s" }, { s: "unknown" }), false);
});

test("lint: sentinels reservados y guardarraíl unknown_as_false", () => {
  const base = (required) => ({ rule_id: "T", evaluation: { gates: [], required, checks: [] } });
  assert.throws(() => validateRule({ rule_id: "T", evaluation: { gates: [{ check: { eq: ["$x", "UNKNOWN"] } }] } }), /literal reservado/);
  assert.throws(() => validateRule({ rule_id: "T", evaluation: { checks: [{ check: { in: ["$x", ["A", "unknown"]] } }] } }), /literal reservado/);
  assert.throws(() => validateRule(base([{ requires_if: { eq: ["$input.t", "D"] }, unknown_as_false: true, fields: ["$input.d"] }])), /sin depends_on/);
  assert.throws(() => validateRule(base([{ requires_if: { eq: ["$input.t", "D"] }, unknown_as_false: true, depends_on: "$input.t", fields: ["$input.d"] }])), /no exigido previamente/);
  assert.throws(() => validateRule(base(["$input.t", { requires_if: { eq: ["$input.otro", "D"] }, unknown_as_false: true, depends_on: "$input.t", fields: ["$input.d"] }])), /no aparece en su requires_if/);
  assert.ok(validateRule(base(["$input.t", { requires_if: { eq: ["$input.t", "D"] }, unknown_as_false: true, depends_on: "$input.t", fields: ["$input.d"] }])));
  assert.ok(validateRule(base([{ requires_if: { eq: ["$b", true] }, fields: ["$input.t"] }, { requires_if: { eq: ["$input.t", "D"] }, unknown_as_false: true, depends_on: "$input.t", fields: ["$input.d"] }])));
  assert.equal(loadRules().length, 5); // las cinco reglas reales pasan el linter
});

test("activación: checked_at por mercado; default UNKNOWN sin fecha", () => {
  const acts = loadActivations();
  const es = activationFor(acts, "EMPCO_2024_825", "ES");
  assert.deepEqual([es.status, es.checked_at, es.regime], ["NOT_NOTIFIED", "2026-09-04", "EMPCO_2024_825"]);
  const de = activationFor(acts, "EMPCO_2024_825", "DE");
  assert.deepEqual([de.status, de.checked_at, de.national_source], ["UNKNOWN", null, null]);
  assert.equal(activationFor(acts, "REGIMEN_INEXISTENTE", "ES").checked_at, null);
});

test("evidence: technical_status y snapshot de activación reconstruible", () => {
  const rules = loadRules(); const garan = rules.find((r) => r.requirement === "EU_GARAN");
  const full = { producer_guarantee: true, no_additional_cost: true, covers_whole_good: true, duration_years: 3, information_supplied_by_producer: true, brand_trademark: "X", model_identifier: "M1", producer_relationship: "producer" };
  const ver = { sku_applicable: true, model_identifier: true, duration: true, rgb: true, product_association: true, link: true, surfacesVerified: ["product_page", "checkout", "confirmation_email"] };
  const out = evaluate(garan, { storeId: "s1", productId: "p1", input: full, verification: ver, market: { marketCountry: "ES", storefrontLocale: "es" }, activations: loadActivations() });
  assert.deepEqual([out.log.status, out.log.technical_status, out.log.activation_status, out.log.activation_checked_at], [STATUS.CONFIGURED, STATUS.LIVE_VERIFIED, "NOT_NOTIFIED", "2026-09-04"]);
  assert.match(out.log.activation_snapshot_hash, /^[a-f0-9]{64}$/);
  const gpsr = rules.find((r) => r.requirement === "EU_GPSR_DISTANCE_SALES_ART19");
  const g = evaluate(gpsr, { input: { scope: { distance_sale: false } }, market: { marketCountry: "ES" } });
  assert.deepEqual([g.log.technical_status, g.log.activation_status, g.log.activation_snapshot_hash], [STATUS.NOT_APPLICABLE, null, null]);
});

test("repair: fuentes de score y de información de reparación cerradas", () => {
  const ru = loadRules().find((r) => r.requirement === "EU_EMPCO_REPAIR_UPDATE_INFO");
  const ev = (input) => evaluate(ru, { input, market: { marketCountry: "FR" } });
  assert.deepEqual(ev({ product_kind: "PHYSICAL_GOOD", eu_reparability_score_status: "APPLICABLE", reparability_score: "7", reparability_score_source: "blog_post" }).reasons, ["reparability_score_source_not_admitted"]);
  const rep = { product_kind: "PHYSICAL_GOOD", eu_reparability_score_status: "NOT_APPLICABLE", producer_repair_info_made_available: true, spare_parts_availability: false, repair_maintenance_instructions_availability: false, repair_restrictions: "TEXT", repair_info_source: "guessed" };
  assert.deepEqual(ev(rep).reasons, ["repair_info_source_not_admitted"]);
  assert.equal(ev({ ...rep, repair_info_source: "producer_document" }).status, STATUS.CONFIGURED);
});
