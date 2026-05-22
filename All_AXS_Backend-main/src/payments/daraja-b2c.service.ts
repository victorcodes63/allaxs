import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export type DarajaB2cPaymentParams = {
  amountCents: number;
  phone: string;
  accountReference?: string;
  remarks?: string;
};

export type DarajaB2cPaymentResult = {
  conversationId: string;
  originatorConversationId: string;
  responseCode: string;
  responseDescription: string;
};

type DarajaOAuthResponse = {
  access_token?: string;
  expires_in?: string | number;
};

type DarajaB2cApiResponse = {
  ConversationID?: string;
  OriginatorConversationID?: string;
  ResponseCode?: string;
  ResponseDescription?: string;
  errorCode?: string;
  errorMessage?: string;
};

@Injectable()
export class DarajaB2cService {
  private readonly logger = new Logger(DarajaB2cService.name);
  private cachedToken: { value: string; expiresAtMs: number } | null = null;

  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    return this.configService.get<string>('DARAJA_B2C_ENABLED') === 'true';
  }

  getEnvironment(): 'sandbox' | 'production' {
    const env = (this.configService.get<string>('DARAJA_ENV') ?? 'sandbox')
      .trim()
      .toLowerCase();
    return env === 'production' ? 'production' : 'sandbox';
  }

  private baseUrl(): string {
    return this.getEnvironment() === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
  }

  private requiredConfig(key: string): string {
    const value = (this.configService.get<string>(key) ?? '').trim();
    if (!value) {
      throw new ServiceUnavailableException(
        `Daraja B2C is misconfigured: missing ${key}`,
      );
    }
    return value;
  }

  /** Normalize Kenyan MSISDN to 254XXXXXXXXX for Daraja PartyB. */
  normalizeKenyanMsisdn(raw: string): string | null {
    let digits = raw.replace(/\D/g, '');
    if (!digits) return null;
    if (digits.startsWith('0')) {
      digits = `254${digits.slice(1)}`;
    } else if (digits.length === 9 && /^[17]/.test(digits)) {
      digits = `254${digits}`;
    }
    if (!/^254[17]\d{8}$/.test(digits)) {
      return null;
    }
    return digits;
  }

  async initiateB2cPayment(
    params: DarajaB2cPaymentParams,
  ): Promise<DarajaB2cPaymentResult> {
    if (!this.isEnabled()) {
      throw new BadRequestException(
        'Daraja B2C disbursement is disabled. Set DARAJA_B2C_ENABLED=true or use manual mark-paid.',
      );
    }

    const phone = this.normalizeKenyanMsisdn(params.phone);
    if (!phone) {
      throw new BadRequestException(
        'Invalid M-Pesa phone number. Use a Kenyan number in 254XXXXXXXXX format.',
      );
    }

    if (params.amountCents <= 0) {
      throw new BadRequestException('Payout amount must be greater than zero.');
    }

    const amount = Math.round(params.amountCents / 100);
    if (amount < 1) {
      throw new BadRequestException(
        'Daraja B2C minimum payout is KES 1 (100 cents).',
      );
    }

    const accessToken = await this.getAccessToken();
    const shortcode = this.requiredConfig('DARAJA_SHORTCODE');
    const initiatorName = this.requiredConfig('DARAJA_INITIATOR_NAME');
    const securityCredential = this.requiredConfig(
      'DARAJA_SECURITY_CREDENTIAL',
    );
    const queueTimeoutUrl = this.requiredConfig('DARAJA_B2C_QUEUE_TIMEOUT_URL');
    const resultUrl = this.requiredConfig('DARAJA_B2C_RESULT_URL');
    const commandId =
      this.configService.get<string>('DARAJA_B2C_COMMAND_ID')?.trim() ||
      'BusinessPayment';
    const remarks =
      params.remarks?.trim() ||
      this.configService.get<string>('DARAJA_B2C_REMARKS')?.trim() ||
      'Organizer payout';

    const originatorConversationId = crypto.randomUUID();

    const body = {
      OriginatorConversationID: originatorConversationId,
      InitiatorName: initiatorName,
      SecurityCredential: securityCredential,
      CommandID: commandId,
      Amount: String(amount),
      PartyA: shortcode,
      PartyB: phone,
      Remarks: remarks.slice(0, 100),
      QueueTimeOutURL: queueTimeoutUrl,
      ResultURL: resultUrl,
      Occassion: (params.accountReference ?? 'Payout').slice(0, 100),
    };

    const response = await fetch(
      `${this.baseUrl()}/mpesa/b2c/v3/paymentrequest`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    const data = (await response.json().catch(() => ({}))) as DarajaB2cApiResponse;

    if (!response.ok) {
      const msg =
        data.errorMessage ||
        data.ResponseDescription ||
        `Daraja B2C request failed (${response.status})`;
      this.logger.warn(`Daraja B2C HTTP error: ${msg}`);
      throw new BadRequestException(msg);
    }

    if (data.ResponseCode !== '0' || !data.ConversationID) {
      const msg =
        data.errorMessage ||
        data.ResponseDescription ||
        'Daraja B2C rejected the payout request';
      throw new BadRequestException(msg);
    }

    return {
      conversationId: data.ConversationID,
      originatorConversationId:
        data.OriginatorConversationID ?? originatorConversationId,
      responseCode: data.ResponseCode,
      responseDescription: data.ResponseDescription ?? 'Accepted',
    };
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAtMs > now + 30_000) {
      return this.cachedToken.value;
    }

    const consumerKey = this.requiredConfig('DARAJA_CONSUMER_KEY');
    const consumerSecret = this.requiredConfig('DARAJA_CONSUMER_SECRET');
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString(
      'base64',
    );

    const response = await fetch(
      `${this.baseUrl()}/oauth/v1/generate?grant_type=client_credentials`,
      {
        method: 'GET',
        headers: { Authorization: `Basic ${auth}` },
      },
    );

    const data = (await response.json().catch(() => ({}))) as DarajaOAuthResponse;

    if (!response.ok || !data.access_token) {
      const msg =
        (data as { errorMessage?: string }).errorMessage ||
        'Failed to obtain Daraja OAuth token';
      this.logger.error(`Daraja OAuth failed: ${msg}`);
      throw new ServiceUnavailableException(msg);
    }

    const ttlSec = Number(data.expires_in ?? 3599);
    this.cachedToken = {
      value: data.access_token,
      expiresAtMs: now + Math.max(60, ttlSec) * 1000,
    };
    return data.access_token;
  }
}
