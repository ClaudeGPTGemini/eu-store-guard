// Únicas funciones permitidas fuera del JSON: transformaciones deterministas que no encajan en el lenguaje de reglas.
export const EU_OFFICIAL_LOCALES = Object.freeze(["bg","hr","cs","da","nl","de","el","en","et","fi","fr","hu","ga","it","lt","lv","mt","pl","pt","ro","sk","sl","es","sv"]);
export const EU27 = Object.freeze(["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"]);

// locale → asset oficial. Sin fallback a inglés: catalán queda LANGUAGE_REVIEW_REQUIRED.
export function resolveNoticeAsset(ctx) {
  const country = String(ctx.market?.marketCountry ?? "").toUpperCase();
  if (!EU27.includes(country)) return { outcome: "NOT_IN_SCOPE_V1", asset: null, locale: null };
  const base = String(ctx.market?.storefrontLocale ?? "").toLowerCase().split(/[-_]/)[0];
  if (!EU_OFFICIAL_LOCALES.includes(base)) return { outcome: "LANGUAGE_REVIEW_REQUIRED", asset: null, locale: base };
  return { outcome: "RESOLVED", asset: `notice-${base}-rgb.svg`, locale: base };
}

// GARAN: > 2 años, entero o medio año. Sin redondeos.
export function isValidGaranDuration(d) {
  if (typeof d !== "number" || !Number.isFinite(d) || !(d > 2)) return false;
  const frac = Math.round((d - Math.floor(d)) * 1000) / 1000;
  return frac === 0 || frac === 0.5;
}

export function marketInEu27(ctx) { return EU27.includes(String(ctx.market?.marketCountry ?? "").toUpperCase()); }

export const TRANSFORMS = { resolveNoticeAsset, isValidGaranDuration, marketInEu27 };
