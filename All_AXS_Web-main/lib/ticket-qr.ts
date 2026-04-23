import type { StoredTicket } from "@/lib/checkout-storage";

/**
 * Payload encoded in the ticket QR (demo / local checkout).
 * Scanning apps can parse JSON; production would verify a server-signed token.
 */
export function buildTicketQrPayload(ticket: StoredTicket): string {
  return JSON.stringify({
    v: 1,
    app: "allaxs",
    demo: true,
    ticketId: ticket.id,
    orderId: ticket.orderId,
    eventSlug: ticket.eventSlug,
    eventTitle: ticket.eventTitle,
    tier: ticket.tierName,
    attendeeEmail: ticket.attendeeEmail,
    issuedAt: ticket.issuedAt,
    qrNonce: ticket.qrNonce,
    qrSignature: ticket.qrSignature,
  });
}
