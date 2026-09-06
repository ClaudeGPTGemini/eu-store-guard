// Regenera apps/worker/src/rules-bundle.js desde packages/core (Workers no tiene sistema de archivos).
import { writeFileSync } from "node:fs";
import { readSources, renderBundle, digest } from "./bundle-lib.mjs";
const { rules, activations } = readSources();
writeFileSync(new URL("../apps/worker/src/rules-bundle.js", import.meta.url), renderBundle(rules, activations));
console.log(`bundle-rules: ${rules.length} reglas, ${Object.keys(activations).length} regimenes, digest ${digest(rules, activations).slice(0, 16)}...`);
