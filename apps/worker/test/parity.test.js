import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// Camino NODE: reglas y activaciones leidas de disco por el core.
import { loadRules, evaluate as evaluateNode, activeRules as activeNode } from "@eu-store-guard/core";
import { loadActivations } from "@eu-store-guard/core/activation";
import { completeness } from "@eu-store-guard/core/completeness";
// Camino WORKER: reglas y activaciones desde el bundle, motor via core-bundle.
import { loadRulesFromObjects, evaluate as evaluateWorker, activeRules as activeWorker } from "../src/core-bundle.js";
import { RULES, ACTIVATIONS } from "../src/rules-bundle.js";
import worker from "../src/index.js";

const env = { APP_ENV: "test", EVALUATE_TOKEN: "test-token" };
const nodeRules = loadRules();
const nodeActs = loadActivations();
const workerRules = loadRulesFromObjects(RULES);
const ON = "2026-10-01";

// Unico campo normalizado: log.at, marca de tiempo generada en tiempo de ejecucion (Date.now).
// Es deliberadamente variable entre dos llamadas y no forma parte de la decision regulatoria.
const norm = (r) => ({ ...r, log: r.log ? { ...r.log, at: "<runtime>" } : null });

// Caso A - GPSR art.19 verificado en ES (Reglamento: sin MarketActivation).
const CASO_A = { storeId: "s-parity", productId: "p-A", market: { marketCountry: "ES", storefrontLocale: "es" },
  input: { scope: { distance_sale: true, eu_market_monitored: true, gpsr_scope: "IN" },
    manufacturer: { display_name: "ACME SL", postal_address: "Madrid", electronic_address: "safety@acme.example", established_in_eu: true },
    product: { picture: "img", type_or_model: "T-1", identifier: "SKU-1" }, safety: { required: false } },
  verification: { product_offer_verified: true, surfacesVerified: ["product_offer"], direct_purchase_surface: "none" } };

// Caso B - GARAN (EmpCo) en ES: tecnicamente LIVE_VERIFIED, pero ES esta NOT_NOTIFIED => cap a CONFIGURED.
const CASO_B = { storeId: "s-parity", productId: "p-B", market: { marketCountry: "ES", storefrontLocale: "es" },
  input: { producer_guarantee: true, no_additional_cost: true, covers_whole_good: true, duration_years: 3, information_supplied_by_producer: true, brand_trademark: "ACME", model_identifier: "M-1", producer_relationship: "producer" },
  verification: { sku_applicable: true, model_identifier: true, duration: true, rgb: true, product_association: true, link: true, surfacesVerified: ["product_page", "checkout", "confirmation_email"] } };

function porRegla(rules, acts, evaluar, ctx) {
  const out = {};
  for (const r of rules) out[r.rule_id] = norm(evaluar(r, { ...ctx, activations: acts }));
  return out;
}

for (const [nombre, ctx] of [["A (GPSR)", CASO_A], ["B (EmpCo GARAN + MarketActivation)", CASO_B]]) {
  test(`paridad motor Node/Worker - caso ${nombre}: salida estructural identica`, () => {
    const n = porRegla(activeNode(nodeRules, new Date(ON)), nodeActs, evaluateNode, ctx);
    const w = porRegla(activeWorker(workerRules, new Date(ON)), ACTIVATIONS, evaluateWorker, ctx);
    // Compara status, technical_status, reasons, activation, derived y log (Evidence) de TODAS las reglas activas.
    assert.deepEqual(w, n);
    assert.equal(completeness(Object.values(n).map((x) => x.status)).percent, completeness(Object.values(w).map((x) => x.status)).percent);
  });
}

test("caso B: el cap por MarketActivation se aplica igual en ambos entornos", () => {
  const n = porRegla(activeNode(nodeRules, new Date(ON)), nodeActs, evaluateNode, CASO_B).EU_GARAN_2026_01;
  const w = porRegla(activeWorker(workerRules, new Date(ON)), ACTIVATIONS, evaluateWorker, CASO_B).EU_GARAN_2026_01;
  assert.deepEqual([n.technical_status, n.status, n.activation.status, n.reasons], ["LIVE_VERIFIED", "CONFIGURED", "NOT_NOTIFIED", ["market_activation_NOT_NOTIFIED"]]);
  assert.deepEqual([w.technical_status, w.status, w.activation.status, w.reasons], [n.technical_status, n.status, n.activation.status, n.reasons]);
  assert.equal(n.log.technical_status, "LIVE_VERIFIED");
  assert.equal(n.log.activation_checked_at, w.log.activation_checked_at);
});

test("paridad HTTP: la respuesta del Worker coincide con el calculo Node", async () => {
  for (const ctx of [CASO_A, CASO_B]) {
    const res = await worker.fetch(new Request("https://guard.local/evaluate", { method: "POST", headers: { authorization: "Bearer test-token" }, body: JSON.stringify({ ...ctx, on: ON }) }), env, {});
    const body = await res.json();
    const n = porRegla(activeNode(nodeRules, new Date(ON)), nodeActs, evaluateNode, ctx);
    assert.equal(res.status, 200);
    for (const r of body.results) assert.deepEqual({ status: r.status, technical_status: r.technical_status, reasons: r.reasons, activation: r.activation }, { status: n[r.rule_id].status, technical_status: n[r.rule_id].technical_status, reasons: n[r.rule_id].reasons, activation: n[r.rule_id].activation });
    assert.equal(body.completeness.percent, completeness(Object.values(n).map((x) => x.status)).percent);
  }
});

// Invariante estructural: el Worker no puede volver a tener su propio motor (regresion del Gate 1).
test("invariante: un unico evaluate, importado del orquestador", () => {
  const cb = readFileSync(new URL("../src/core-bundle.js", import.meta.url), "utf8");
  assert.match(cb, /@eu-store-guard\/core\/orchestrator/);
  assert.doesNotMatch(cb, /function\s+evaluate/);
  assert.doesNotMatch(cb, /RANK/);
  const idx = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
  assert.doesNotMatch(idx, /function\s+evaluate/);
});
