import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadRules, activeRules, evaluate } from "../src/engine.js";
import { loadActivations } from "../src/activation.js";
import { STATUS } from "../src/status.js";

const rules = loadRules();
const R = Object.fromEntries(rules.map((r) => [r.requirement, r]));
const acts = loadActivations();
const S = (r) => r.status;

test("package.json en 0.2.1 y cinco reglas activas a 2026-10-01", () => {
  assert.equal(JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version, "0.2.1");
  assert.equal(activeRules(rules, new Date("2026-10-01")).length, 5);
});

test("MarketActivation: EmpCo en ES no notificado → tope CONFIGURED aunque técnicamente LIVE_VERIFIED", () => {
  const garan = R.EU_GARAN;
  const full = { producer_guarantee: true, no_additional_cost: true, covers_whole_good: true, duration_years: 3, information_supplied_by_producer: true, brand_trademark: "X", model_identifier: "M1", producer_relationship: "producer" };
  const ver = { sku_applicable: true, model_identifier: true, duration: true, rgb: true, product_association: true, link: true, surfacesVerified: ["product_page", "checkout", "confirmation_email"] };
  const es = evaluate(garan, { input: full, verification: ver, market: { marketCountry: "ES", storefrontLocale: "es" }, activations: acts });
  assert.deepEqual([es.technical_status, S(es), es.reasons, es.activation.status], [STATUS.LIVE_VERIFIED, STATUS.CONFIGURED, ["market_activation_NOT_NOTIFIED"], "NOT_NOTIFIED"]);
  const de = evaluate(garan, { input: full, verification: ver, market: { marketCountry: "DE", storefrontLocale: "de" }, activations: acts });
  assert.deepEqual([S(de), de.activation.status], [STATUS.CONFIGURED, "UNKNOWN"]);
  const deOk = { ...acts, EMPCO_2024_825: { ...acts.EMPCO_2024_825, markets: { DE: { status: "VERIFIED_ACTIVE", national_source: "BGBl. (ejemplo test)", effective_from: "2026-09-27" } } } };
  assert.equal(S(evaluate(garan, { input: full, verification: ver, market: { marketCountry: "DE", storefrontLocale: "de" }, activations: deOk })), STATUS.LIVE_VERIFIED);
  // N/A y NEEDS_INFORMATION no se tocan
  assert.equal(S(evaluate(garan, { input: { ...full, covers_whole_good: false }, market: { marketCountry: "ES" }, activations: acts })), STATUS.NOT_APPLICABLE);
});

test("MarketActivation no afecta a GPSR (Reglamento, directamente aplicable)", () => {
  const input = { scope: { distance_sale: true, eu_market_monitored: true, gpsr_scope: "IN" }, manufacturer: { display_name: "A", postal_address: "B", electronic_address: "c@c.example", established_in_eu: true }, product: { picture: "p", type_or_model: "t", identifier: "i" }, safety: { required: false } };
  const r = evaluate(R.EU_GPSR_DISTANCE_SALES_ART19, { input, verification: { product_offer_verified: true, surfacesVerified: ["product_offer"], direct_purchase_surface: "none" }, market: { marketCountry: "ES" }, activations: acts });
  assert.deepEqual([S(r), r.activation], [STATUS.LIVE_VERIFIED, null]);
});

test("Repair & Update: aplicabilidad por tres ramas con any/all", () => {
  const ru = R.EU_EMPCO_REPAIR_UPDATE_INFO;
  const ev = (input, verification) => evaluate(ru, { input, verification, market: { marketCountry: "DE" }, activations: acts });
  // tres ramas falsas → N/A
  assert.equal(S(ev({ product_kind: "PHYSICAL_GOOD", eu_reparability_score_status: "NOT_APPLICABLE", producer_repair_info_made_available: false })), STATUS.NOT_APPLICABLE);
  // ninguna true, alguna unknown → NEEDS_INFORMATION
  const u = ev({ product_kind: "PHYSICAL_GOOD", eu_reparability_score_status: "UNKNOWN", producer_repair_info_made_available: undefined });
  assert.deepEqual([S(u), u.reasons], [STATUS.NEEDS_INFORMATION, ["repair_update_applicability=unknown"]]);
  const k = ev({ product_kind: "UNKNOWN", update_info_made_available: true, eu_reparability_score_status: "NOT_APPLICABLE", producer_repair_info_made_available: false });
  assert.equal(S(k), STATUS.NEEDS_INFORMATION); // product_kind UNKNOWN es tercer valor: no se decide por intuición
});

