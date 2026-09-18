import { assertAllowedStatus } from "./status.js";
import { createHash } from "node:crypto";
// "Configuration & verification history" — nunca "prueba de cumplimiento".
export function evidenceEntry({ storeId, marketCountry, locale, productId = null, ruleId, ruleVersion, ruleHash = null, presentation = null, status, technicalStatus = null, reasons = [], assetHash = null, activation = null, now = new Date() }) {
  // Snapshot de MarketActivation: permite reconstruir en el futuro qué estado nacional produjo el cap.
  const snap = activation ? { regime: activation.regime ?? null, status: activation.status, checked_at: activation.checked_at ?? null, national_source: activation.national_source ?? null, effective_from: activation.effective_from ?? null } : null;
  const snapHash = snap ? createHash("sha256").update(JSON.stringify(snap)).digest("hex") : null;
  return { at: now.toISOString(), store_id: storeId, market: marketCountry, locale, product_id: productId, rule_id: ruleId, rule_version: ruleVersion,
    rule_sha256: ruleHash, presentation,
    status: assertAllowedStatus(status), technical_status: technicalStatus ? assertAllowedStatus(technicalStatus) : null, reasons, asset_hash: assetHash,
    activation_status: snap?.status ?? null, activation_checked_at: snap?.checked_at ?? null, activation_national_source: snap?.national_source ?? null, activation_snapshot_hash: snapHash };
}
