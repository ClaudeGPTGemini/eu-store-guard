// Importa los archivos oficiales de la Comision Europea y genera el manifiesto de trazabilidad.
//
// Se ejecuta en CI (GitHub Actions), donde hay salida a internet. No modifica los archivos:
// los copia tal cual, calcula su SHA-256 y los renombra al esquema que consumen los bloques Liquid.
//
//   node scripts/import-official-assets.mjs            # descarga, verifica y escribe assets/
//   node scripts/import-official-assets.mjs --check    # solo verifica que lo que hay coincide con el manifiesto
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ROOT = new URL("../", import.meta.url);
const ASSETS = new URL("assets/", ROOT);
const SRC = JSON.parse(readFileSync(new URL("official-sources.json", import.meta.url), "utf8"));
const MANIFEST = new URL("assets-manifest.json", ROOT);

const EU_LOCALES = ["bg","hr","cs","da","nl","de","el","en","et","fi","fr","hu","ga","it","lt","lv","mt","pl","pt","ro","sk","sl","es","sv"];
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

// El nombre de archivo dentro del ZIP oficial identifica el idioma. Se acepta cualquier separador.
function localeOf(name) {
  const base = name.split("/").pop().toLowerCase();
  for (const l of EU_LOCALES) if (new RegExp(`(^|[^a-z])${l}([^a-z]|$)`).test(base)) return l;
  return null;
}
// Solo color: la version en blanco y negro es exclusiva de tienda fisica.
const isColour = (n) => !/(^|[^a-z])(bw|black|blackandwhite|b_w|nb)([^a-z]|$)/i.test(n);

async function download(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`descarga fallida ${res.status}: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function unzip(buf, dest) {
  mkdirSync(dest, { recursive: true });
  const tmp = `${dest}/_pkg.zip`;
  writeFileSync(tmp, buf);
  execFileSync("unzip", ["-o", "-q", tmp, "-d", dest]);
  return walk(dest).filter((f) => f.toLowerCase().endsWith(".svg"));
}
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
}

async function main() {
  const check = process.argv.includes("--check");
  if (check) {
    if (!existsSync(MANIFEST)) { console.error("assets-manifest.json no existe: ejecutar la importacion"); process.exit(1); }
    const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
    let fallos = 0;
    for (const [file, meta] of Object.entries(m.assets)) {
      const p = new URL(file, ASSETS);
      if (!existsSync(p)) { console.error(`falta ${file}`); fallos++; continue; }
      const actual = sha256(readFileSync(p));
      if (actual !== meta.sha256) { console.error(`huella distinta en ${file}`); fallos++; }
    }
    const faltan = EU_LOCALES.filter((l) => !m.assets[`notice-${l}-rgb.svg`]);
    if (faltan.length) { console.error("locales sin asset:", faltan.join(", ")); fallos++; }
    if (!m.assets["garan-rgb.svg"]) { console.error("falta garan-rgb.svg"); fallos++; }
    if (fallos) process.exit(1);
    console.log(`assets:check ok (${Object.keys(m.assets).length} archivos oficiales verificados)`);
    return;
  }

  mkdirSync(ASSETS, { recursive: true });
  const manifest = { imported_at: new Date().toISOString(), source: SRC.page, legal_basis: SRC.legal_basis, assets: {} };

  for (const pkg of SRC.packages) {
    if (pkg.ship === false) continue;
    console.log(`descargando ${pkg.id}...`);
    const svgs = unzip(await download(pkg.url), `/tmp/esg-${pkg.id}`);
    if (pkg.id === "notice_svg") {
      for (const l of EU_LOCALES) {
        const hit = svgs.filter(isColour).find((f) => localeOf(f) === l);
        if (!hit) throw new Error(`el paquete oficial no contiene el aviso en color para: ${l}`);
        const buf = readFileSync(hit);
        const name = `${pkg.target_prefix}${l}${pkg.target_suffix}`;
        writeFileSync(new URL(name, ASSETS), buf);
        manifest.assets[name] = { sha256: sha256(buf), bytes: buf.length, source_file: hit.split("/").pop(), package: pkg.id };
      }
    } else {
      const hit = svgs.filter(isColour).find((f) => /garan/i.test(f)) ?? svgs.filter(isColour)[0];
      if (!hit) throw new Error("el paquete GARAN no contiene SVG en color");
      const buf = readFileSync(hit);
      writeFileSync(new URL(pkg.target, ASSETS), buf);
      manifest.assets[pkg.target] = { sha256: sha256(buf), bytes: buf.length, source_file: hit.split("/").pop(), package: pkg.id };
    }
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`importados ${Object.keys(manifest.assets).length} archivos oficiales; manifiesto escrito`);
}
main().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
