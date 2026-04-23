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

/** How the buyer asked to receive ticket details (demo UI; production would trigger email/WhatsApp). */
export type TicketDeliveryChannel = "account" | "email" | "email_and_whatsapp";

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
  /** True when checkout completed without a signed-in session (browser session passes in demo). */
  guestCheckout?: boolean;
  ticketDelivery?: TicketDeliveryChannel;
};

export type CheckoutDraft = {
  eventId: string;
  qty: Record<string, number>;
  step: "tickets" | "buyer";
  guestMode: boolean | null;
};

const CHECKOUT_DRAFT_KEY = "allaxs_checkout_draft";

export function saveCheckoutDraft(draft: CheckoutDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

export function loadCheckoutDraft(eventId: string): CheckoutDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CHECKOUT_DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as CheckoutDraft;
    if (d.eventId !== eventId) return null;
    return d;
  } catch {
    return null;
  }
}

export function clearCheckoutDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export type StoredTicket = {
  id: string;
  orderId: string;
  eventSlug: string;
  eventTitle: string;
  tierName: string;
  attendeeEmail: string;
  issuedAt: string;
  currency: string;
  /** When the issuing API includes it (otherwise hydrate from public event by slug). */
  eventId?: string;
  eventStartAt?: string;
  eventEndAt?: string;
  eventVenue?: string;
  eventCity?: string;
  eventCountry?: string;
  /** Present when issued via API checkout (QR payload). */
  qrNonce?: string;
  qrSignature?: string;
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

export function findTicketsByOrderId(orderId: string): StoredTicket[] {
  return loadAllTickets().filter((t) => t.orderId === orderId);
}

export function saveOrderForSession(order: StoredOrder): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ORDER_KEY(order.orderId), JSON.stringify(order));
  } catch {
    /* ignore */
  }
}

export function mergeTicketsFromApi(tickets: StoredTicket[]): void {
  if (typeof window === "undefined") return;
  try {
    const existing: StoredTicket[] = JSON.parse(
      window.sessionStorage.getItem(TICKETS_KEY) || "[]"
    );
    const byId = new Map(existing.map((t) => [t.id, t]));
    for (const t of tickets) {
      byId.set(t.id, t);
    }
    window.sessionStorage.setItem(TICKETS_KEY, JSON.stringify([...byId.values()]));
  } catch {
    /* ignore */
  }
}
