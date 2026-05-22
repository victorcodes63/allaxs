import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TwilioWhatsAppAdapter } from './twilio-whatsapp.adapter';
import { TICKET_WHATSAPP_TEMPLATE } from '../templates/ticket-whatsapp.template';

describe('TwilioWhatsAppAdapter', () => {
  let adapter: TwilioWhatsAppAdapter;
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  async function createAdapter(config: Record<string, string>) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwilioWhatsAppAdapter,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) =>
              config[key] ?? defaultValue,
            ),
          },
        },
      ],
    }).compile();

    return module.get(TwilioWhatsAppAdapter);
  }

  it('skips send when provider is not configured', async () => {
    adapter = await createAdapter({ WHATSAPP_PROVIDER: 'none' });
    expect(adapter.isConfigured()).toBe(false);

    const result = await adapter.sendTicketMessage({
      toPhone: '+254700000000',
      template: TICKET_WHATSAPP_TEMPLATE,
      payload: {
        buyerName: 'Ada',
        eventTitle: 'Demo Night',
        ticketLinks: ['https://example.com/v/abc'],
      },
    });

    expect(result).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('dry-runs without calling Twilio API', async () => {
    adapter = await createAdapter({
      WHATSAPP_PROVIDER: 'twilio',
      TWILIO_ACCOUNT_SID: 'AC_test',
      TWILIO_AUTH_TOKEN: 'secret',
      TWILIO_WHATSAPP_FROM: 'whatsapp:+14155238886',
      WHATSAPP_DRY_RUN: 'true',
    });

    const result = await adapter.sendTicketMessage({
      toPhone: '254700000000',
      template: TICKET_WHATSAPP_TEMPLATE,
      payload: {
        buyerName: 'Ada',
        eventTitle: 'Demo Night',
        ticketLinks: ['https://example.com/v/abc'],
        qrImageUrl: 'https://example.com/qr.png',
      },
    });

    expect(result.dryRun).toBe(true);
    expect(result.messageId).toBe('dry_run');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends content template with variables and optional media', async () => {
    adapter = await createAdapter({
      WHATSAPP_PROVIDER: 'twilio',
      TWILIO_ACCOUNT_SID: 'AC_test',
      TWILIO_AUTH_TOKEN: 'secret',
      TWILIO_WHATSAPP_FROM: 'whatsapp:+14155238886',
      TWILIO_WHATSAPP_CONTENT_SID: 'HX_template',
      WHATSAPP_DRY_RUN: 'false',
    });

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ sid: 'SM123' }),
    });

    const result = await adapter.sendTicketMessage({
      toPhone: '+254700000000',
      template: TICKET_WHATSAPP_TEMPLATE,
      payload: {
        buyerName: 'Ada',
        eventTitle: 'Demo Night',
        ticketLinks: ['https://example.com/v/abc'],
        qrImageUrl: 'https://example.com/qr.png',
      },
    });

    expect(result.messageId).toBe('SM123');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/Accounts/AC_test/Messages.json');
    expect(init.method).toBe('POST');

    const body = String(init.body);
    expect(body).toContain('ContentSid=HX_template');
    expect(body).toContain('MediaUrl=https%3A%2F%2Fexample.com%2Fqr.png');
    expect(body).toContain('whatsapp%3A%2B254700000000');
  });
});
