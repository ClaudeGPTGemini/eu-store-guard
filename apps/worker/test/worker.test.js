import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { readFileSync, readdirSync } from "node:fs";
const env = { APP_ENV: "test", EVALUATE_TOKEN: "test-token" };
const call = (path, init = {}) => worker.fetch(new Request("https://guard.local" + path, {
  ...init,
  headers: { authorization: "Bearer test-token", ...(init.headers ?? {}) },
}), env, {});

test("health y listado de reglas", async () => {
  const h = await (await call("/health")).json();
  assert.deepEqual([h.ok, h.rules, h.env], [true, 5, "test"]);
  const rules = await (await call("/rules")).json();
  assert.ok(rules.some((r) => r.rule_id === "EU_GPSR_DISTANCE_SALES_ART19_2024_01"));
});

test("evaluate: GPSR verificado en ES; EmpCo con tope por activación", async () => {
  const body = { storeId: "dev", productId: "p1", market: { marketCountry: "ES", storefrontLocale: "es" }, on: "2026-10-01",
    input: { scope: { distance_sale: true, eu_market_monitored: true, gpsr_scope: "IN" }, manufacturer: { display_name: "ACME", postal_address: "Madrid", electronic_address: "a@a.example", established_in_eu: true }, product: { picture: "p", type_or_model: "t", identifier: "i" }, safety: { required: false },
      producer_guarantee: true, no_additional_cost: true, covers_whole_good: true, duration_years: 3, information_supplied_by_producer: true, brand_trademark: "X", model_identifier: "M", producer_relationship: "producer" },
    verification: { product_offer_verified: true, surfacesVerified: ["product_offer", "product_page", "checkout", "confirmation_email"], direct_purchase_surface: "none", sku_applicable: true, model_identifier: true, duration: true, rgb: true, product_association: true, link: true } };
  const r = await (await call("/evaluate", { method: "POST", body: JSON.stringify(body) })).json();
  const by = Object.fromEntries(r.results.map((x) => [x.rule_id, x]));
  assert.equal(by.EU_GPSR_DISTANCE_SALES_ART19_2024_01.status, "LIVE_VERIFIED");
  assert.deepEqual([by.EU_GARAN_2026_01.technical_status, by.EU_GARAN_2026_01.status, by.EU_GARAN_2026_01.activation.status], ["LIVE_VERIFIED", "CONFIGURED", "NOT_NOTIFIED"]);
  assert.match(r.disclaimer, /not a legal compliance assessment/);
  assert.equal(typeof r.completeness.percent, "number");
});

test("evaluate: JSON inválido → 400; ruta desconocida → 404", async () => {
  assert.equal((await call("/evaluate", { method: "POST", body: "{" })).status, 400);
  assert.equal((await call("/nada")).status, 404);
});

test("evaluate falla cerrado sin configuración o autorización", async () => {
  const request = new Request("https://guard.local/evaluate", { method: "POST", body: "{}" });
  assert.equal((await worker.fetch(request.clone(), { APP_ENV: "test" }, {})).status, 503);
  assert.equal((await worker.fetch(request, env, {})).status, 401);
});

test("evaluate rechaza cuerpos mayores de 128 KiB", async () => {
  const body = JSON.stringify({ value: "x".repeat(128 * 1024) });
  assert.equal((await call("/evaluate", { method: "POST", body })).status, 413);
});

test("rules-bundle está sincronizado con packages/core", () => {
  const bundled = readFileSync(new URL("../src/rules-bundle.js", import.meta.url), "utf8");
  for (const f of readdirSync(new URL("../../../packages/core/rules", import.meta.url))) {
    const id = JSON.parse(readFileSync(new URL("../../../packages/core/rules/" + f, import.meta.url), "utf8")).rule_id;
    assert.ok(bundled.includes(`"rule_id":"${id}"`), `falta ${id} en el bundle: ejecutar scripts/bundle-rules.mjs`);
  }
});
