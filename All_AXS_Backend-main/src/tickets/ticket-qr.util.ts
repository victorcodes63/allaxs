/** Matches web `lib/ticket-qr.ts` compact v2 token for `/v/{token}` URLs. */
export function encodeTicketVerifyToken(ticket: {
  id: string;
  qrNonce: string;
  qrSignature: string;
}): string {
  const compact = {
    v: 2 as const,
    id: ticket.id,
    n: ticket.qrNonce,
    s: ticket.qrSignature,
  };
  return Buffer.from(JSON.stringify(compact), 'utf8').toString('base64url');
}

/** HTTPS URL encoded in ticket QR codes (camera opens `/v/...` landing). */
export function buildTicketQrUrl(
  siteOrigin: string,
  ticket: { id: string; qrNonce: string; qrSignature: string },
): string {
  const base = siteOrigin.replace(/\/$/, '');
  return `${base}/v/${encodeTicketVerifyToken(ticket)}`;
}
