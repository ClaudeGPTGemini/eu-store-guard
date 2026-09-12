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

// --- Descompresion propia: misma ruta de codigo en Linux, macOS y Windows ---
import { unzip } from "../scripts/import-official-assets.mjs";
import { writeFileSync, readFileSync as rf, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import { mkdirSync, copyFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Construye un ZIP minimo valido con entradas deflate y stored, para no depender de binarios externos.
function zipDe(entradas) {
  const locales = [], central = [];
  let off = 0;
  for (const [nombre, contenido, metodo] of entradas) {
    const datos = Buffer.from(contenido);
    const cuerpo = metodo === 0 ? datos : deflateRawSync(datos);
    const n = Buffer.from(nombre, "utf8");
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(metodo, 8);
    lh.writeUInt32LE(cuerpo.length, 18); lh.writeUInt32LE(datos.length, 22); lh.writeUInt16LE(n.length, 26);
    locales.push(lh, n, cuerpo);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(metodo, 10);
    ch.writeUInt32LE(cuerpo.length, 20); ch.writeUInt32LE(datos.length, 24);
    ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(off, 42);
    central.push(ch, n);
    off += lh.length + n.length + cuerpo.length;
  }
  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entradas.length, 8); eocd.writeUInt16LE(entradas.length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(off, 16);
  return Buffer.concat([...locales, cd, eocd]);
}

test("importacion completa escribe manifiesto; check y drift detectan cambios sin sobrescribir", () => {
  const dir = mkdtempSync(join(tmpdir(), "esg-pipeline-"));
  assert.ok(dir.startsWith(join(tmpdir(), "esg-pipeline-")));
  try {
    mkdirSync(join(dir, "scripts"));
    for (const name of ["import-official-assets.mjs", "official-sources.json"])
      copyFileSync(new URL("../scripts/" + name, import.meta.url), join(dir, "scripts", name));
    writeFileSync(join(dir, "notice.zip"), zipDe(EU_LOCALES.map(l => [`notice_${l}_colour.svg`, `<svg>${l}</svg>`, 8])));
    writeFileSync(join(dir, "garan.zip"), zipDe([["GARAN_colour.svg", "<svg>full</svg>", 8], ["GARAN_nested.svg", "<svg>nested</svg>", 0]]));
    writeFileSync(join(dir, "offline.mjs"), `import {readFileSync} from 'node:fs'; globalThis.fetch=async url=>({ok:true,arrayBuffer:async()=>readFileSync(new URL(url.includes('27c45f1f')?'notice.zip':'garan.zip',import.meta.url))});`);
    const run = (...args) => spawnSync(process.execPath, ["--import", pathToFileURL(join(dir,"offline.mjs")).href, join(dir,"scripts/import-official-assets.mjs"), ...args], {encoding:"utf8"});
    const imported = run();
    assert.equal(imported.status, 0, imported.stderr);
    const manifest = rf(join(dir,"assets-manifest.json"));
    assert.equal(Object.keys(JSON.parse(manifest).assets).length, 26);
    assert.equal(run("--check").status, 0);
    assert.equal(run("--drift").status, 0);
    const original = rf(join(dir,"assets/garan-rgb.svg"));
    writeFileSync(join(dir,"garan.zip"), zipDe([["GARAN_colour.svg", "<svg>changed</svg>", 8], ["GARAN_nested.svg", "<svg>nested</svg>", 0]]));
    assert.equal(run("--drift").status, 1);
    assert.deepEqual(rf(join(dir,"assets/garan-rgb.svg")), original);
    assert.deepEqual(rf(join(dir,"assets-manifest.json")), manifest);
    writeFileSync(join(dir,"assets/garan-rgb.svg"), "corrupted");
    assert.equal(run("--check").status, 1);
  } finally { rmSync(dir, {recursive:true, force:true}); }
});

test("descompresion propia: deflate, stored, subcarpetas y filtrado de no-SVG", () => {
  const dir = mkdtempSync(join(tmpdir(), "esg-test-"));
  const zip = zipDe([
    ["pack/notice_es_colour.svg", "<svg id='es'/>".repeat(50), 8],
    ["pack/sub/GARAN_nested_colour.svg", "<svg id='nested'/>", 0],
    ["pack/readme.txt", "no es svg", 8],
    ["pack/", "", 0],
  ]);
  const out = unzip(zip, dir);
  const nombres = out.map((f) => f.split(/[\\/]/).pop()).sort();
  assert.deepEqual(nombres, ["GARAN_nested_colour.svg", "notice_es_colour.svg"], "solo SVG, rutas aplanadas");
  assert.equal(rf(out.find((f) => f.includes("es_colour")), "utf8"), "<svg id='es'/>".repeat(50), "deflate correcto");
  assert.equal(rf(out.find((f) => f.includes("nested")), "utf8"), "<svg id='nested'/>", "stored correcto");
  rmSync(dir, { recursive: true, force: true });
});

test("descompresion propia: un ZIP sin SVG falla en vez de continuar en silencio", () => {
  const dir = mkdtempSync(join(tmpdir(), "esg-test-"));
  assert.throws(() => unzip(zipDe([["a/readme.txt", "x", 8]]), dir), /no contiene ningun SVG/);
  rmSync(dir, { recursive: true, force: true });
});

test("no depende del binario unzip del sistema ni de rutas /tmp fijas", () => {
  const src = rf(new URL("../scripts/import-official-assets.mjs", import.meta.url), "utf8");
  assert.ok(!/execFileSync/.test(src), "no debe invocar binarios externos");
  assert.ok(!/`\/tmp\//.test(src), "no debe usar /tmp fijo");
  assert.match(src, /tmpdir\(\)/);
  assert.match(src, /inflateRawSync/);
});

test("el bloque GARAN usa el asset anidado oficial, no una insignia textual", () => {
  const src = rf(new URL("../blocks/garan-label.liquid", import.meta.url), "utf8");
  assert.match(src, /garan-nested-rgb\.svg/, "debe referenciar el asset anidado oficial");
  assert.ok(!/esg-garan__badge">GARAN</.test(src), "la insignia textual ya no debe usarse");
  assert.match(src, /garan_producer_nested_asset/, "el asset anidado del productor tiene prioridad");
});

test("modo --drift documentado y separado de la importacion", () => {
  const src = rf(new URL("../scripts/import-official-assets.mjs", import.meta.url), "utf8");
  assert.match(src, /--drift/, "debe existir el modo drift");
  assert.match(src, /NUNCA escribe en assets\//, "drift no debe sobrescribir lo versionado");
  // Un unico punto de escritura de assets, en la importacion aprobada.
  assert.equal((src.match(/writeFileSync\(new URL\(nombre, ASSETS\)/g) ?? []).length, 1);
});

test("la CI de cada commit verifica lo versionado sin descargar", () => {
  const wf = rf(new URL("../../../.github/workflows/theme-extension.yml", import.meta.url), "utf8");
  assert.match(wf, /assets:check/);
  assert.ok(!/assets:import/.test(wf), "la CI de cada commit no debe reimportar");
  const drift = rf(new URL("../../../.github/workflows/assets-drift.yml", import.meta.url), "utf8");
  assert.match(drift, /schedule/, "la comprobacion de deriva es periodica");
  assert.match(drift, /--drift/);
});
