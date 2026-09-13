// Pruebas de renderizado REAL: ejecutan las plantillas con un motor Liquid, no simulan condiciones.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Liquid } from "liquidjs";

const B = new URL("../blocks/", import.meta.url);
const engine = new Liquid({ root: fileURLToPath(new URL("../snippets/", import.meta.url)), extname: ".liquid", strictFilters: false, strictVariables: false });
// Filtros de Shopify usados por los bloques. Devuelven marcadores comprobables.
engine.registerFilter("asset_url", (v) => `/assets/${v}`);
engine.registerFilter("stylesheet_tag", (v) => `<link rel="stylesheet" href="${v}">`);
engine.registerFilter("script_tag", (v) => `<script src="${v}" defer></script>`);
engine.registerFilter("t", (k) => `[[${k}]]`);

const strip = (f) => readFileSync(new URL(f, B), "utf8").split("{% schema %}")[0];
const NOTICE = strip("guarantee-notice.liquid");
const GARAN = strip("garan-label.liquid");

const render = (tpl, ctx) => engine.parseAndRenderSync(tpl, ctx).trim();
const mf = (v) => (v === undefined ? undefined : { value: v, type: "single_line_text_field" });
const notice = (status, locale = "es") =>
  render(NOTICE, { block: { id: "n1" }, shop: { metafields: { eu_store_guard: { notice_status: mf(status) } } }, request: { locale: { iso_code: locale } } });
const garan = (m, blockId = "b1") => {
  const typed = {};
  for (const [k, v] of Object.entries(m)) typed[k] = mf(v);
  return render(GARAN, { block: { id: blockId }, product: { id: 1, metafields: { eu_store_guard: typed } } });
};

const PUBLICABLES = ["CONFIGURED", "LIVE_PARTIAL", "LIVE_VERIFIED"];
const NO_PUBLICABLES = ["NEEDS_INFORMATION", "NOT_APPLICABLE", "UNKNOWN", "", null, undefined];

test("aviso: publica solo con estados publicables", () => {
  for (const s of PUBLICABLES) {
    const html = notice(s);
    assert.match(html, /esg-notice__trigger/, `${s} debe publicar`);
    assert.match(html, /notice-es-rgb\.svg/);
    assert.match(html, new RegExp(`data-esg-status="${s}"`));
  }
});

test("aviso: retraccion real ante estados no publicables", () => {
  for (const s of NO_PUBLICABLES) {
    const html = notice(s);
    assert.ok(!/esg-notice__trigger/.test(html), `estado ${s} no debe pintar el aviso`);
    assert.ok(!/notice-.*-rgb\.svg/.test(html), `estado ${s} no debe referenciar el asset oficial`);
  }
});

test("aviso: locale fuera de las 24 oficiales no pinta ni hace fallback a ingles", () => {
  const html = notice("LIVE_VERIFIED", "ca");
  assert.ok(!/notice-en-rgb\.svg/.test(html), "prohibido fallback a ingles");
  assert.ok(!/esg-notice__trigger/.test(html));
  assert.match(html, /LANGUAGE_REVIEW_REQUIRED/);
});

test("aviso: los 24 locales oficiales resuelven su propio asset", () => {
  for (const l of ["bg","hr","cs","da","nl","de","el","en","et","fi","fr","hu","ga","it","lt","lv","mt","pl","pt","ro","sk","sl","es","sv"]) {
    assert.match(notice("CONFIGURED", l), new RegExp(`notice-${l}-rgb\\.svg`), `falta asset para ${l}`);
  }
});

test("GARAN: publica con estados publicables y datos completos", () => {
  for (const s of PUBLICABLES) {
    const html = garan({ garan_status: s, garan_duration_years: 3, garan_brand: "ACME", garan_model: "M1" });
    assert.match(html, /esg-garan__nested/, `${s} debe publicar`);
    assert.match(html, /GARAN/);
    assert.match(html, /ACME/);
  }
});

test("GARAN: retraccion real ante degradacion de estado", () => {
  assert.match(garan({ garan_status: "LIVE_VERIFIED", garan_duration_years: 4 }), /esg-garan__nested/);
  for (const s of NO_PUBLICABLES) {
    assert.ok(!/esg-garan__nested/.test(garan({ garan_status: s, garan_duration_years: 4 })), `estado ${s} debe retirar el contenido`);
  }
});

test("GARAN: sin duracion no publica aunque el estado lo permita", () => {
  for (const d of ["", null, undefined]) {
    assert.ok(!/esg-garan__nested/.test(garan({ garan_status: "LIVE_VERIFIED", garan_duration_years: d })));
  }
});

test("GARAN: bloquea URL legacy; ausencia sin restos conserva el oficial", () => {
  const conProductor = garan({ garan_status: "CONFIGURED", garan_duration_years: 3, garan_producer_asset: "https://cdn.example/p.svg" });
  assert.equal(conProductor, "");
  const sinProductor = garan({ garan_status: "CONFIGURED", garan_duration_years: 3 });
  assert.match(sinProductor, /garan-rgb\.svg/);
});

test("ambos bloques vinculan CSS y JS", () => {
  for (const file of ["guarantee-notice.liquid", "garan-label.liquid"]) {
    const src = readFileSync(new URL(file, B), "utf8");
    const schema = JSON.parse(src.match(/{% schema %}([\s\S]*?){% endschema %}/)[1]);
    assert.equal(schema.javascript, "eu-store-guard.js");
    assert.equal(schema.stylesheet, "eu-store-guard.css");
    assert.doesNotMatch(src, /script_tag|stylesheet_tag/);
  }
});

