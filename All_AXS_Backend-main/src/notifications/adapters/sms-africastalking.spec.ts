import { ConfigService } from '@nestjs/config';
import { AfricasTalkingSmsAdapter } from './sms-africastalking';

describe('AfricasTalkingSmsAdapter', () => {
  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        AT_API_KEY: 'test-api-key',
        AT_USERNAME: 'sandbox',
        AT_SENDER_ID: 'ALLAXS',
      };
      return values[key];
    }),
  } as unknown as ConfigService;

  let adapter: AfricasTalkingSmsAdapter;

  beforeEach(() => {
    adapter = new AfricasTalkingSmsAdapter(config);
    jest.restoreAllMocks();
  });

  it('reports configured when AT env vars are set', () => {
    expect(adapter.isConfigured()).toBe(true);
  });

  it('normalizes Kenyan local numbers to E.164', () => {
    expect(adapter.normalizePhone('0712345678')).toBe('+254712345678');
    expect(adapter.normalizePhone('+254712345678')).toBe('+254712345678');
  });

  it('sends SMS via Africa\'s Talking API', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          SMSMessageData: {
            Recipients: [
              {
                statusCode: 101,
                status: 'Success',
                messageId: 'ATXid_123',
              },
            ],
          },
        }),
    } as Response);

    const result = await adapter.send({
      to: '0712345678',
      message: 'Your ticket is ready',
    });

    expect(result.status).toBe('sent');
    expect(result.messageId).toBe('ATXid_123');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.sandbox.africastalking.com/version1/messaging',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          apiKey: 'test-api-key',
        }),
      }),
    );
  });
});
