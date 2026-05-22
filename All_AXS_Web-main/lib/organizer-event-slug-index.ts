import { normalizeOrganizerEventsListPayload } from "@/lib/organizer-events-list";

export type OrganizerEventSlugIndex = Record<string, string>;

type CachedIndex = {
  fetchedAt: number;
  index: OrganizerEventSlugIndex;
};

let cached: CachedIndex | null = null;
let fetchInFlight: Promise<OrganizerEventSlugIndex> | null = null;

const DEFAULT_TTL_MS = 300_000;

function buildIndex(rows: Array<{ id?: string; slug?: string }>): OrganizerEventSlugIndex {
  const index: OrganizerEventSlugIndex = {};
  for (const row of rows) {
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const slug = typeof row.slug === "string" ? row.slug.trim() : "";
    if (!id || !slug) continue;
    index[slug] = id;
  }
  return index;
}

/**
 * Slug → event id map for the signed-in organizer (GET /api/events).
 * Used to rewrite public `/e/{slug}` notification links into hub edit routes.
 */
export async function loadOrganizerEventSlugIndex(options?: {
  force?: boolean;
}): Promise<OrganizerEventSlugIndex> {
  const force = options?.force ?? false;
  const now = Date.now();

  if (!force && cached && now - cached.fetchedAt < DEFAULT_TTL_MS) {
    return cached.index;
  }

  if (!force && fetchInFlight) {
    return fetchInFlight;
  }

  fetchInFlight = (async () => {
    try {
      const res = await fetch("/api/events", {
        method: "GET",
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => ({}))) as unknown;
      if (!res.ok) {
        return cached?.index ?? {};
      }
      const rows = normalizeOrganizerEventsListPayload<{ id?: string; slug?: string }>(
        data,
      );
      const index = buildIndex(rows);
      cached = { fetchedAt: Date.now(), index };
      return index;
    } catch {
      return cached?.index ?? {};
    } finally {
      fetchInFlight = null;
    }
  })();

  return fetchInFlight;
}
