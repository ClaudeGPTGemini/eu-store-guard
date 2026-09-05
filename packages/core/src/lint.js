// Validación de reglas en carga. Un JSON inválido no entra en el motor.
export const RESERVED_SENTINELS = ["UNKNOWN", "unknown"];
const OPS = new Set(["all", "any", "not", "eq", "gt", "present", "in", "has", "fn"]);

function walkExpr(expr, ruleId, path) {
  if (typeof expr === "boolean") return;
  const keys = Object.keys(expr).filter((k) => k !== "arg");
  if (keys.length !== 1 || !OPS.has(keys[0])) throw new Error(`${ruleId}: expresión inválida en ${path}`);
  const op = keys[0], a = expr[op];
  const lit = (v) => { if (typeof v === "string" && !v.startsWith("$") && RESERVED_SENTINELS.includes(v)) throw new Error(`${ruleId}: literal reservado "${v}" en ${path}`); if (Array.isArray(v)) v.forEach(lit); };
  if (op === "all" || op === "any") a.forEach((e, i) => walkExpr(e, ruleId, `${path}.${op}[${i}]`));
  else if (op === "not") walkExpr(a, ruleId, `${path}.not`);
  else if (op === "eq" || op === "gt" || op === "in" || op === "has") a.forEach(lit);
}

export function validateRule(rule) {
  const id = rule.rule_id ?? "(sin id)";
  const ev = rule.evaluation ?? {};
  for (const [i, g] of (ev.gates ?? []).entries()) walkExpr(g.check, id, `gates[${i}]`);
  for (const [i, c] of (ev.checks ?? []).entries()) walkExpr(c.check, id, `checks[${i}]`);
  for (const [i, c] of (ev.caps ?? []).entries()) walkExpr(c.unless, id, `caps[${i}]`);
  const exigidos = new Set();
  for (const [i, r] of (ev.required ?? []).entries()) {
    if (typeof r === "string") { exigidos.add(r); continue; }
    walkExpr(r.requires_if, id, `required[${i}].requires_if`);
    if (r.unknown_as_false) {
      if (!r.depends_on) throw new Error(`${id}: required[${i}] usa unknown_as_false sin depends_on`);
      if (!exigidos.has(r.depends_on)) throw new Error(`${id}: required[${i}] depends_on ${r.depends_on} no exigido previamente`);
      if (!JSON.stringify(r.requires_if).includes(`"${r.depends_on}"`)) throw new Error(`${id}: required[${i}] depends_on ${r.depends_on} no aparece en su requires_if`);
    }
    (r.fields ?? []).forEach((f) => exigidos.add(f));
  }
  return rule;
}
