// Máquina de estados oficial. Prohibido añadir COMPLIANT/NON_COMPLIANT/LEGAL/ILLEGAL.
export const STATUS = Object.freeze({
  NOT_APPLICABLE: "NOT_APPLICABLE",
  NEEDS_INFORMATION: "NEEDS_INFORMATION",
  CONFIGURED: "CONFIGURED",
  LIVE_VERIFIED: "LIVE_VERIFIED",
  LIVE_PARTIAL: "LIVE_PARTIAL",
  UNKNOWN: "UNKNOWN",
});
export const FORBIDDEN_WORDS = ["COMPLIANT", "NON_COMPLIANT", "LEGAL", "ILLEGAL", "READINESS"];
export function assertAllowedStatus(s) {
  if (!Object.values(STATUS).includes(s)) throw new Error(`Estado no permitido: ${s}`);
  return s;
}
