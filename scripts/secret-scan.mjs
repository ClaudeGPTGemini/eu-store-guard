// Escaneo de secretos: falla CI si detecta tokens, claves o URLs de base de datos en el repositorio.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
const PATTERNS = [
  [/shpss_[A-Za-z0-9]{20,}/, "Shopify API secret"],
  [/shpat_[A-Za-z0-9]{20,}/, "Shopify access token"],
  [/shpca_[A-Za-z0-9]{20,}/, "Shopify custom app token"],
  [/gh[pousr]_[A-Za-z0-9]{30,}/, "GitHub token"],
  [/postgres(ql)?:\/\/[^\s"']+:[^\s"']+@/, "Database URL with credentials"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "Private key"],
  [/AKIA[0-9A-Z]{16}/, "AWS access key"],
  [/(api[_-]?key|secret|token|password)\s*[:=]\s*["'][A-Za-z0-9_-]{16,}["']/i, "Hardcoded credential"],
];
const SKIP = new Set(["node_modules", ".git", "dist", ".wrangler"]);
let hits = 0;
function walk(dir) {
  for (const e of readdirSync(dir)) {
    if (SKIP.has(e)) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (p.endsWith("secret-scan.mjs") || /\.(png|jpg|svg|pdf|zip|lock)$/.test(p)) continue;
    const text = readFileSync(p, "utf8");
    for (const [re, label] of PATTERNS) if (re.test(text)) { console.error(`SECRET? ${label} en ${p}`); hits++; }
  }
}
walk(process.cwd());

// --history: escanea también el diff completo de todos los commits (todas las ramas).
// Cierra el hueco de un commit provisional con un token real que luego se elimina del árbol pero sigue en el historial.
if (process.argv.includes("--history")) {
  let log = "";
  try { log = execSync("git log -p --all --no-color --format=commit:%H", { encoding: "utf8", maxBuffer: 1024 * 1024 * 512 }); }
  catch { console.error("secret-scan --history: no es un repositorio git o falta historial (usar fetch-depth: 0)"); process.exit(1); }
  let commit = "?";
  for (const line of log.split("\n")) {
    if (line.startsWith("commit:")) { commit = line.slice(7, 19); continue; }
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    if (line.includes("secret-scan.mjs")) continue;
    for (const [re, label] of PATTERNS) if (re.test(line)) { console.error(`SECRET? ${label} en historial, commit ${commit}`); hits++; }
  }
}
if (hits) { console.error(`${hits} posible(s) secreto(s). CI bloqueado.`); process.exit(1); }
console.log(`secret-scan: limpio${process.argv.includes("--history") ? " (árbol + historial)" : ""}`);
