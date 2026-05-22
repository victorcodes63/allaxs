import { buildTicketQrUrl } from '../../tickets/ticket-qr.util';
import type { TicketWhatsAppPayload } from '../dispatch/notification-dispatch.types';

export const TICKET_WHATSAPP_TEMPLATE = 'ticket_delivery';

export function buildTicketVerifyLinks(
  siteOrigin: string,
  tickets: { id: string; qrNonce: string; qrSignature: string }[],
): string[] {
  return tickets.map((ticket) => buildTicketQrUrl(siteOrigin, ticket));
}

/** Public QR image URL for optional Twilio media attachment. */
export function buildOptionalQrImageUrl(ticketVerifyUrl: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ticketVerifyUrl)}`;
}

export function buildTicketWhatsAppPayload(input: {
  buyerName: string;
  eventTitle: string;
  siteOrigin: string;
  tickets: { id: string; qrNonce: string; qrSignature: string }[];
  orderId?: string;
  includeQrImage?: boolean;
}): TicketWhatsAppPayload {
  const ticketLinks = buildTicketVerifyLinks(input.siteOrigin, input.tickets);
  const qrImageUrl =
    input.includeQrImage !== false && ticketLinks[0]
      ? buildOptionalQrImageUrl(ticketLinks[0])
      : undefined;

  return {
    buyerName: input.buyerName,
    eventTitle: input.eventTitle,
    ticketLinks,
    qrImageUrl,
    orderId: input.orderId,
  };
}

/** Fallback body when no Twilio Content SID is configured (sandbox / dev). */
export function buildTicketWhatsAppBody(payload: TicketWhatsAppPayload): string {
  const greeting = payload.buyerName.trim()
    ? `Hi ${payload.buyerName.trim()},`
    : 'Hi,';
  const linkBlock =
    payload.ticketLinks.length === 1
      ? `Your ticket: ${payload.ticketLinks[0]}`
      : `Your tickets:\n${payload.ticketLinks.map((link, i) => `${i + 1}. ${link}`).join('\n')}`;

  return `${greeting} your All AXS pass for *${payload.eventTitle}* is ready.\n\n${linkBlock}\n\nShow the QR at the door. Reply HELP for support.`;
}
