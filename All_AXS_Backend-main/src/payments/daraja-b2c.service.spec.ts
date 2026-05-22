import { ConfigService } from '@nestjs/config';
import { DarajaB2cService } from './daraja-b2c.service';

describe('DarajaB2cService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function createService(env: Record<string, string>): DarajaB2cService {
    const config = {
      get: (key: string) => env[key],
    } as ConfigService;
    return new DarajaB2cService(config);
  }

  it('normalizeKenyanMsisdn accepts common formats', () => {
    const service = createService({});
    expect(service.normalizeKenyanMsisdn('+254712345678')).toBe('254712345678');
    expect(service.normalizeKenyanMsisdn('0712345678')).toBe('254712345678');
    expect(service.normalizeKenyanMsisdn('712345678')).toBe('254712345678');
    expect(service.normalizeKenyanMsisdn('123')).toBeNull();
  });

  it('isEnabled reflects DARAJA_B2C_ENABLED', () => {
    expect(createService({ DARAJA_B2C_ENABLED: 'true' }).isEnabled()).toBe(true);
    expect(createService({ DARAJA_B2C_ENABLED: 'false' }).isEnabled()).toBe(false);
  });

  it('initiateB2cPayment calls Daraja sandbox and returns conversation id', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-123', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ConversationID: 'conv-abc',
          OriginatorConversationID: 'orig-abc',
          ResponseCode: '0',
          ResponseDescription: 'Accept the service request successfully.',
        }),
      });
    global.fetch = fetchMock as typeof fetch;

    const service = createService({
      DARAJA_B2C_ENABLED: 'true',
      DARAJA_ENV: 'sandbox',
      DARAJA_CONSUMER_KEY: 'key',
      DARAJA_CONSUMER_SECRET: 'secret',
      DARAJA_SHORTCODE: '600000',
      DARAJA_INITIATOR_NAME: 'testapi',
      DARAJA_SECURITY_CREDENTIAL: 'cred',
      DARAJA_B2C_QUEUE_TIMEOUT_URL: 'https://example.com/timeout',
      DARAJA_B2C_RESULT_URL: 'https://example.com/result',
    });

    const result = await service.initiateB2cPayment({
      amountCents: 150000,
      phone: '254712345678',
      accountReference: 'line1234',
    });

    expect(result.conversationId).toBe('conv-abc');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      'sandbox.safaricom.co.ke/mpesa/b2c/v3/paymentrequest',
    );
  });
});
