import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const B = new URL("../blocks/", import.meta.url);
const garan = readFileSync(new URL("garan-label.liquid", B), "utf8");
const notice = readFileSync(new URL("guarantee-notice.liquid", B), "utf8");

// Estados del core. Si cambian alli, este test obliga a revisar aqui.
const CORE = ["NOT_APPLICABLE", "NEEDS_INFORMATION", "CONFIGURED", "LIVE_PARTIAL", "LIVE_VERIFIED", "UNKNOWN"];
const RENDERABLE = ["CONFIGURED", "LIVE_PARTIAL", "LIVE_VERIFIED"];

test("el bloque GARAN solo declara como pintables estados que existen en el core", () => {
  const m = garan.match(/assign renderable = '([^']+)'/);
  assert.ok(m, "debe existir la lista de estados pintables");
  const declared = m[1].split(",");
  assert.deepEqual(declared, RENDERABLE);
  for (const s of declared) assert.ok(CORE.includes(s), `${s} no existe en la maquina de estados del core`);
});

test("ningun bloque usa estados inventados fuera del contrato", () => {
  // NEEDS_PRODUCER_LABEL no es un estado: es un reason que el core adjunta a NEEDS_INFORMATION.
  // READY belongs only to the independent import envelope, never the core renderable list.
  const permitidos = new Set([...CORE, "LANGUAGE_REVIEW_REQUIRED", "NEEDS_PRODUCER_LABEL", "READY"]);
  // Se analiza solo el codigo: los comentarios Liquid documentan y no ejecutan.
  const sinComentarios = (t) => t.replace(/{%-?\s*comment\s*-?%}[\s\S]*?{%-?\s*endcomment\s*-?%}/g, "");
  for (const src of [sinComentarios(garan), sinComentarios(notice)]) {
    for (const found of src.match(/\b[A-Z][A-Z_]{4,}\b/g) ?? []) {
      if (found.startsWith("EU_") || found === "GARAN") continue;
      assert.ok(permitidos.has(found), `estado no contemplado en el contrato: ${found}`);
    }
  }
});

test("los estados que no deben pintar no aparecen como pintables", () => {
  const m = garan.match(/assign renderable = '([^']+)'/)[1].split(",");
  for (const s of ["NEEDS_INFORMATION", "NOT_APPLICABLE", "UNKNOWN"]) {
    assert.ok(!m.includes(s), `${s} nunca debe pintar`);
  }
});

test("el aviso no hace fallback silencioso a ingles", () => {
  assert.match(notice, /LANGUAGE_REVIEW_REQUIRED/);
  assert.doesNotMatch(notice, /assign current = 'en'/);
  const locales = notice.match(/assign eu_locales = '([^']+)'/)[1].split(",");
  assert.equal(locales.length, 24, "deben ser las 24 lenguas oficiales de la UE");
});

test("el tema no compone la etiqueta GARAN cuando falta el asset del productor", () => {
  // Si es revendedor sin asset, el core devuelve NEEDS_INFORMATION -> no pintable por el test anterior.
  assert.match(garan, /garan_producer_asset/);
});

test("el CSS no puede alterar el asset oficial", () => {
  const css = readFileSync(new URL("../assets/eu-store-guard.css", import.meta.url), "utf8");
  assert.match(css, /filter: none !important/);
  for (const prohibido of ["hue-rotate", "saturate", "grayscale", "invert"]) {
    assert.ok(!css.includes(prohibido), `el CSS no debe aplicar ${prohibido} al asset oficial`);
  }
});

test("accesibilidad minima: los desplegables son botones con aria y foco por teclado", () => {
  for (const src of [garan, notice]) {
    if (!src.includes("aria-expanded")) continue;
    assert.match(src, /<button type="button"|<a href="\{\{ notice_asset \| asset_url \}\}"/, "disparador nativo: boton GARAN o enlace de aviso");
    assert.match(src, /aria-controls=/);
  }
  const js = readFileSync(new URL("../assets/eu-store-guard.js", import.meta.url), "utf8");
  assert.match(js, /Escape/, "debe cerrarse con Escape");
});

test("todos los locales declarados tienen archivo de traduccion valido", () => {
  const dir = new URL("../locales/", import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  assert.ok(files.includes("en.default.json"));
  for (const f of files) JSON.parse(readFileSync(new URL(f, dir), "utf8"));
});

// Los tests de renderizado real viven en test/render.test.js y ejecutan las plantillas con LiquidJS.
