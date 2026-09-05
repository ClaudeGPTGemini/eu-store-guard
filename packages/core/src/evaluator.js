// Intérprete declarativo de tres valores. true / false / null (unknown).
// Expresiones: {"all":[..]} {"any":[..]} {"not":e} {"eq":[a,b]} {"gt":[a,b]} {"present":a} {"in":[a,[..]]} {"fn":"name","arg":a} {"has":[a,b]}
// Un string que empieza por "$" es una ruta en el contexto: "$input.duration_years".
import { STATUS } from "./status.js";
import { TRANSFORMS } from "./transforms/index.js";

export function get(ctx, path) {
  return String(path).slice(1).split(".").reduce((o, k) => (o == null ? undefined : o[k]), ctx);
}
// Los valores literales "UNKNOWN"/"unknown" en el contexto se tratan como desconocidos (tercer valor).
function val(ctx, x) { const v = typeof x === "string" && x.startsWith("$") ? get(ctx, x) : x; return v === "UNKNOWN" || v === "unknown" ? undefined : v; }
const unknown = (v) => v === undefined || v === null;

export function evalExpr(expr, ctx) {
  if (typeof expr === "boolean") return expr;
  const [op] = Object.keys(expr);
  const a = expr[op];
  switch (op) {
    case "all": { let u = false; for (const e of a) { const r = evalExpr(e, ctx); if (r === false) return false; if (r === null) u = true; } return u ? null : true; }
    case "any": { let u = false; for (const e of a) { const r = evalExpr(e, ctx); if (r === true) return true; if (r === null) u = true; } return u ? null : false; }
    case "not": { const r = evalExpr(a, ctx); return r === null ? null : !r; }
    case "present": { const v = val(ctx, a); return unknown(v) || v === "" ? false : true; }
    // Propagación simétrica: cualquier operando desconocido → unknown. Contenedor conocido con tipo inválido → error de definición.
    case "eq": { const [x, y] = a.map((t) => val(ctx, t)); return unknown(x) || unknown(y) ? null : x === y; }
    case "gt": { const [x, y] = a.map((t) => val(ctx, t)); return unknown(x) || unknown(y) ? null : x > y; }
    case "in": { const [x, list] = [val(ctx, a[0]), val(ctx, a[1])]; if (unknown(x) || unknown(list)) return null; if (!Array.isArray(list)) throw new Error("in: la lista debe ser un array"); return list.includes(x); }
    case "has": { const [set, item] = [val(ctx, a[0]), val(ctx, a[1])]; if (unknown(set) || unknown(item)) return null; if (typeof set?.[Symbol.iterator] !== "function") throw new Error("has: el conjunto debe ser iterable"); return Array.from(set).includes(item); }
    case "fn": { const f = TRANSFORMS[a]; if (!f) throw new Error(`transform desconocida: ${a}`); const v = val(ctx, expr.arg); return expr.arg !== undefined && unknown(v) ? null : !!f(expr.arg !== undefined ? v : ctx); }
    default: throw new Error(`operador desconocido: ${op}`);
  }
}

const RANK = { NEEDS_INFORMATION: 0, CONFIGURED: 1, LIVE_PARTIAL: 2, LIVE_VERIFIED: 3 };
function cap(status, max) { return RANK[status] > RANK[max] ? max : status; }

// Pipeline: derive → gates → required → checks → verification → caps
export function evaluateRule(rule, ctx) {
  const ev = rule.evaluation ?? {};
  ctx = { ...ctx, derived: {} };
  for (const [k, spec] of Object.entries(ev.derive ?? {})) ctx.derived[k] = TRANSFORMS[spec.fn](ctx);

  // gates: false → on_false (inmediato); unknown → se acumula y termina en on_unknown
  const unknowns = [];
  for (const g of ev.gates ?? []) {
    const r = evalExpr(g.check, ctx);
    if (r === false) return done(g.on_false ?? STATUS.NOT_APPLICABLE, [g.reason ?? "gate_failed"]);
    if (r === null) unknowns.push({ status: g.on_unknown ?? STATUS.NEEDS_INFORMATION, reason: (g.reason ?? "gate") + "=unknown" });
  }
  if (unknowns.length) {
    const st = unknowns.some((u) => u.status === STATUS.UNKNOWN) ? STATUS.UNKNOWN : STATUS.NEEDS_INFORMATION;
    return done(st, unknowns.map((u) => u.reason));
  }

  // required: campos obligatorios; requires_if condicional (unknown → NEEDS_INFORMATION)
  const missing = [];
  for (const r of ev.required ?? []) {
    if (typeof r === "string") { if (!evalExpr({ present: r }, ctx)) missing.push(`${r.slice(1)}_missing`); continue; }
    let cond = evalExpr(r.requires_if, ctx);
    if (cond === null && r.unknown_as_false) cond = false; // condición dependiente de otro campo ya exigido: ausente = no aplica
    if (cond === null) { missing.push(r.unknown_reason ?? "condition_unknown"); continue; }
    if (cond === true) for (const f of r.fields) if (!evalExpr({ present: f }, ctx)) missing.push(r.reason ?? `${f.slice(1)}_missing`);
  }
  if (missing.length) return done(STATUS.NEEDS_INFORMATION, [...new Set(missing)]);

  // checks de configuración: cualquier fallo → CONFIGURED con motivos (o el estado indicado)
  const failed = [];
  let worst = null;
  for (const c of ev.checks ?? []) if (evalExpr(c.check, ctx) !== true) { failed.push(c.reason); if (c.on_fail === STATUS.NEEDS_INFORMATION) worst = STATUS.NEEDS_INFORMATION; }
  if (failed.length) return done(worst ?? STATUS.CONFIGURED, failed);

  // verificación: sin evidencia pública → CONFIGURED
  const v = ev.verification;
  let status = STATUS.CONFIGURED, reasons = [];
  if (v && ctx.verification) {
    const vf = (v.checks ?? []).filter((p) => get(ctx, p) !== true).map((p) => `verify_${p.split(".").pop()}_failed`);
    if (vf.length) return done(STATUS.CONFIGURED, vf);
    const verified = new Set(get(ctx, v.surfaces_verified ?? "$verification.surfacesVerified") ?? []);
    const all = (v.surfaces ?? []).every((s) => verified.has(s));
    status = all ? STATUS.LIVE_VERIFIED : STATUS.LIVE_PARTIAL;
    if (!all) reasons.push("surfaces_pending");
  }
  // caps: si la condición no es verdadera, el estado no puede superar max
  for (const c of ev.caps ?? []) if (evalExpr(c.unless, ctx) !== true) { const capped = cap(status, c.max); if (capped !== status) { status = capped; reasons.push(c.reason); } else if (RANK[status] >= RANK[c.max]) reasons.push(c.reason); }
  return done(status, [...new Set(reasons)]);

  function done(status, reasons) { return { status, reasons, derived: ctx.derived }; }
}
