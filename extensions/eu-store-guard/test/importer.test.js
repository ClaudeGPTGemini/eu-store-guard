// Pruebas del importador de assets oficiales. No requieren red: ejercitan la seleccion
// contra listados de archivos reproducidos del paquete oficial.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { localeOf, isColour, selectVariant, EU_LOCALES } from "../scripts/import-official-assets.mjs";

const SRC = JSON.parse(readFileSync(new URL("../scripts/official-sources.json", import.meta.url), "utf8"));
const garanPkg = SRC.packages.find((p) => p.id === "garan_label");

// Listado representativo del paquete GARAN oficial.
const GARAN_FILES = [
  "GARAN label for website/GARAN_label_colour.svg",
  "GARAN label for website/GARAN_label_black_and_white.svg",
  "GARAN label for website/GARAN_nested_colour.svg",
  "GARAN label for website/GARAN_nested_bw.svg",
];

test("selecciona la variante GARAN completa, no la anidada", () => {
  const full = garanPkg.variants.find((v) => v.id === "full");
  const hit = selectVariant(GARAN_FILES, full);
  assert.match(hit, /GARAN_label_colour\.svg$/);
  assert.ok(!/nested/i.test(hit), "no debe elegir la anidada");
});

test("selecciona la variante anidada por separado", () => {
  const nested = garanPkg.variants.find((v) => v.id === "nested");
  const hit = selectVariant(GARAN_FILES, nested);
  assert.match(hit, /GARAN_nested_colour\.svg$/);
});

test("la ambiguedad falla de forma ruidosa en vez de elegir al azar", () => {
  const full = garanPkg.variants.find((v) => v.id === "full");
  assert.throws(() => selectVariant(["a/garan_one_colour.svg", "a/garan_two_colour.svg"], full), /ambigua/);
});

test("la ausencia de una variante falla en vez de continuar", () => {
  const nested = garanPkg.variants.find((v) => v.id === "nested");
  assert.throws(() => selectVariant(["a/GARAN_label_colour.svg"], nested), /sin candidatos/);
});

test("descarta las versiones en blanco y negro: solo son validas en tienda fisica", () => {
  assert.equal(isColour("GARAN_label_black_and_white.svg"), false);
  assert.equal(isColour("GARAN_nested_bw.svg"), false);
  assert.equal(isColour("notice_es_bw.svg"), false);
  assert.equal(isColour("GARAN_label_colour.svg"), true);
  assert.equal(isColour("notice_es_colour.svg"), true);
});

test("identifica el idioma de cada aviso sin confundir locales que se solapan", () => {
  assert.equal(localeOf("notice_es_colour.svg"), "es");
  assert.equal(localeOf("Notice-DE-colour.svg"), "de");
  assert.equal(localeOf("aviso_pt_color.svg"), "pt");
  assert.equal(localeOf("notice_sl_colour.svg"), "sl");
  assert.equal(localeOf("readme.txt"), null);
});

test("se cubren las 24 lenguas oficiales de la UE", () => {
  assert.equal(EU_LOCALES.length, 24);
  assert.equal(new Set(EU_LOCALES).size, 24, "sin duplicados");
  for (const l of ["es", "de", "ga", "mt", "sv", "bg"]) assert.ok(EU_LOCALES.includes(l));
});

test("las fuentes declaradas apuntan a dominios oficiales de la Comision", () => {
  for (const p of SRC.packages) assert.match(p.url, /^https:\/\/commission\.europa\.eu\//, `${p.id} no apunta a la Comision`);
  assert.equal(SRC.legal_basis, "Commission Implementing Regulation (EU) 2025/1960");
});

test("el importador declara ambas variantes GARAN con destinos distintos", () => {
  const targets = garanPkg.variants.map((v) => v.target);
  assert.deepEqual(targets, ["garan-rgb.svg", "garan-nested-rgb.svg"]);
  assert.equal(new Set(targets).size, 2);
});

test("los temporales se recrean en cada ejecucion", () => {
  const src = readFileSync(new URL("../scripts/import-official-assets.mjs", import.meta.url), "utf8");
  assert.match(src, /rmSync\(dest, \{ recursive: true, force: true \}\)/, "debe limpiar el directorio destino");
  assert.match(src, /process\.pid.*Date\.now\(\)/, "cada ejecucion usa un directorio propio");
});
