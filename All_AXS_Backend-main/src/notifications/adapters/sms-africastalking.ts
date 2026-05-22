import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type SendSmsInput = {
  to: string;
  message: string;
};

export type SendSmsResult = {
  messageId?: string;
  status: 'sent' | 'failed';
  cost?: string;
  raw?: unknown;
};

type AfricasTalkingRecipient = {
  statusCode?: number;
  number?: string;
  status?: string;
  cost?: string;
  messageId?: string;
};

type AfricasTalkingResponse = {
  SMSMessageData?: {
    Message?: string;
    Recipients?: AfricasTalkingRecipient[];
  };
};

@Injectable()
export class AfricasTalkingSmsAdapter {
  private readonly logger = new Logger(AfricasTalkingSmsAdapter.name);

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.configService.get<string>('AT_API_KEY')?.trim() &&
        this.configService.get<string>('AT_USERNAME')?.trim() &&
        this.configService.get<string>('AT_SENDER_ID')?.trim(),
    );
  }

  /** E.164-ish normalization with Kenya (+254) defaults for local formats. */
  normalizePhone(raw: string): string {
    let phone = raw.trim().replace(/[\s-]/g, '');
    if (!phone) return phone;
    if (phone.startsWith('+')) return phone;
    if (phone.startsWith('00')) return `+${phone.slice(2)}`;
    if (phone.startsWith('0')) return `+254${phone.slice(1)}`;
    if (phone.startsWith('254')) return `+${phone}`;
    return `+${phone}`;
  }

  private apiBaseUrl(): string {
    const explicit = this.configService.get<string>('AT_API_BASE_URL')?.trim();
    if (explicit) return explicit.replace(/\/$/, '');

    const useSandbox =
      this.configService.get<string>('AT_USE_SANDBOX') === 'true' ||
      this.configService.get<string>('AT_USERNAME')?.trim() === 'sandbox';
    return useSandbox
      ? 'https://api.sandbox.africastalking.com'
      : 'https://api.africastalking.com';
  }

  async send(input: SendSmsInput): Promise<SendSmsResult> {
    if (!this.isConfigured()) {
      throw new Error(
        "Africa's Talking SMS is not configured (AT_API_KEY, AT_USERNAME, AT_SENDER_ID)",
      );
    }

    const apiKey = this.configService.get<string>('AT_API_KEY')!.trim();
    const username = this.configService.get<string>('AT_USERNAME')!.trim();
    const senderId = this.configService.get<string>('AT_SENDER_ID')!.trim();
    const to = this.normalizePhone(input.to);
    const message = input.message.trim();

    if (!to || to.length < 8) {
      throw new Error('Invalid SMS recipient phone number');
    }
    if (!message) {
      throw new Error('SMS message body is required');
    }

    const body = new URLSearchParams({
      username,
      to,
      message,
      from: senderId,
    });

    const url = `${this.apiBaseUrl()}/version1/messaging`;
    this.logger.debug(`Sending SMS via Africa's Talking to ${to}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const rawText = await response.text();
    let parsed: AfricasTalkingResponse | undefined;
    try {
      parsed = rawText ? (JSON.parse(rawText) as AfricasTalkingResponse) : undefined;
    } catch {
      parsed = undefined;
    }

    if (!response.ok) {
      this.logger.error(
        `Africa's Talking SMS HTTP ${response.status}: ${rawText.slice(0, 500)}`,
      );
      throw new Error(
        `Africa's Talking SMS failed (${response.status}): ${rawText.slice(0, 200)}`,
      );
    }

    const recipient = parsed?.SMSMessageData?.Recipients?.[0];
    const status = recipient?.status?.toLowerCase() ?? '';
    const statusCode = recipient?.statusCode;

    if (
      status === 'success' ||
      statusCode === 101 ||
      statusCode === 102
    ) {
      this.logger.log(
        `SMS sent to ${to} (messageId=${recipient?.messageId ?? 'n/a'})`,
      );
      return {
        messageId: recipient?.messageId,
        status: 'sent',
        cost: recipient?.cost,
        raw: parsed ?? rawText,
      };
    }

    const failureReason =
      recipient?.status ??
      parsed?.SMSMessageData?.Message ??
      rawText.slice(0, 200);
    this.logger.error(`Africa's Talking SMS rejected for ${to}: ${failureReason}`);
    throw new Error(`Africa's Talking SMS rejected: ${failureReason}`);
  }
}
