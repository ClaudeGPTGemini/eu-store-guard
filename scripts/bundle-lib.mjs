// Huella semantica del bundle: depende del CONTENIDO completo de Rules y MarketActivations,
// no del nombre de archivo, del orden, del formato ni del numero de elementos.
import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const ROOT = new URL("../packages/core/", import.meta.url);

// Serializacion canonica: claves ordenadas recursivamente. Dos objetos equivalentes dan la misma cadena;
// cualquier cambio de valor, condicion, fecha o fuente cambia la cadena.
export function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  return JSON.stringify(v === undefined ? null : v);
}

export function readSources() {
  const rules = readdirSync(new URL("rules/", ROOT)).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(new URL(`rules/${f}`, ROOT), "utf8")));
  const activations = {};
  for (const f of readdirSync(new URL("activations/", ROOT)).filter((f) => f.endsWith(".json"))) { const a = JSON.parse(readFileSync(new URL(`activations/${f}`, ROOT), "utf8")); activations[a.regime] = a; }
  return { rules, activations };
}

// Ordena las reglas por rule_id solo para que el orden de lectura del directorio no afecte al hash.
// El contenido de cada regla entra entero.
export function digest(rules, activations) {
  const sortedRules = [...rules].sort((a, b) => String(a.rule_id).localeCompare(String(b.rule_id)));
  return createHash("sha256").update(canonical({ rules: sortedRules, activations })).digest("hex");
}

export function renderBundle(rules, activations) {
  return `// GENERADO por scripts/bundle-rules.mjs desde packages/core. No editar a mano.\nexport const RULES = ${JSON.stringify(rules)};\nexport const ACTIVATIONS = ${JSON.stringify(activations)};\n`;
}