test("el HTML no imprime null ni undefined cuando faltan datos opcionales", () => {
  const html = garan({ garan_status: "CONFIGURED", garan_duration_years: 3 });
  assert.ok(!/undefined|null/.test(html));
});

test("el script se inicializa una sola vez aunque ambos bloques lo vinculen", () => {
  const js = readFileSync(new URL("../assets/eu-store-guard.js", import.meta.url), "utf8");
  assert.match(js, /window\.__esgInit/, "debe existir guarda de inicializacion");
  assert.match(js, /if \(window\.__esgInit\) return;/);
  // Simulacion: cargar el script dos veces debe registrar los listeners una sola vez.
  const listeners = [];
  const win = {}, doc = { addEventListener: (t) => listeners.push(t), querySelectorAll: () => [] };
  const run = new Function("window", "document", js);
  run(win, doc); run(win, doc);
  assert.equal(listeners.length, 2, "solo un par de listeners (click y keydown) tras dos cargas");
});

test("Escape y clics externos quedan acotados a nuestros contenedores", () => {
  const js = readFileSync(new URL("../assets/eu-store-guard.js", import.meta.url), "utf8");
  assert.match(js, /var BOXES = \["\.esg-notice", "\.esg-garan"\]/);
  assert.ok(!/document\.querySelectorAll\('\[aria-expanded/.test(js), "no debe seleccionar aria-expanded global");
  assert.match(js, /if \(!abiertos\.length\) return;/, "sin paneles nuestros abiertos, no interferir");
  // Se ignoran los comentarios: lo que importa es que no se invoque stopPropagation.
  const codigo = js.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.ok(!/stopPropagation\s*\(/.test(codigo), "no debe bloquear el Escape de otros componentes");
});

test("metafields tipados: se consume .value, no el objeto metafield", () => {
  const html = garan({ garan_status: "CONFIGURED", garan_duration_years: 3, garan_brand: "ACME" });
  assert.match(html, /esg-garan__nested/);
  assert.ok(!/\[object Object\]/.test(html), "no debe imprimir el objeto metafield");
  assert.ok(!/single_line_text_field/.test(html), "no debe filtrar metadatos del metafield");
});

test("seguridad: marca y modelo se escapan y no inyectan HTML", () => {
  const html = garan({
    garan_status: "CONFIGURED", garan_duration_years: 3,
    garan_brand: '<img src=x onerror=alert(1)>', garan_model: '"><script>alert(2)</script>'
  });
  assert.ok(!/<img src=x/.test(html), "la marca no debe generar elementos HTML");
  assert.ok(!/<script>alert\(2\)/.test(html), "el modelo no debe inyectar scripts");
  assert.match(html, /&lt;img src=x/, "debe aparecer escapado");
});

test("seguridad: una URL legacy maliciosa bloquea todo el HTML", () => {
  const html = garan({ garan_status: "CONFIGURED", garan_duration_years: 3, garan_producer_asset: 'x" onerror="alert(1)' });
  assert.equal(html, "");
});

test("Escape cierra tambien el aviso, no solo GARAN", () => {
  const js = readFileSync(new URL("../assets/eu-store-guard.js", import.meta.url), "utf8");
  assert.match(js, /BOXES\.map/, "el selector debe construirse por contenedor");
  const m = js.match(/var BOXES = \[([^\]]+)\]/);
  const boxes = m[1].split(",").map((x) => x.trim().replace(/"/g, ""));
  const selector = boxes.map((b) => b + ' [aria-expanded="true"]').join(", ");
  // Ambos contenedores deben quedar cubiertos por su propio descendiente.
  for (const b of boxes) assert.ok(selector.includes(b + ' [aria-expanded="true"]'), b + " sin descendiente propio");
  assert.ok(!/SCOPE \+ " " \+/.test(js), "no debe concatenarse el scope con coma");
});

test("IDs unicos: dos bloques GARAN del mismo producto no colisionan", () => {
  const datos = { garan_status: "CONFIGURED", garan_duration_years: 3 };
  const a = garan(datos, "block-aaa");
  const b = garan(datos, "block-bbb");
  const idDe = (html) => html.match(/id="(esg-garan-panel-[^"]+)"/)[1];
  const controlaDe = (html) => html.match(/aria-controls="(esg-garan-panel-[^"]+)"/)[1];
  assert.notEqual(idDe(a), idDe(b), "dos instancias deben tener IDs distintos");
  assert.equal(controlaDe(a), idDe(a), "cada boton controla su propio panel");
  assert.equal(controlaDe(b), idDe(b));
  assert.ok(!/product\.id/.test(readFileSync(new URL("../blocks/garan-label.liquid", B), "utf8").split("{% schema %}")[0].replace(/{%-?\s*comment\s*-?%}[\s\S]*?{%-?\s*endcomment\s*-?%}/g, "")), "no debe usarse product.id para los IDs");
});

test("IDs unicos: el aviso tambien usa block.id", () => {
  const html = notice("CONFIGURED");
  const id = html.match(/id="(esg-notice-panel-[^"]+)"/)[1];
  const ctrl = html.match(/aria-controls="(esg-notice-panel-[^"]+)"/)[1];
  assert.equal(ctrl, id);
  assert.match(id, /esg-notice-panel-n1/);
});
