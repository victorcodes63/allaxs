const TICKETS_LIST_KEY = "allaxs-offline-tickets-v1";
const TICKET_DETAIL_PREFIX = "allaxs-offline-ticket:";
const NOTIFICATIONS_KEY = "allaxs-offline-notifications-v1";

type CachedEnvelope<T> = { savedAt: number; data: T };

function readEnvelope<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEnvelope<T>;
    if (!parsed || typeof parsed !== "object" || parsed.data === undefined) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeEnvelope<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const envelope: CachedEnvelope<T> = { savedAt: Date.now(), data };
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    /* quota or private mode */
  }
}

export function cacheTicketsList(data: unknown): void {
  writeEnvelope(TICKETS_LIST_KEY, data);
}

export function readCachedTicketsList(): unknown | null {
  return readEnvelope(TICKETS_LIST_KEY);
}

export function cacheTicketDetail(ticketId: string, data: unknown): void {
  if (!ticketId.trim()) return;
  writeEnvelope(`${TICKET_DETAIL_PREFIX}${ticketId.trim()}`, data);
}

export function readCachedTicketDetail(ticketId: string): unknown | null {
  if (!ticketId.trim()) return null;
  return readEnvelope(`${TICKET_DETAIL_PREFIX}${ticketId.trim()}`);
}

export function cacheNotificationsList(data: unknown): void {
  writeEnvelope(NOTIFICATIONS_KEY, data);
}

export function readCachedNotificationsList(): unknown | null {
  return readEnvelope(NOTIFICATIONS_KEY);
}
