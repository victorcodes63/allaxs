import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  buildTicketWhatsAppBody,
  TICKET_WHATSAPP_TEMPLATE,
} from '../templates/ticket-whatsapp.template';
import type { TicketWhatsAppPayload } from '../dispatch/notification-dispatch.types';

export type TwilioWhatsAppSendInput = {
  toPhone: string;
  template: string;
  payload: TicketWhatsAppPayload;
};

export type TwilioWhatsAppSendResult = {
  messageId?: string;
  dryRun?: boolean;
};

@Injectable()
export class TwilioWhatsAppAdapter {
  private readonly logger = new Logger(TwilioWhatsAppAdapter.name);
  private readonly provider: string;
  private readonly accountSid?: string;
  private readonly authToken?: string;
  private readonly fromNumber?: string;
  private readonly contentSid?: string;
  private readonly dryRun: boolean;

  constructor(private readonly configService: ConfigService) {
    this.provider = this.configService
      .get<string>('WHATSAPP_PROVIDER', 'none')
      .toLowerCase();
    this.accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    this.authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.fromNumber = this.configService.get<string>('TWILIO_WHATSAPP_FROM');
    this.contentSid = this.configService.get<string>(
      'TWILIO_WHATSAPP_CONTENT_SID',
    );
    this.dryRun =
      this.configService.get<string>('WHATSAPP_DRY_RUN', 'false') === 'true';

    if (this.provider === 'twilio') {
      if (!this.accountSid || !this.authToken || !this.fromNumber) {
        this.logger.warn(
          'WHATSAPP_PROVIDER=twilio but TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_WHATSAPP_FROM is missing. WhatsApp sends will be skipped.',
        );
      } else {
        this.logger.log('Twilio WhatsApp adapter initialized.');
        if (this.contentSid) {
          this.logger.log(
            `Twilio WhatsApp content template configured: ${this.contentSid}`,
          );
        } else {
          this.logger.warn(
            'TWILIO_WHATSAPP_CONTENT_SID not set — using freeform body (sandbox/dev only).',
          );
        }
      }
    }
  }

  isConfigured(): boolean {
    return (
      this.provider === 'twilio' &&
      Boolean(this.accountSid && this.authToken && this.fromNumber)
    );
  }

  async sendTicketMessage(
    input: TwilioWhatsAppSendInput,
  ): Promise<TwilioWhatsAppSendResult> {
    if (input.template !== TICKET_WHATSAPP_TEMPLATE) {
      throw new Error(`Unsupported WhatsApp template: ${input.template}`);
    }

    if (!this.isConfigured()) {
      this.logger.warn(
        `[sendTicketMessage] WhatsApp provider unavailable, skipping message to ${input.toPhone}`,
      );
      return {};
    }

    if (this.dryRun) {
      this.logger.log(
        `[DRY_RUN] WhatsApp ticket message to ${input.toPhone}: ${buildTicketWhatsAppBody(input.payload)}`,
      );
      return { messageId: 'dry_run', dryRun: true };
    }

    const to = this.normalizeWhatsAppAddress(input.toPhone);
    const from = this.normalizeWhatsAppAddress(this.fromNumber!);
    const body = new URLSearchParams();

    body.set('From', from);
    body.set('To', to);

    if (this.contentSid) {
      body.set('ContentSid', this.contentSid);
      body.set(
        'ContentVariables',
        JSON.stringify(this.buildContentVariables(input.payload)),
      );
    } else {
      body.set('Body', buildTicketWhatsAppBody(input.payload));
    }

    if (input.payload.qrImageUrl) {
      body.set('MediaUrl', input.payload.qrImageUrl);
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString(
      'base64',
    );

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const result = (await response.json().catch(() => ({}))) as {
      sid?: string;
      message?: string;
      code?: number;
    };

    if (!response.ok) {
      const detail = result.message ?? response.statusText;
      throw new Error(
        `Twilio WhatsApp send failed (${response.status}): ${detail}`,
      );
    }

    this.logger.log(
      `[sendTicketMessage] Sent to ${input.toPhone} (Twilio SID: ${result.sid ?? 'unknown'})`,
    );

    return { messageId: result.sid };
  }

  private buildContentVariables(
    payload: TicketWhatsAppPayload,
  ): Record<string, string> {
    const primaryLink = payload.ticketLinks[0] ?? '';
    const allLinks =
      payload.ticketLinks.length <= 1
        ? primaryLink
        : payload.ticketLinks.join('\n');

    return {
      '1': payload.buyerName.trim() || 'there',
      '2': payload.eventTitle,
      '3': allLinks,
    };
  }

  private normalizeWhatsAppAddress(phone: string): string {
    const trimmed = phone.trim();
    if (trimmed.startsWith('whatsapp:')) return trimmed;
    const digits = trimmed.replace(/[^\d+]/g, '');
    const normalized = digits.startsWith('+') ? digits : `+${digits}`;
    return `whatsapp:${normalized}`;
  }
}
