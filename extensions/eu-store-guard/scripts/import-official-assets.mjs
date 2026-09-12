// Importa los archivos oficiales de la Comision Europea y genera el manifiesto de trazabilidad.
//
// Se ejecuta en CI (GitHub Actions), donde hay salida a internet. No modifica los archivos:
// los copia tal cual, calcula su SHA-256 y los renombra al esquema que consumen los bloques Liquid.
//
//   node scripts/import-official-assets.mjs            # importacion inicial o actualizacion aprobada
//   node scripts/import-official-assets.mjs --check    # verifica lo versionado, sin red (CI de cada commit)
//   node scripts/import-official-assets.mjs --drift    # descarga y compara con lo versionado, sin sobrescribir
import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const ROOT = new URL("../", import.meta.url);
const ASSETS = new URL("assets/", ROOT);
const SRC = JSON.parse(readFileSync(new URL("official-sources.json", import.meta.url), "utf8"));
const MANIFEST = new URL("assets-manifest.json", ROOT);

export const EU_LOCALES = ["bg","hr","cs","da","nl","de","el","en","et","fi","fr","hu","ga","it","lt","lv","mt","pl","pt","ro","sk","sl","es","sv"];
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

// El nombre de archivo dentro del ZIP oficial identifica el idioma. Se acepta cualquier separador.
export function localeOf(name) {
  const base = name.split("/").pop().toLowerCase();
  for (const l of EU_LOCALES) if (new RegExp(`(^|[^a-z])${l}([^a-z]|$)`).test(base)) return l;
  return null;
}
// Solo color: la version en blanco y negro es exclusiva de tienda fisica.
export const isColour = (n) => !/(^|[^a-z])(bw|black|blackandwhite|b_w|nb)([^a-z]|$)/i.test(n);

