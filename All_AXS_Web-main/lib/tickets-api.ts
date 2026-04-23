import type { StoredTicket } from "@/lib/checkout-storage";

type UnknownRecord = Record<string, unknown>;

function pickString(obj: UnknownRecord, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return "";
}

function readNestedEvent(obj: UnknownRecord): {
  slug: string;
  title: string;
  id: string;
  startAt: string;
  endAt: string;
  venue: string;
  city: string;
  country: string;
} {
  const ev = obj.event;
  if (!ev || typeof ev !== "object") {
    return { slug: "", title: "", id: "", startAt: "", endAt: "", venue: "", city: "", country: "" };
  }
  const e = ev as UnknownRecord;
  return {
    slug: pickString(e, ["slug", "eventSlug", "event_slug"]),
    title: pickString(e, ["title", "eventTitle", "event_title", "name"]),
    id: pickString(e, ["id", "eventId", "event_id"]),
    startAt: pickString(e, ["startAt", "start_at", "startsAt", "starts_at", "date"]),
    endAt: pickString(e, ["endAt", "end_at", "endsAt", "ends_at"]),
    venue: pickString(e, ["venue", "locationName", "location_name"]),
    city: pickString(e, ["city"]),
    country: pickString(e, ["country"]),
  };
}

function readTierName(obj: UnknownRecord): string {
  const direct = pickString(obj, ["tierName", "tier_name", "ticketTypeName", "ticket_type_name"]);
  if (direct) return direct;
  const tt = obj.ticketType ?? obj.ticket_type;
  if (tt && typeof tt === "object") {
    const name = pickString(tt as UnknownRecord, ["name", "title", "label"]);
    if (name) return name;
  }
  return "";
}

/**
 * Maps backend ticket DTOs (camelCase or snake_case, optional nested event / ticketType) to StoredTicket.
 */
export function normalizeApiTicket(raw: unknown): StoredTicket | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as UnknownRecord;
  const id = pickString(o, ["id"]);
  if (!id) return null;

  const nested = readNestedEvent(o);
  const eventSlug =
    pickString(o, ["eventSlug", "event_slug"]) || nested.slug || pickString(o, ["slug"]);
  const eventTitle = pickString(o, ["eventTitle", "event_title"]) || nested.title;
  const eventId = pickString(o, ["eventId", "event_id"]) || nested.id;
  const eventStartAt =
    pickString(o, ["eventStartAt", "event_start_at", "startAt", "start_at"]) || nested.startAt;
  const eventEndAt = pickString(o, ["eventEndAt", "event_end_at", "endAt", "end_at"]) || nested.endAt;
  const eventVenue = pickString(o, ["eventVenue", "event_venue", "venue"]) || nested.venue;
  const eventCity = pickString(o, ["eventCity", "event_city", "city"]) || nested.city;
  const eventCountry =
    pickString(o, ["eventCountry", "event_country", "country"]) || nested.country;

  const tierName = readTierName(o);
  const issuedAt = pickString(o, [
    "issuedAt",
    "issued_at",
    "createdAt",
    "created_at",
    "issuedAtIso",
  ]);
  const currency = pickString(o, ["currency"]) || "KES";
  const qrNonce = pickString(o, ["qrNonce", "qr_nonce"]);
  const qrSignature = pickString(o, ["qrSignature", "qr_signature"]);

  const base: StoredTicket = {
    id,
    orderId: pickString(o, ["orderId", "order_id"]),
    eventSlug,
    eventTitle: eventTitle || (tierName ? `${tierName} pass` : "Your pass"),
    tierName: tierName || "Ticket",
    attendeeEmail: pickString(o, ["attendeeEmail", "attendee_email", "buyerEmail", "buyer_email"]),
    issuedAt: issuedAt || new Date().toISOString(),
    currency,
    ...(qrNonce ? { qrNonce } : {}),
    ...(qrSignature ? { qrSignature } : {}),
  };

  if (eventId) base.eventId = eventId;
  if (eventStartAt) base.eventStartAt = eventStartAt;
  if (eventEndAt) base.eventEndAt = eventEndAt;
  if (eventVenue) base.eventVenue = eventVenue;
  if (eventCity) base.eventCity = eventCity;
  if (eventCountry) base.eventCountry = eventCountry;

  return base;
}

export function normalizeApiTicketsPayload(body: unknown): StoredTicket[] {
  if (Array.isArray(body)) {
    return body.map(normalizeApiTicket).filter((t): t is StoredTicket => t !== null);
  }
  if (!body || typeof body !== "object") return [];
  const o = body as UnknownRecord;
  const raw = o.tickets ?? o.data ?? o.items;
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeApiTicket).filter((t): t is StoredTicket => t !== null);
}

export function normalizeApiTicketPayload(body: unknown): StoredTicket | null {
  if (!body || typeof body !== "object") return null;
  const o = body as UnknownRecord;
  const inner = o.ticket ?? o.data ?? o;
  return normalizeApiTicket(inner);
}

export function mergeTicketsById(preferred: StoredTicket[], fallback: StoredTicket[]): StoredTicket[] {
  const map = new Map<string, StoredTicket>();
  for (const t of fallback) map.set(t.id, t);
  for (const t of preferred) map.set(t.id, t);
  return [...map.values()].sort(
    (a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime()
  );
}
