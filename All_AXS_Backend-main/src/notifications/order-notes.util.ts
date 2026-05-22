export type TicketDeliveryPreference =
  | 'account'
  | 'email'
  | 'email_and_whatsapp';

export type OrderNotesMeta = {
  buyerName?: string;
  guestCheckout?: boolean;
  ticketDelivery?: TicketDeliveryPreference;
};

export function parseOrderNotes(
  notes: string | undefined | null,
): OrderNotesMeta {
  if (!notes?.trim()) return {};
  try {
    const parsed = JSON.parse(notes) as OrderNotesMeta;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function shouldSendTicketWhatsApp(
  meta: OrderNotesMeta,
  phone: string | undefined | null,
): boolean {
  return meta.ticketDelivery === 'email_and_whatsapp' && Boolean(phone?.trim());
}
