import { STATUS } from "./status.js";
export const COMPLETENESS_DISCLAIMER = "Measures information configured and detected by EU Store Guard. It is not a legal compliance assessment.";
// Excluye NOT_APPLICABLE del denominador. UNKNOWN cuenta como no completo.
export function completeness(statuses) {
  const relevant = statuses.filter((s) => s !== STATUS.NOT_APPLICABLE);
  const label = "Product information completeness";
  if (!relevant.length) return { percent: null, label, disclaimer: COMPLETENESS_DISCLAIMER };
  const weight = { LIVE_VERIFIED: 1, LIVE_PARTIAL: 0.75, CONFIGURED: 0.5, NEEDS_INFORMATION: 0, UNKNOWN: 0 };
  const sum = relevant.reduce((a, s) => a + (weight[s] ?? 0), 0);
  return { percent: Math.round((sum / relevant.length) * 100), label, disclaimer: COMPLETENESS_DISCLAIMER };
}
