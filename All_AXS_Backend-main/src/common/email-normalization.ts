/**
 * Canonical email for uniqueness checks — collapses Gmail dot/plus aliases
 * and normalizes googlemail.com → gmail.com.
 */
export function canonicalizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return trimmed;

  let local = trimmed.slice(0, at);
  let domain = trimmed.slice(at + 1);

  if (domain === 'googlemail.com') {
    domain = 'gmail.com';
  }

  if (domain === 'gmail.com') {
    local = local.split('+')[0].replace(/\./g, '');
    return `${local}@${domain}`;
  }

  local = local.split('+')[0];
  return `${local}@${domain}`;
}

/** Count dots in the local part (Gmail alias abuse signal). */
export function gmailLocalPartDotCount(email: string): number {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0) return 0;
  const domain = trimmed.slice(at + 1);
  if (domain !== 'gmail.com' && domain !== 'googlemail.com') return 0;
  const local = trimmed.slice(0, at);
  return local.length - local.replace(/\./g, '').length;
}
