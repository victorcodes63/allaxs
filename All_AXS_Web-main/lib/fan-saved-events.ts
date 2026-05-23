const STORAGE_PREFIX = "allaxs-fan-saved-events-";

function storageKey(userKey: string): string {
  return `${STORAGE_PREFIX}${userKey.trim().toLowerCase()}`;
}

function readSlugs(userKey: string): string[] {
  if (typeof window === "undefined" || !userKey.trim()) return [];
  try {
    const raw = localStorage.getItem(storageKey(userKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
  } catch {
    return [];
  }
}

function writeSlugs(userKey: string, slugs: string[]): void {
  if (typeof window === "undefined" || !userKey.trim()) return;
  try {
    localStorage.setItem(storageKey(userKey), JSON.stringify(slugs));
  } catch {
    /* quota / private mode */
  }
}

export function getSavedSlugs(userKey: string): string[] {
  return readSlugs(userKey);
}

export function isSaved(userKey: string, slug: string): boolean {
  const normalized = slug.trim();
  if (!normalized) return false;
  return readSlugs(userKey).includes(normalized);
}

/** Toggle saved state; returns true when the event is saved after the toggle. */
export function toggleSaved(userKey: string, slug: string): boolean {
  const normalized = slug.trim();
  if (!normalized || !userKey.trim()) return false;
  const current = readSlugs(userKey);
  const exists = current.includes(normalized);
  const next = exists
    ? current.filter((s) => s !== normalized)
    : [...current, normalized];
  writeSlugs(userKey, next);
  return !exists;
}
