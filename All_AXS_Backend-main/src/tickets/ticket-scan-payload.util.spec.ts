import {
  extractTokenFromVerifyUrl,
  parseTicketScanPayload,
} from './ticket-scan-payload.util';
import { encodeTicketVerifyToken } from './ticket-qr.util';

describe('parseTicketScanPayload', () => {
  const ticket = {
    id: 'a711ff79-723e-4354-96d3-e24c2c133b36',
    qrNonce: 'nonce-abc',
    qrSignature: 'sig-deadbeef',
  };

  it('parses verify URLs from any site origin', () => {
    const token = encodeTicketVerifyToken(ticket);
    const url = `https://www.axs.africa/v/${token}`;

    expect(parseTicketScanPayload(url)).toEqual({
      ticketId: ticket.id,
      qrNonce: ticket.qrNonce,
    });
    expect(extractTokenFromVerifyUrl(url)).toBe(token);
  });

  it('parses legacy JSON v2 payloads', () => {
    const json = JSON.stringify({
      v: 2,
      ticketId: ticket.id,
      qrNonce: ticket.qrNonce,
      qrSignature: ticket.qrSignature,
    });

    expect(parseTicketScanPayload(json)).toEqual({
      ticketId: ticket.id,
      qrNonce: ticket.qrNonce,
    });
  });

  it('parses ticketId:qrNonce colon payloads', () => {
    expect(
      parseTicketScanPayload(`${ticket.id}:${ticket.qrNonce}`),
    ).toEqual({
      ticketId: ticket.id,
      qrNonce: ticket.qrNonce,
    });
  });

  it('rejects demo v1 verify tokens without qr nonce', () => {
    const demoToken = Buffer.from(
      JSON.stringify({ v: 1, id: ticket.id, d: 1 }),
      'utf8',
    ).toString('base64url');

    expect(
      parseTicketScanPayload(`https://www.axs.africa/v/${demoToken}`),
    ).toBeNull();
  });
});
