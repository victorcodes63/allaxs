/**
 * Client-side order snapshot until backend checkout is wired.
 * Reads/writes sessionStorage.
 */

export type CheckoutLineItem = {
  ticketTypeId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  currency: string;
};

export type StoredOrder = {
  orderId: string;
  createdAt: string;
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  lineItems: CheckoutLineItem[];
  totalCents: number;
  currency: string;
};

export type StoredTicket = {
  id: string;
  orderId: string;
  eventSlug: string;
  eventTitle: string;
  tierName: string;
  attendeeEmail: string;
  issuedAt: string;
  currency: string;
};

const ORDER_KEY = (orderId: string) => `allaxs_order_${orderId}`;
const TICKETS_KEY = "allaxs_tickets";

export function saveOrderSnapshot(order: StoredOrder): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ORDER_KEY(order.orderId), JSON.stringify(order));
    const existing: StoredTicket[] = JSON.parse(
      window.sessionStorage.getItem(TICKETS_KEY) || "[]"
    );
    const next = [...existing];
    for (const line of order.lineItems) {
      for (let i = 0; i < line.quantity; i++) {
        next.push({
          id: `tk_${crypto.randomUUID()}`,
          orderId: order.orderId,
          eventSlug: order.eventSlug,
          eventTitle: order.eventTitle,
          tierName: line.name,
          attendeeEmail: order.buyerEmail,
          issuedAt: order.createdAt,
          currency: line.currency,
        });
      }
    }
    window.sessionStorage.setItem(TICKETS_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadOrderSnapshot(orderId: string): StoredOrder | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(ORDER_KEY(orderId));
    if (!raw) return null;
    return JSON.parse(raw) as StoredOrder;
  } catch {
    return null;
  }
}

export function loadAllTickets(): StoredTicket[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.sessionStorage.getItem(TICKETS_KEY) || "[]") as StoredTicket[];
  } catch {
    return [];
  }
}

export function findTicketById(ticketId: string): StoredTicket | null {
  return loadAllTickets().find((t) => t.id === ticketId) ?? null;
}