async function download(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`descarga fallida ${res.status}: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// Descompresion propia del formato ZIP (deflate + stored), sin depender del binario `unzip`
// del sistema: Windows no lo trae y el CI de Linux si. Misma ruta de codigo en ambos.
export function unzip(buf, dest) {
  // Directorio limpio en cada ejecucion: un SVG de una importacion anterior podria ocultar
  // que el paquete nuevo ya no lo trae, dando un falso positivo.
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });

  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("ZIP invalido: no se encuentra el directorio central");
  const total = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const salida = [];

  for (let i = 0; i < total; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error("ZIP invalido: entrada corrupta");
    const metodo = buf.readUInt16LE(off + 10);
    const comprimido = buf.readUInt32LE(off + 20);
    const nombreLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const comentarioLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const nombre = buf.toString("utf8", off + 46, off + 46 + nombreLen);
    off += 46 + nombreLen + extraLen + comentarioLen;
    if (nombre.endsWith("/")) continue;
    if (!nombre.toLowerCase().endsWith(".svg")) continue;

    const lnLen = buf.readUInt16LE(localOff + 26);
    const leLen = buf.readUInt16LE(localOff + 28);
    const inicio = localOff + 30 + lnLen + leLen;
    const crudo = buf.subarray(inicio, inicio + comprimido);
    const datos = metodo === 0 ? crudo : inflateRawSync(crudo);

    // Se aplana la ruta: el nombre del archivo es lo que identifica idioma y variante.
    const destino = join(dest, nombre.split("/").pop());
    writeFileSync(destino, datos);
    salida.push(destino);
  }
  if (!salida.length) throw new Error("el paquete no contiene ningun SVG");
  return salida;
}
export function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
}

// Seleccion de variante, extraida para poder probarla sin red.
export function selectVariant(files, variant) {
  const c = files.filter(isColour).filter((f) => {
    const n = f.split("/").pop().toLowerCase();
    return variant.match.every((m) => n.includes(m)) && !variant.exclude.some((x) => n.includes(x));
  });
  if (c.length === 0) throw new Error(`sin candidatos para la variante ${variant.id}`);
  if (c.length > 1) throw new Error(`variante ${variant.id} ambigua: ${c.length} candidatos`);
  return c[0];
}

async function main() {
  const check = process.argv.includes("--check");
  const drift = process.argv.includes("--drift");

  // --drift: compara la fuente oficial con lo versionado. NUNCA escribe en assets/.
  if (drift) {
    if (!existsSync(MANIFEST)) { console.error("no hay manifiesto versionado con el que comparar"); process.exit(1); }
    const m = JSON.parse(readFileSync(MANIFEST, "utf8"));
    const vivo = await recolectar();
    const cambios = [];
    for (const [nombre, meta] of Object.entries(m.assets)) {
      if (!vivo[nombre]) { cambios.push(`${nombre}: ya no esta en la fuente oficial`); continue; }
      if (vivo[nombre].sha256 !== meta.sha256) cambios.push(`${nombre}: la Comision publico una version distinta`);
    }
    for (const nombre of Object.keys(vivo)) if (!m.assets[nombre]) cambios.push(`${nombre}: nuevo archivo en la fuente oficial`);
    if (cambios.length) {
      console.error("::error::La fuente oficial difiere de lo versionado. Debe entrar por PR revisado, nunca automaticamente.");
      for (const c of cambios) console.error(" - " + c);
      process.exit(1);
    }
    console.log(`assets:drift ok (${Object.keys(m.assets).length} archivos identicos a la fuente oficial)`);
    return;
  }

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
    for (const req of ["garan-rgb.svg", "garan-nested-rgb.svg"]) if (!m.assets[req]) { console.error(`falta ${req}`); fallos++; }
    if (fallos) process.exit(1);
    console.log(`assets:check ok (${Object.keys(m.assets).length} archivos oficiales verificados)`);
    return;
  }

  mkdirSync(ASSETS, { recursive: true });
  const recogidos = await recolectar();
  const manifest = { imported_at: new Date().toISOString(), source: SRC.page, legal_basis: SRC.legal_basis, assets: {} };
  for (const [nombre, info] of Object.entries(recogidos)) {
    writeFileSync(new URL(nombre, ASSETS), info.buf);
    manifest.assets[nombre] = { sha256: info.sha256, bytes: info.buf.length, source_file: info.source_file, package: info.package, ...(info.variant ? { variant: info.variant } : {}) };
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`importados ${Object.keys(manifest.assets).length} archivos oficiales; manifiesto escrito`);
}

// Descarga los paquetes oficiales y devuelve el mapa nombre -> { buf, sha256, ... } sin escribir en assets/.
export async function recolectar() {
  const out = {};
  for (const pkg of SRC.packages) {
    if (pkg.ship === false) continue;
    console.log(`descargando ${pkg.id}...`);
    // tmpdir() en vez de /tmp fijo: valido en Linux, macOS y Windows.
    const svgs = unzip(await download(pkg.url), join(tmpdir(), `esg-${pkg.id}-${process.pid}-${Date.now()}`));
    if (pkg.id === "notice_svg") {
      for (const l of EU_LOCALES) {
        const hit = svgs.filter(isColour).find((f) => localeOf(f) === l);
        if (!hit) throw new Error(`el paquete oficial no contiene el aviso en color para: ${l}`);
        const buf = readFileSync(hit);
        const name = `${pkg.target_prefix}${l}${pkg.target_suffix}`;
        out[name] = { buf, sha256: sha256(buf), source_file: hit.split(/[\\/]/).pop(), package: pkg.id };
      }
    } else {
      // Seleccion explicita por variante: el paquete trae la etiqueta completa y la anidada.
      // Elegir "la primera" seria azar; cada variante declara sus patrones y exclusiones.
      for (const v of pkg.variants) {
        const candidatos = svgs.filter(isColour).filter((f) => {
          const n = f.split("/").pop().toLowerCase();
          return v.match.every((m) => n.includes(m)) && !v.exclude.some((x) => n.includes(x));
        });
        if (candidatos.length === 0) throw new Error(`el paquete GARAN no contiene la variante ${v.id} en color`);
        if (candidatos.length > 1) throw new Error(`variante ${v.id} ambigua: ${candidatos.length} candidatos (${candidatos.map((c) => c.split("/").pop()).join(", ")})`);
        const buf = readFileSync(candidatos[0]);
        out[v.target] = { buf, sha256: sha256(buf), source_file: candidatos[0].split(/[\\/]/).pop(), package: pkg.id, variant: v.id };
      }
    }
  }
  return out;
}
// Solo se ejecuta como script, no al importarlo desde los tests.
if (process.argv[1] && process.argv[1].endsWith("import-official-assets.mjs")) {
  main().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
}
