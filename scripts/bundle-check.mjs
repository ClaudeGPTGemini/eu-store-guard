// Gate de CI: el bundle del Worker debe ser identico en contenido a las fuentes de packages/core.
import { readSources, digest } from "./bundle-lib.mjs";
const { rules, activations } = readSources();
const bundle = await import("../apps/worker/src/rules-bundle.js");
const expected = digest(rules, activations);
const actual = digest(bundle.RULES, bundle.ACTIVATIONS);
if (expected !== actual) {
  console.error(`bundle:check FALLO\n  fuentes: ${expected}\n  bundle:  ${actual}\nEjecutar: node scripts/bundle-rules.mjs`);
  process.exit(1);
}
console.log(`bundle:check ok (${expected.slice(0, 16)}...)`);
