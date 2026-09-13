import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadRules, activeRules, evaluate } from "../src/engine.js";
import { isValidGaranDuration } from "../src/transforms/index.js";
import { completeness } from "../src/completeness.js";
import { STATUS, FORBIDDEN_WORDS } from "../src/status.js";
const ACT = { EMPCO_2024_825: { regime: "EMPCO_2024_825", markets: { DE: { status: "VERIFIED_ACTIVE" }, FR: { status: "VERIFIED_ACTIVE" } }, default_status: "UNKNOWN" } };

const rules = loadRules();
const R = Object.fromEntries(rules.map((r) => [r.requirement, r]));
const notice = R.EU_LEGAL_GUARANTEE_NOTICE, garan = R.EU_GARAN, gpsr = R.EU_GPSR_DISTANCE_SALES_ART19;
const S = (r) => r.status;

test("aviso: locale -> asset oficial, sin fallback a inglés", () => {
  const ok = evaluate(notice, { market: { marketCountry: "ES", storefrontLocale: "es-ES" } });
  assert.equal(ok.derived.notice.asset, "notice-es-rgb.svg");
  assert.equal(S(ok), STATUS.NEEDS_INFORMATION);
  assert.equal(S(evaluate(notice, { market: { marketCountry: "ES", storefrontLocale: "ca" } })), STATUS.UNKNOWN);
  assert.equal(S(evaluate(notice, { market: { marketCountry: "US", storefrontLocale: "en" } })), STATUS.NOT_APPLICABLE);
});

test("aviso: CONFIGURED con motivos, LIVE_PARTIAL, LIVE_VERIFIED", () => {
  const evidence = { assetHash: "abc", officialHashes: new Set(["abc"]), assetLocale: "de", isRgb: true, entryPoint: "header", interactionsToFullNotice: 1, yourEuropeLinkPresent: true, surfacesVerified: ["storefront"] };
  const market = { marketCountry: "DE", storefrontLocale: "de" };
  assert.equal(S(evaluate(notice, { market, evidence, verification: { noticePresentation: true }, activations: ACT })), STATUS.LIVE_PARTIAL);
  assert.equal(S(evaluate(notice, { market, evidence: { ...evidence, surfacesVerified: notice.surfaces }, verification: { noticePresentation: true }, activations: ACT })), STATUS.LIVE_VERIFIED);
  const bad = evaluate(notice, { market, evidence: { ...evidence, assetHash: "zzz", yourEuropeLinkPresent: false } });
  assert.equal(S(bad), STATUS.CONFIGURED);
  assert.deepEqual(bad.reasons.sort(), ["asset_not_official", "your_europe_link_missing"]);
});

test("GARAN duración: enteros y medios años > 2", () => {
  for (const ok of [3, 4, 5, 10, 12, 2.5, 3.5]) assert.equal(isValidGaranDuration(ok), true, String(ok));
  for (const ko of [2, 2.2, 4.1, 1.5, -3, NaN]) assert.equal(isValidGaranDuration(ko), false, String(ko));
});

test("GARAN: FALSE => N/A, UNKNOWN => NEEDS_INFORMATION, reseller sin label => NEEDS_PRODUCER_LABEL", () => {
  const full = { producer_guarantee: true, no_additional_cost: true, covers_whole_good: true, duration_years: 3, information_supplied_by_producer: true, brand_trademark: "X", model_identifier: "M1", producer_relationship: "producer" };
  const ev = (input, verification) => evaluate(garan, { input, verification, market: { marketCountry: "DE", storefrontLocale: "de" }, activations: ACT });
  assert.equal(S(ev({ ...full, covers_whole_good: false })), STATUS.NOT_APPLICABLE);
  const unk = ev({ ...full, covers_whole_good: undefined });
  assert.deepEqual([S(unk), unk.reasons], [STATUS.NEEDS_INFORMATION, ["covers_whole_good=unknown"]]);
  assert.deepEqual(ev({ ...full, duration_years: 2.2 }).reasons, ["duration_invalid_or_missing"]);
  const r = ev({ ...full, producer_relationship: "reseller" });
  assert.deepEqual([S(r), r.reasons], [STATUS.NEEDS_INFORMATION, ["NEEDS_PRODUCER_LABEL"]]);
  assert.equal(S(ev({ ...full, producer_relationship: "reseller", producer_label_asset: "garan-producer.svg" })), STATUS.CONFIGURED);
  assert.equal(S(ev(full)), STATUS.CONFIGURED);
  const ver = { sku_applicable: true, model_identifier: true, duration: true, rgb: true, product_association: true, link: true, surfacesVerified: ["product_page", "checkout", "confirmation_email"] };
  assert.equal(S(ev(full, ver)), STATUS.LIVE_VERIFIED);
  assert.equal(S(ev(full, { ...ver, rgb: false })), STATUS.CONFIGURED);
});

test("GPSR: scope OUT => N/A, UNKNOWN => UNKNOWN, fabricante UE sin persona responsable", () => {
  const base = { scope: { distance_sale: true, eu_market_monitored: true, gpsr_scope: "IN" },
    manufacturer: { display_name: "ACME GmbH", postal_address: "Berlin", electronic_address: "safety@acme.example", established_in_eu: true },
    product: { picture: "img1", type_or_model: "Model A", identifier: "SKU-1" },
    safety: { required: false } };
  const ev = (input, verification) => evaluate(gpsr, { input, verification });
  assert.equal(S(ev({ ...base, scope: { ...base.scope, gpsr_scope: "OUT" } })), STATUS.NOT_APPLICABLE);
  assert.equal(S(ev({ ...base, scope: { ...base.scope, gpsr_scope: "UNKNOWN" } })), STATUS.UNKNOWN);
  assert.equal(S(ev({ ...base, scope: { ...base.scope, gpsr_scope: undefined } })), STATUS.UNKNOWN);
  assert.equal(S(ev(base)), STATUS.CONFIGURED);
  const m = ev({ ...base, manufacturer: { ...base.manufacturer, electronic_address: undefined } });
  assert.deepEqual([S(m), m.reasons], [STATUS.NEEDS_INFORMATION, ["input.manufacturer.electronic_address_missing"]]);
});