test("Repair & Update: rama updates", () => {
  const ru = R.EU_EMPCO_REPAIR_UPDATE_INFO;
  const ev = (input, verification) => evaluate(ru, { input, verification, market: { marketCountry: "DE" }, activations: acts });
  const base = { product_kind: "GOOD_WITH_DIGITAL_ELEMENTS", update_info_made_available: true, eu_reparability_score_status: "NOT_APPLICABLE", producer_repair_info_made_available: false };
  assert.deepEqual(ev(base).reasons, ["update_info_incomplete"]);
  assert.deepEqual(ev({ ...base, update_info_source: "producer", minimum_update_period_type: "DURATION" }).reasons, ["minimum_update_duration_missing"]);
  assert.deepEqual(ev({ ...base, update_info_source: "producer", minimum_update_period_type: "END_DATE" }).reasons, ["minimum_update_end_date_missing"]);
  assert.equal(S(ev({ ...base, update_info_source: "producer", minimum_update_period_type: "DURATION", minimum_update_duration: "5 years" })), STATUS.CONFIGURED);
  assert.deepEqual(ev({ ...base, update_info_source: "ai_estimate", minimum_update_period_type: "DURATION", minimum_update_duration: "5 years" }).reasons, ["update_info_source_not_admitted"]);
});

test("Repair & Update: rama score y rama información de reparación", () => {
  const ru = R.EU_EMPCO_REPAIR_UPDATE_INFO;
  const ev = (input, verification) => evaluate(ru, { input, verification, market: { marketCountry: "FR" }, activations: acts });
  const score = { product_kind: "PHYSICAL_GOOD", eu_reparability_score_status: "APPLICABLE" };
  assert.deepEqual(ev(score).reasons, ["reparability_score_incomplete"]);
  assert.equal(S(ev({ ...score, reparability_score: "7.2", reparability_score_source: "producer_document" })), STATUS.CONFIGURED);
  const rep = { product_kind: "PHYSICAL_GOOD", eu_reparability_score_status: "NOT_APPLICABLE", producer_repair_info_made_available: true };
  assert.deepEqual(ev(rep).reasons, ["repair_info_incomplete"]);
  const partial = { ...rep, spare_parts_availability: true, repair_maintenance_instructions_availability: true, repair_restrictions: "NONE_DECLARED", repair_info_source: "producer" };
  assert.deepEqual(ev(partial).reasons, ["spare_parts_details_missing"]);
  const full = { ...partial, spare_parts_estimated_cost: "20-80 EUR", spare_parts_ordering_procedure: "producer web shop" };
  assert.equal(S(ev(full)), STATUS.CONFIGURED);
  assert.deepEqual(ev({ ...full, repair_restrictions: "maybe" }).reasons, ["repair_restrictions_invalid"]);
  // sin piezas: no exige coste ni procedimiento
  assert.equal(S(ev({ ...rep, spare_parts_availability: false, repair_maintenance_instructions_availability: false, repair_restrictions: "TEXT", repair_info_source: "producer_document" })), STATUS.CONFIGURED);
  // verificado pero FR sin activación verificada → CONFIGURED con motivo
  const v = ev(full, { precontract_info_verified: true, surfacesVerified: ["precontract_product_information"] });
  assert.deepEqual([v.technical_status, S(v), v.reasons], [STATUS.LIVE_VERIFIED, STATUS.CONFIGURED, ["market_activation_UNKNOWN"]]);
});

test("GPSR idioma ES: castellano mínimo aunque el storefront sea inglés; traducción automática tope CONFIGURED", () => {
  const es = R.GPSR_WARNING_LANGUAGE_ES_NATIONAL_MINIMUM;
  const ev = (input, market, verification) => evaluate(es, { input, market, verification, activations: acts });
  const ver = { product_offer_es_verified: true, surfacesVerified: ["product_offer_es"] };
  assert.equal(S(ev({ safety: { required: true } }, { marketCountry: "FR", storefrontLocale: "fr" })), STATUS.NOT_APPLICABLE);
  assert.equal(S(ev({ safety: { required: false } }, { marketCountry: "ES", storefrontLocale: "en" })), STATUS.NOT_APPLICABLE);
  assert.deepEqual(ev({ safety: {} }, { marketCountry: "ES", storefrontLocale: "en" }).reasons, ["safety_information_required=unknown"]);
  assert.deepEqual(ev({ safety: { required: true } }, { marketCountry: "ES", storefrontLocale: "en" }).reasons, ["input.safety.translations.es.content_missing", "input.safety.translations.es.source_missing"]);
  const ok = { safety: { required: true, translations: { es: { content: "Mantener fuera del alcance de los niños", source: "manufacturer_provided_translation" } } } };
  assert.equal(S(ev(ok, { marketCountry: "ES", storefrontLocale: "en" }, ver)), STATUS.LIVE_VERIFIED);
  const mt = ev({ safety: { required: true, translations: { es: { content: "x", source: "machine_generated_unapproved" } } } }, { marketCountry: "ES" }, ver);
  assert.deepEqual([S(mt), mt.reasons], [STATUS.CONFIGURED, ["spanish_safety_translation_not_approved"]]);
  assert.equal(ev(ok, { marketCountry: "ES" }, ver).activation, null); // norma nacional propia: sin MarketActivation
});
