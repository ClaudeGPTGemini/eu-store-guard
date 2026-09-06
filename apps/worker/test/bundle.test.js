import { test } from "node:test";
import assert from "node:assert/strict";
import { readSources, digest, canonical } from "../../../scripts/bundle-lib.mjs";
import { RULES, ACTIVATIONS } from "../src/rules-bundle.js";

const src = readSources();
const clone = (o) => JSON.parse(JSON.stringify(o));

test("bundle:check - el bundle coincide en contenido con las fuentes del core", () => {
  assert.equal(digest(src.rules, src.activations), digest(RULES, ACTIVATIONS));
});

test("el digest no depende del orden de lectura ni del formato", () => {
  const shuffled = [...src.rules].reverse();
  assert.equal(digest(shuffled, src.activations), digest(src.rules, src.activations));
  assert.equal(canonical({ b: 1, a: 2 }), canonical({ a: 2, b: 1 }));
});

// MUTATION TEST 1: cambia el contenido interno de una Rule SIN tocar rule_id.
// Si el digest no lo detectara, una regla podria divergir en silencio entre core y Worker.
test("mutation: cambiar una condicion interna de una Rule (mismo rule_id) rompe bundle:check", () => {
  const mutated = clone(src.rules);
  const garan = mutated.find((r) => r.requirement === "EU_GARAN");
  const idAntes = garan.rule_id;
  garan.evaluation.gates[0].on_false = "NEEDS_INFORMATION"; // era NOT_APPLICABLE
  assert.equal(garan.rule_id, idAntes, "la mutacion no debe cambiar el rule_id");
  assert.notEqual(digest(mutated, src.activations), digest(RULES, ACTIVATIONS));

  const otra = clone(src.rules);
  otra.find((r) => r.requirement === "EU_LEGAL_GUARANTEE_NOTICE").effective_from = "2027-01-01";
  assert.notEqual(digest(otra, src.activations), digest(RULES, ACTIVATIONS));

  const fuente = clone(src.rules);
  fuente[0].sources = [...(fuente[0].sources ?? []), "fuente inventada"];
  assert.notEqual(digest(fuente, src.activations), digest(RULES, ACTIVATIONS));
});

// MUTATION TEST 2: cambia una MarketActivation sin regenerar el bundle.
test("mutation: cambiar una MarketActivation rompe bundle:check", () => {
  const st = clone(src.activations);
  st.EMPCO_2024_825.markets.ES.status = "VERIFIED_ACTIVE"; // era NOT_NOTIFIED
  assert.notEqual(digest(src.rules, st), digest(RULES, ACTIVATIONS));

  const fecha = clone(src.activations);
  fecha.EMPCO_2024_825.markets.ES.checked_at = "2027-01-01";
  assert.notEqual(digest(src.rules, fecha), digest(RULES, ACTIVATIONS));

  const fuente = clone(src.activations);
  fuente.EMPCO_2024_825.markets.ES.national_source = "BOE inventado";
  assert.notEqual(digest(src.rules, fuente), digest(RULES, ACTIVATIONS));

  const nuevo = clone(src.activations);
  nuevo.EMPCO_2024_825.markets.DE = { status: "VERIFIED_ACTIVE", checked_at: "2026-09-06" };
  assert.notEqual(digest(src.rules, nuevo), digest(RULES, ACTIVATIONS));
});
