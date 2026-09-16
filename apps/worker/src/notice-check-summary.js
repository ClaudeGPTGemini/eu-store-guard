// Only expose a bounded historical summary, never raw theme files or API errors.
export function checkSummary(check, now = new Date()) {
  if (!check || check.scope !== 'admin-theme-revision' || typeof check.checkedAt !== 'string') return null;
  const time = new Date(check.checkedAt);
  if (!Number.isFinite(time.getTime()) || time.toISOString() !== check.checkedAt || time > now) return null;
  return { checkedAt: check.checkedAt, unchanged: check.reason === 'reviewed_revision_unchanged' };
}
