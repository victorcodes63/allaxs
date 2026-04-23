/** Shapes from `GET /organizers/tickets` (proxied as `/api/organizer/tickets`). */

export type OrganizerTicketRow = {
  id: string;
  status: string;
  issuedAt: string;
  eventId: string;
  eventTitle: string;
  eventSlug: string;
  orderId: string;
  orderStatus: string;
  tierId: string;
  tierName: string;
  currency: string;
  attendeeEmail: string;
  attendeeName: string;
  attendeePhone: string;
  buyerEmail: string;
};

export type OrganizerTicketsPayload = {
  tickets: OrganizerTicketRow[];
  total: number;
  limit: number;
  offset: number;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

export function normalizeOrganizerTickets(data: unknown): OrganizerTicketsPayload | null {
  if (!isRecord(data)) return null;
  const raw = data.tickets;
  if (!Array.isArray(raw)) return null;
  const tickets: OrganizerTicketRow[] = [];
  for (const row of raw) {
    if (!isRecord(row)) continue;
    const id = str(row.id);
    if (!id) continue;
    tickets.push({
      id,
      status: str(row.status, "ISSUED"),
      issuedAt: str(row.issuedAt),
      eventId: str(row.eventId),
      eventTitle: str(row.eventTitle, "Event"),
      eventSlug: str(row.eventSlug),
      orderId: str(row.orderId),
      orderStatus: str(row.orderStatus),
      tierId: str(row.tierId),
      tierName: str(row.tierName, "Ticket"),
      currency: str(row.currency, "KES"),
      attendeeEmail: str(row.attendeeEmail),
      attendeeName: str(row.attendeeName),
      attendeePhone: str(row.attendeePhone),
      buyerEmail: str(row.buyerEmail),
    });
  }
  return {
    tickets,
    total: num(data.total),
    limit: num(data.limit, 25),
    offset: num(data.offset),
  };
}

export function organizerTicketStatusChipClass(status: string): string {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide";
  switch (status) {
    case "CHECKED_IN":
      return `${base} bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/25`;
    case "VOID":
      return `${base} bg-rose-500/12 text-rose-200 ring-1 ring-rose-500/20`;
    case "ISSUED":
    default:
      return `${base} bg-surface text-muted ring-1 ring-border`;
  }
}
