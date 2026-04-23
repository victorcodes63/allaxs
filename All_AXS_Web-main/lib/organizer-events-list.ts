/**
 * Coerces one list row: Nest may emit snake_case; banner may be `banner_url`.
 */
function coerceListRow<T extends Record<string, unknown>>(row: T): T {
  const banner =
    (row.bannerUrl as string | null | undefined) ??
    (row.banner_url as string | null | undefined) ??
    null;
  const startAt =
    (row.startAt as string | undefined) ??
    (row.startsAt as string | undefined) ??
    (row.start_at as string | undefined);
  const endAt =
    (row.endAt as string | undefined) ??
    (row.endsAt as string | undefined) ??
    (row.end_at as string | undefined);
  const title = (row.title as string | undefined) ?? (row.name as string | undefined);
  const status = (row.status as string | undefined) ?? (row.event_status as string | undefined);
  const venue = (row.venue as string | undefined) ?? (row.venue_name as string | undefined);
  const slug = (row.slug as string | undefined) ?? (row.event_slug as string | undefined);
  const id = (row.id as string | undefined) ?? (row.event_id as string | undefined);
  const type =
    (row.type as string | undefined) ??
    (row.event_type as string | undefined) ??
    "IN_PERSON";
  return {
    ...row,
    bannerUrl: banner,
    ...(startAt !== undefined ? { startAt } : {}),
    ...(endAt !== undefined ? { endAt } : {}),
    ...(title !== undefined ? { title } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(venue !== undefined ? { venue } : {}),
    ...(slug !== undefined ? { slug } : {}),
    ...(id !== undefined ? { id } : {}),
    ...(type !== undefined ? { type } : {}),
  } as T;
}

/**
 * Normalizes organizer event list payloads from the backend.
 * Supports a plain array or common paginated / wrapper shapes so
 * `/organizer/events` stays accurate regardless of minor API contract drift.
 */
export function normalizeOrganizerEventsListPayload<T>(data: unknown): T[] {
  let raw: unknown[] = [];
  if (Array.isArray(data)) {
    raw = data;
  } else if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.events)) raw = o.events;
    else if (Array.isArray(o.content)) raw = o.content;
    else if (Array.isArray(o.data)) raw = o.data;
    else if (Array.isArray(o.items)) raw = o.items;
  }
  return raw.map((row) =>
    row && typeof row === "object"
      ? (coerceListRow(row as Record<string, unknown>) as T)
      : (row as T),
  );
}
