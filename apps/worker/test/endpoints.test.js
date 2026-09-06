import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker, { authorizeInternalRequest } from "../src/index.js";

const SIN = { APP_ENV: "test" };
const CON = { APP_ENV: "test", EVALUATE_TOKEN: "test-token" };
const req = (p, h = {}, i = {}) => new Request("https://guard.local" + p, { headers: h, ...i });
const st = (p, env, h, i) => worker.fetch(req(p, h, i), env, {}).then((r) => r.status);
const OK = { authorization: "Bearer test-token" };
const MAL = { authorization: "Bearer token-incorrecto" };
const POST = { method: "POST", body: "{}" };

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

test("invariante: una sola implementacion de autenticacion para /rules y /evaluate", () => {
  const src = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
  // El token solo se lee dentro del helper: ambas apariciones estan en su cuerpo y ninguna fuera.
  const helper = src.slice(src.indexOf("export function authorizeInternalRequest"), src.indexOf("function guard"));
  assert.equal((src.match(/EVALUATE_TOKEN/g) ?? []).length, 2);
  assert.equal((helper.match(/EVALUATE_TOKEN/g) ?? []).length, 2);
  assert.equal((src.match(/function authorizeInternalRequest/g) ?? []).length, 1);
  assert.equal((src.match(/guard\(request, env\)/g) ?? []).length, 3);
  assert.equal(authorizeInternalRequest(req("/rules"), SIN), null);
  assert.equal(authorizeInternalRequest(req("/rules", MAL), CON), false);
  assert.equal(authorizeInternalRequest(req("/rules", OK), CON), true);
});
