import { NotifyChannel } from '../../domain/enums';

export type NotificationDispatchPayload = Record<string, unknown>;

export type NotificationDispatchInput = {
  channel: NotifyChannel;
  template: string;
  to: string;
  payload?: NotificationDispatchPayload;
};

export type NotificationDispatchResult = {
  notificationId: string;
  channel: NotifyChannel;
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  providerMessageId?: string;
  error?: string;
};

export type TicketWhatsAppPayload = {
  buyerName: string;
  eventTitle: string;
  ticketLinks: string[];
  /** Optional public HTTPS URL for a QR image (Twilio MediaUrl). */
  qrImageUrl?: string;
  orderId?: string;
};
