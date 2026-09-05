// Regenera apps/worker/src/rules-bundle.js desde packages/core (Workers no tiene sistema de archivos).
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
const rules = readdirSync("packages/core/rules").filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(`packages/core/rules/${f}`, "utf8")));
const acts = {}; for (const f of readdirSync("packages/core/activations")) { const a = JSON.parse(readFileSync(`packages/core/activations/${f}`, "utf8")); acts[a.regime] = a; }
writeFileSync("apps/worker/src/rules-bundle.js", `// GENERADO por scripts/bundle-rules.mjs desde packages/core. No editar a mano.\nexport const RULES = ${JSON.stringify(rules)};\nexport const ACTIVATIONS = ${JSON.stringify(acts)};\n`);
console.log(`bundle-rules: ${rules.length} reglas, ${Object.keys(acts).length} regímenes`);
