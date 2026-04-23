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
};

export type OrganizerSalesRollup = {
  grossCents: number;
  feesCents: number;
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
    events.push({
      eventId,
      title: str(row.title, "Event"),
      slug: str(row.slug),
      status: str(row.status, "DRAFT"),
      startAt: str(row.startAt),
      currency: str(row.currency, "KES"),
      capacityTotal: num(row.capacityTotal),
      ticketsSold: num(row.ticketsSold),
      ordersCount: num(row.ordersCount),
      grossCents: num(row.grossCents),
      feesCents: num(row.feesCents),
    });
  }

  return {
    events,
    rollup: {
      grossCents: num(rollupRaw.grossCents),
      feesCents: num(rollupRaw.feesCents),
      ticketsSold: num(rollupRaw.ticketsSold),
      ordersCount: num(rollupRaw.ordersCount),
      currency: str(rollupRaw.currency, "KES"),
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
    orders.push({
      id,
      createdAt: str(row.createdAt),
      status: str(row.status),
      eventId: str(row.eventId),
      eventTitle: str(row.eventTitle, "Event"),
      buyerEmail: str(row.buyerEmail),
      buyerName: str(row.buyerName),
      amountCents: num(row.amountCents),
      feesCents: num(row.feesCents),
      currency: str(row.currency, "KES"),
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
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.length === 3 ? currency : "KES",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toFixed(0)} ${currency}`;
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