test("GPSR: fabricante fuera de la UE exige persona responsable; establecimiento desconocido => NEEDS_INFORMATION", () => {
  const base = { scope: { distance_sale: true, eu_market_monitored: true, gpsr_scope: "IN" },
    manufacturer: { display_name: "Shenzhen X", postal_address: "Shenzhen", electronic_address: "x@x.example", established_in_eu: false },
    product: { picture: "img1", type_or_model: "T1", identifier: "GTIN-1" }, safety: { required: false } };
  const ev = (input) => evaluate(gpsr, { input });
  assert.deepEqual(ev(base).reasons, ["responsible_person_required_non_eu_manufacturer"]);
  assert.equal(S(ev({ ...base, responsible_person: { name: "EU Rep BV", postal_address: "Amsterdam", electronic_address: "rep@rep.example" } })), STATUS.CONFIGURED);
  assert.deepEqual(ev({ ...base, manufacturer: { ...base.manufacturer, established_in_eu: undefined } }).reasons, ["manufacturer_establishment_unknown"]);
});

test("GPSR: seguridad — fuente autoritativa, traducción automática tope CONFIGURED, regla de idioma tope LIVE_PARTIAL", () => {
  const base = { scope: { distance_sale: true, eu_market_monitored: true, gpsr_scope: "IN" },
    manufacturer: { display_name: "ACME", postal_address: "Paris", electronic_address: "a@a.example", established_in_eu: true },
    product: { picture: "p", type_or_model: "t", identifier: "i" },
    safety: { required: true, content: "Keep away from children", source: "manufacturer", translation_source: "manufacturer_provided_translation", market_language_rule: "VERIFIED" } };
  const ver = { product_offer_verified: true, surfacesVerified: ["product_offer"], direct_purchase_surface: "none" };
  const ev = (input, verification) => evaluate(gpsr, { input, verification });
  assert.deepEqual(ev({ ...base, safety: { ...base.safety, required: undefined } }).reasons, ["safety_information_applicability_unknown"]);
  assert.deepEqual(ev({ ...base, safety: { ...base.safety, content: undefined } }).reasons, ["safety_information_required_but_missing"]);
  assert.deepEqual(ev({ ...base, safety: { ...base.safety, source: "ai_guess" } }).reasons, ["safety_source_not_authoritative"]);
  assert.equal(S(ev(base, ver)), STATUS.LIVE_VERIFIED);
  const mt = ev({ ...base, safety: { ...base.safety, translation_source: "machine_generated_unapproved" } }, ver);
  assert.deepEqual([S(mt), mt.reasons.includes("machine_translation_unapproved")], [STATUS.CONFIGURED, true]);
  const lang = ev({ ...base, safety: { ...base.safety, market_language_rule: "UNKNOWN" } }, ver);
  assert.deepEqual([S(lang), lang.reasons], [STATUS.LIVE_PARTIAL, ["market_warning_language_rule_unknown"]]);
  const qb = ev(base, { ...ver, direct_purchase_surface: "detected_unverified" });
  assert.deepEqual([S(qb), qb.reasons], [STATUS.LIVE_PARTIAL, ["direct_purchase_surface_unverified"]]);
});

test("completeness excluye N/A y lleva disclaimer", () => {
  const c = completeness([STATUS.LIVE_VERIFIED, STATUS.NEEDS_INFORMATION, STATUS.NOT_APPLICABLE, STATUS.CONFIGURED]);
  assert.equal(c.percent, 50);
  assert.match(c.disclaimer, /not a legal compliance assessment/);
});

test("engine: reglas activas por fecha, evidencia versionada, sin evaluadores por requisito", () => {
  assert.equal(activeRules(rules, new Date("2024-01-01")).length, 0);
  assert.equal(activeRules(rules, new Date("2025-06-01")).length, 2);
  assert.equal(activeRules(rules, new Date("2026-10-01")).length, 5);
  const out = evaluate(garan, { storeId: "s1", productId: "p1", market: { marketCountry: "FR", storefrontLocale: "fr" }, input: { producer_guarantee: false } });
  assert.deepEqual([out.log.rule_version, out.log.status], [1, STATUS.NOT_APPLICABLE]);
  const engine = readFileSync(new URL("../src/engine.js", import.meta.url), "utf8");
  assert.equal(engine.includes("EVALUATORS"), false);
});

test("palabras prohibidas no aparecen como estados en el núcleo ni en las reglas", () => {
  const src = ["src/status.js", "src/engine.js", "src/evaluator.js", "src/completeness.js", "src/evidenceLog.js", "src/transforms/index.js", "src/activation.js"]
    .map((f) => readFileSync(new URL("../" + f, import.meta.url), "utf8")).join("\n")
    .split("\n").filter((l) => !l.includes("FORBIDDEN_WORDS") && !l.trim().startsWith("//")).join("\n");
  const ruleStatuses = rules.flatMap((r) => JSON.stringify(r.evaluation).match(/"(on_false|on_unknown|on_fail|max)":"([A-Z_]+)"/g) ?? []);
  for (const w of FORBIDDEN_WORDS) { assert.equal(src.includes(`"${w}"`), false, w); assert.equal(ruleStatuses.some((s) => s.endsWith(`"${w}"`)), false, w); }
});

