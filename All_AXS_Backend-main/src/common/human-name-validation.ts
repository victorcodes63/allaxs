/**
 * Reject bot-style display names: long single tokens with random mixed case
 * and few vowels (e.g. `csLoLMKZjjCcpVGNOf`).
 */
export function isPlausibleHumanName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 100) return false;

  if (/\s/.test(trimmed)) return true;

  if (!/^[A-Za-z\u00C0-\u024F'-]+$/.test(trimmed)) {
    return trimmed.length <= 40;
  }

  if (trimmed.length < 12) return true;

  let caseTransitions = 0;
  for (let i = 1; i < trimmed.length; i++) {
    const prevUpper = trimmed[i - 1] >= 'A' && trimmed[i - 1] <= 'Z';
    const currUpper = trimmed[i] >= 'A' && trimmed[i] <= 'Z';
    if (prevUpper !== currUpper) caseTransitions++;
  }

  const vowels = (trimmed.match(/[aeiouAEIOU\u00E0-\u00FC]/g) || []).length;
  const vowelRatio = vowels / trimmed.length;

  if (caseTransitions >= 4 && vowelRatio < 0.25) return false;
  if (trimmed.length >= 15 && vowelRatio < 0.12) return false;

  return true;
}

/** Heuristic for admin bot cleanup — matches screenshot patterns. */
export function looksLikeBotDisplayName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  return !isPlausibleHumanName(name.trim());
}
