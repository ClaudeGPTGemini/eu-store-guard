import { readFileSync, readdirSync } from "node:fs";
// MarketActivation: una misma obligación europea con estado regulatorio versionado por país.
// Solo aplica a reglas con market_activation.required (regímenes derivados de Directiva).
export const ACTIVATION = Object.freeze({ VERIFIED_ACTIVE: "VERIFIED_ACTIVE", VERIFIED_NOT_YET_ACTIVE: "VERIFIED_NOT_YET_ACTIVE", NOT_NOTIFIED: "NOT_NOTIFIED", UNKNOWN: "UNKNOWN" });
export function loadActivations(dir = new URL("../activations/", import.meta.url)) {
  const out = {};
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) { const a = JSON.parse(readFileSync(new URL(f, dir), "utf8")); out[a.regime] = a; }
  return out;
}
export function activationFor(activations, regime, country) {
  const reg = activations?.[regime];
  if (!reg) return { regime, status: ACTIVATION.UNKNOWN, national_source: null, effective_from: null, checked_at: null };
  const m = reg.markets?.[String(country ?? "").toUpperCase()];
  // Sin comprobación individual del mercado no hay checked_at: el default UNKNOWN no hereda la fecha del régimen.
  if (!m) return { regime, status: reg.default_status ?? ACTIVATION.UNKNOWN, national_source: null, effective_from: null, checked_at: null };
  return { regime, status: m.status ?? ACTIVATION.UNKNOWN, national_source: m.national_source ?? null, effective_from: m.effective_from ?? null, checked_at: m.checked_at ?? null };
}
