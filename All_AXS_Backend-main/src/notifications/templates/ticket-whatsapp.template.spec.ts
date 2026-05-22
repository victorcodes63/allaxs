import {
  buildTicketWhatsAppBody,
  buildTicketWhatsAppPayload,
} from '../templates/ticket-whatsapp.template';
import {
  parseOrderNotes,
  shouldSendTicketWhatsApp,
} from '../order-notes.util';

describe('ticket-whatsapp.template', () => {
  it('builds payload with verify links and optional QR image', () => {
    const payload = buildTicketWhatsAppPayload({
      buyerName: 'Ada',
      eventTitle: 'Jazz Night',
      siteOrigin: 'https://app.allaxs.com',
      tickets: [
        {
          id: 'tk_1',
          qrNonce: 'nonce1',
          qrSignature: 'sig1',
        },
      ],
      orderId: 'ord_1',
    });

    expect(payload.ticketLinks[0]).toMatch(/^https:\/\/app\.allaxs\.com\/v\//);
    expect(payload.qrImageUrl).toContain(encodeURIComponent(payload.ticketLinks[0]));
  });

  it('formats freeform WhatsApp body for multiple tickets', () => {
    const body = buildTicketWhatsAppBody({
      buyerName: 'Ada',
      eventTitle: 'Jazz Night',
      ticketLinks: ['https://a.test/v/1', 'https://a.test/v/2'],
    });

    expect(body).toContain('Hi Ada');
    expect(body).toContain('Jazz Night');
    expect(body).toContain('1. https://a.test/v/1');
    expect(body).toContain('2. https://a.test/v/2');
  });
});

describe('order-notes.util', () => {
  it('detects WhatsApp delivery preference', () => {
    const meta = parseOrderNotes(
      JSON.stringify({
        buyerName: 'Ada',
        ticketDelivery: 'email_and_whatsapp',
      }),
    );

    expect(shouldSendTicketWhatsApp(meta, '+254700000000')).toBe(true);
    expect(shouldSendTicketWhatsApp(meta, '')).toBe(false);
    expect(
      shouldSendTicketWhatsApp({ ticketDelivery: 'email' }, '+254700000000'),
    ).toBe(false);
  });
});
