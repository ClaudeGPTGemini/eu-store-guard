// EU Store Guard - Worker DEV.
import { loadRulesFromObjects, activeRules, evaluate } from "./core-bundle.js";
import { completeness, COMPLETENESS_DISCLAIMER } from "@eu-store-guard/core/completeness";
import { RULES, ACTIVATIONS } from "./rules-bundle.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const rules = loadRulesFromObjects(RULES);
const MAX_BODY_BYTES = 128 * 1024;

// UNICA implementacion de autenticacion interna. La usan /rules y /evaluate; no debe duplicarse.
// null = servicio sin configurar (falla cerrado); false = token ausente o incorrecto; true = valido.
export function authorizeInternalRequest(request, env) {
  if (!env?.EVALUATE_TOKEN) return null;
  return (request.headers.get("authorization") ?? "") === `Bearer ${env.EVALUATE_TOKEN}`;
}

function guard(request, env) {
  const auth = authorizeInternalRequest(request, env);
  if (auth === null) return json({ error: "service not configured" }, 503);
  if (!auth) return json({ error: "unauthorized" }, 401);
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Publico. Solo liveness: sin version del core, sin numero de reglas, sin entorno ni configuracion.
    if (url.pathname === "/health") return json({ ok: true });

    if (url.pathname === "/rules") {
      const denied = guard(request, env);
      if (denied) return denied;
      return json(activeRules(rules).map((r) => ({ rule_id: r.rule_id, level: r.level, effective_from: r.effective_from })));
    }

    if (url.pathname === "/evaluate" && request.method === "POST") {
      const denied = guard(request, env);
      if (denied) return denied;
      const declared = Number(request.headers.get("content-length") ?? 0);
      if (declared > MAX_BODY_BYTES) return json({ error: "payload too large" }, 413);
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: "payload too large" }, 413);
      let body; try { body = JSON.parse(raw); } catch { return json({ error: "JSON invalido" }, 400); }
      const results = activeRules(rules, body.on ? new Date(body.on) : new Date()).map((r) => {
        const out = evaluate(r, { ...body, activations: ACTIVATIONS });
        return { rule_id: r.rule_id, status: out.status, technical_status: out.technical_status, reasons: out.reasons, activation: out.activation };
      });
      return json({ results, completeness: completeness(results.map((r) => r.status)), disclaimer: COMPLETENESS_DISCLAIMER });
    }

    return json({ error: "not found" }, 404);
  },
  async scheduled(event, env, ctx) {
    // Verificacion diaria del storefront: vuelve con implementacion real en el hito de integracion Shopify.
    return;
  },
};
