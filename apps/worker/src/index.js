// EU Store Guard — Worker DEV. Fase actual: núcleo expuesto vía HTTP para pruebas; OAuth y Shopify llegan en el siguiente hito.
import { loadRulesFromObjects, activeRules, evaluate } from "./core-bundle.js";
import { completeness, COMPLETENESS_DISCLAIMER } from "@eu-store-guard/core/completeness";
import { RULES, ACTIVATIONS } from "./rules-bundle.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const rules = loadRulesFromObjects(RULES);
const MAX_BODY_BYTES = 128 * 1024;

function authorized(request, env) {
  if (!env?.EVALUATE_TOKEN) return null;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${env.EVALUATE_TOKEN}`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return json({ ok: true, env: env?.APP_ENV ?? "unknown", rules: rules.length, core: "0.2.1" });
    if (url.pathname === "/rules") return json(activeRules(rules).map((r) => ({ rule_id: r.rule_id, level: r.level, effective_from: r.effective_from })));
    if (url.pathname === "/evaluate" && request.method === "POST") {
      const auth = authorized(request, env);
      if (auth === null) return json({ error: "service not configured" }, 503);
      if (!auth) return json({ error: "unauthorized" }, 401);
      const declared = Number(request.headers.get("content-length") ?? 0);
      if (declared > MAX_BODY_BYTES) return json({ error: "payload too large" }, 413);
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: "payload too large" }, 413);
      let body; try { body = JSON.parse(raw); } catch { return json({ error: "JSON inválido" }, 400); }
      const results = activeRules(rules, body.on ? new Date(body.on) : new Date()).map((r) => {
        const out = evaluate(r, { ...body, activations: ACTIVATIONS });
        return { rule_id: r.rule_id, status: out.status, technical_status: out.technical_status, reasons: out.reasons, activation: out.activation };
      });
      return json({ results, completeness: completeness(results.map((r) => r.status)), disclaimer: COMPLETENESS_DISCLAIMER });
    }
    return json({ error: "not found" }, 404);
  },
  async scheduled(event, env, ctx) {
    // Hito siguiente: verificación diaria de storefronts (asset hash, DOM, locale, enlace) → Evidence Log.
    return;
  },
};
