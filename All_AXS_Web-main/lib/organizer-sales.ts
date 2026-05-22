import {
  normalizeCurrencyCode,
  PLATFORM_DEFAULT_CURRENCY,
} from "@/lib/currency";

/** Shapes returned by `GET /organizers/sales/summary` (proxied as `/api/organizer/sales/summary`). */

export type OrganizerSalesEventRow = {
  eventId: string;
  title: string;
  slug: string;
  status: string;
  startAt: string;
  currency: string;
  capacityTotal: number;
  ticketsSold: number;
  ordersCount: number;
  grossCents: number;
  feesCents: number;
  netCents: number;
};

export type OrganizerSalesRollup = {
  grossCents: number;
  feesCents: number;
  netCents: number;
  ticketsSold: number;
  ordersCount: number;
  currency: string;
};

export type OrganizerSalesSummaryPayload = {
  events: OrganizerSalesEventRow[];
  rollup: OrganizerSalesRollup;
};

export type OrganizerSalesOrderRow = {
  id: string;
  createdAt: string;
  status: string;
  eventId: string;
  eventTitle: string;
  buyerEmail: string;
  buyerName: string;
  amountCents: number;
  feesCents: number;
  netCents: number;
  currency: string;
  ticketsInOrder: number;
  lineSummary: string;
};

export type OrganizerSalesOrdersPayload = {
  orders: OrganizerSalesOrderRow[];
  total: number;
  limit: number;
  offset: number;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export function normalizeOrganizerSalesSummary(
  data: unknown,
): OrganizerSalesSummaryPayload | null {
  if (!isRecord(data)) return null;
  const rollupRaw = data.rollup;
  if (!isRecord(rollupRaw)) return null;
  const eventsRaw = data.events;
  if (!Array.isArray(eventsRaw)) return null;

  const events: OrganizerSalesEventRow[] = [];
  for (const row of eventsRaw) {
    if (!isRecord(row)) continue;
    const eventId = str(row.eventId);
    if (!eventId) continue;
    const grossCents = num(row.grossCents);
    const feesCents = num(row.feesCents);
    events.push({
      eventId,
      title: str(row.title, "Event"),
      slug: str(row.slug),
      status: str(row.status, "DRAFT"),
      startAt: str(row.startAt),
      currency: normalizeCurrencyCode(str(row.currency) || undefined),
      capacityTotal: num(row.capacityTotal),
      ticketsSold: num(row.ticketsSold),
      ordersCount: num(row.ordersCount),
      grossCents,
      feesCents,
      netCents: num(row.netCents, Math.max(0, grossCents - feesCents)),
    });
  }

  return {
    events,
    rollup: {
      grossCents: num(rollupRaw.grossCents),
      feesCents: num(rollupRaw.feesCents),
      netCents: num(
        rollupRaw.netCents,
        Math.max(0, num(rollupRaw.grossCents) - num(rollupRaw.feesCents)),
      ),
      ticketsSold: num(rollupRaw.ticketsSold),
      ordersCount: num(rollupRaw.ordersCount),
      currency: normalizeCurrencyCode(str(rollupRaw.currency) || undefined),
    },
  };
}

export function normalizeOrganizerSalesOrders(
  data: unknown,
): OrganizerSalesOrdersPayload | null {
  if (!isRecord(data)) return null;
  const ordersRaw = data.orders;
  if (!Array.isArray(ordersRaw)) return null;
  const orders: OrganizerSalesOrderRow[] = [];
  for (const row of ordersRaw) {
    if (!isRecord(row)) continue;
    const id = str(row.id);
    if (!id) continue;
    const amountCents = num(row.amountCents);
    const feesCents = num(row.feesCents);
    orders.push({
      id,
      createdAt: str(row.createdAt),
      status: str(row.status),
      eventId: str(row.eventId),
      eventTitle: str(row.eventTitle, "Event"),
      buyerEmail: str(row.buyerEmail),
      buyerName: str(row.buyerName),
      amountCents,
      feesCents,
      netCents: num(row.netCents, Math.max(0, amountCents - feesCents)),
      currency: normalizeCurrencyCode(str(row.currency) || undefined),
      ticketsInOrder: num(row.ticketsInOrder),
      lineSummary: str(row.lineSummary, "—"),
    });
  }
  return {
    orders,
    total: num(data.total),
    limit: num(data.limit, 25),
    offset: num(data.offset),
  };
}

export function formatMoneyFromCents(cents: number, currency: string): string {
  const amount = cents / 100;
  const code = normalizeCurrencyCode(currency);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toFixed(0)} ${code || PLATFORM_DEFAULT_CURRENCY}`;
  }
}

export function formatShortDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  const match = /filename="([^"]+)"/i.exec(header);
  return match?.[1] ?? null;
}

/** Download paid ticket holders for one event as CSV (via Next proxy). */
export async function downloadOrganizerAttendeesCsv(eventId: string): Promise<void> {
  const res = await fetch(
    `/api/organizer/sales/events/${encodeURIComponent(eventId)}/attendees/export`,
  );
  if (!res.ok) {
    let message = `Export failed (${res.status})`;
    try {
      const data = (await res.json()) as { message?: string };
      if (data.message) message = data.message;
    } catch {
      // non-JSON error body
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const filename =
    parseContentDispositionFilename(res.headers.get("content-disposition")) ??
    `attendees-${eventId}.csv`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
