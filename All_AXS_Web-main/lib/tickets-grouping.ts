import type { StoredTicket } from "@/lib/checkout-storage";

export type TicketTimeBucket = "upcoming" | "past" | "unknown";

export function ticketTimeBucket(ticket: StoredTicket, now = Date.now()): TicketTimeBucket {
  const endIso = ticket.eventEndAt ?? ticket.eventStartAt;
  const startIso = ticket.eventStartAt;
  const compareIso = endIso ?? startIso;
  if (!compareIso) return "unknown";
  const t = new Date(compareIso).getTime();
  if (!Number.isFinite(t)) return "unknown";
  return t >= now ? "upcoming" : "past";
}

export function splitTicketsByTime(tickets: StoredTicket[], now = Date.now()) {
  const upcoming: StoredTicket[] = [];
  const past: StoredTicket[] = [];
  const unknown: StoredTicket[] = [];

  for (const ticket of tickets) {
    const bucket = ticketTimeBucket(ticket, now);
    if (bucket === "upcoming") upcoming.push(ticket);
    else if (bucket === "past") past.push(ticket);
    else unknown.push(ticket);
  }

  const byStart = (a: StoredTicket, b: StoredTicket) => {
    const ta = a.eventStartAt ? new Date(a.eventStartAt).getTime() : 0;
    const tb = b.eventStartAt ? new Date(b.eventStartAt).getTime() : 0;
    return ta - tb;
  };

  upcoming.sort(byStart);
  past.sort((a, b) => byStart(b, a));
  unknown.sort(byStart);

  return { upcoming, past, unknown };
}

export function nextUpcomingTicket(tickets: StoredTicket[], now = Date.now()): StoredTicket | null {
  const { upcoming } = splitTicketsByTime(tickets, now);
  return upcoming[0] ?? null;
}
