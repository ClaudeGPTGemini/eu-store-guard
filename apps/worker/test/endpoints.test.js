import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../src/index.js";
import { authorizeInternalRequest, guardInternalRequest } from "../src/internal-auth.js";

const SIN = { APP_ENV: "test" };
const CON = { APP_ENV: "test", EVALUATE_TOKEN: "test-token" };
const req = (p, h = {}, i = {}) => new Request("https://guard.local" + p, { headers: h, ...i });
const st = (p, env, h, i) => worker.fetch(req(p, h, i), env, {}).then((r) => r.status);
const OK = { authorization: "Bearer test-token" };
const MAL = { authorization: "Bearer token-incorrecto" };
const POST = { method: "POST", body: "{}" };

test("internal-auth: sin secret configurado devuelve null y responde 503", () => {
  assert.equal(authorizeInternalRequest(req("/x"), SIN), null);
  assert.equal(authorizeInternalRequest(req("/x", OK), SIN), null);
  assert.equal(guardInternalRequest(req("/x", OK), SIN).status, 503);
});

test("internal-auth: sin cabecera o token erroneo devuelve false y responde 401", () => {
  assert.equal(authorizeInternalRequest(req("/x"), CON), false);
  assert.equal(authorizeInternalRequest(req("/x", MAL), CON), false);
  assert.equal(authorizeInternalRequest(req("/x", { authorization: "test-token" }), CON), false);
  assert.equal(guardInternalRequest(req("/x"), CON).status, 401);
  assert.equal(guardInternalRequest(req("/x", MAL), CON).status, 401);
});

test("internal-auth: token correcto autoriza y no genera rechazo", () => {
  assert.equal(authorizeInternalRequest(req("/x", OK), CON), true);
  assert.equal(guardInternalRequest(req("/x", OK), CON), null);
});

test("/health publico: 200 tambien sin EVALUATE_TOKEN configurado", async () => {
  assert.equal(await st("/health", SIN), 200);
  assert.equal(await st("/health", CON), 200);
  assert.equal(await st("/health", CON, MAL), 200);
});

test("/health no revela version, reglas, entorno ni configuracion", async () => {
  const body = await (await worker.fetch(req("/health"), CON, {})).json();
  assert.deepEqual(body, { ok: true });
  assert.deepEqual(Object.keys(body), ["ok"]);
});

test("/rules: 503 sin secret, 401 sin header, 401 token incorrecto, 200 token correcto", async () => {
  assert.equal(await st("/rules", SIN), 503);
  assert.equal(await st("/rules", SIN, OK), 503);
  assert.equal(await st("/rules", CON), 401);
  assert.equal(await st("/rules", CON, MAL), 401);
  assert.equal(await st("/rules", CON, OK), 200);
  const body = await (await worker.fetch(req("/rules", OK), CON, {})).json();
  assert.ok(body.some((r) => r.rule_id === "EU_GPSR_DISTANCE_SALES_ART19_2024_01"));
});

test("/evaluate: misma matriz 503 / 401 / 401 / 200", async () => {
  assert.equal(await st("/evaluate", SIN, {}, POST), 503);
  assert.equal(await st("/evaluate", CON, {}, POST), 401);
  assert.equal(await st("/evaluate", CON, MAL, POST), 401);
  assert.equal(await st("/evaluate", CON, OK, POST), 200);
});

// Invariante por frontera de modulo, no por recuento de texto.
test("invariante: index.js delega toda la autenticacion en internal-auth.js", () => {
  const src = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
  assert.match(src, /from "\.\/internal-auth\.js"/);
  assert.doesNotMatch(src, /EVALUATE_TOKEN/, "solo internal-auth.js puede leer el token");
  assert.doesNotMatch(src, /authorization/i, "index.js no debe parsear la cabecera Authorization");
});
