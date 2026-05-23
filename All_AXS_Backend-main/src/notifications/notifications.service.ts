import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Notification } from '../domain/notification.entity';
import { NotifyChannel, NotifyStatus } from '../domain/enums';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EmailService } from '../auth/services/email.service';
import { UsersService } from '../users/users.service';
import type {
  TicketEmailEventInput,
  TicketEmailTicketInput,
} from '../tickets/ticket-email.util';
import { AfricasTalkingSmsAdapter } from './adapters/sms-africastalking';
import { TwilioWhatsAppAdapter } from './adapters/twilio-whatsapp.adapter';
import {
  buildTicketWhatsAppPayload,
  TICKET_WHATSAPP_TEMPLATE,
} from './templates/ticket-whatsapp.template';
import type { TicketWhatsAppPayload } from './dispatch/notification-dispatch.types';

type NotificationPayload = Record<string, unknown>;

export type CreateInAppNotificationInput = {
  to: string;
  title: string;
  body: string;
  link?: string;
  category?: 'orders' | 'hosting' | 'system';
  template?: string;
  payload?: NotificationPayload;
};

export type EnqueueNotificationInput = {
  channel: NotifyChannel;
  to: string;
  template?: string;
  payload?: NotificationPayload;
  processInline?: boolean;
};

export type TicketEmailNotificationInput = {
  buyerName: string;
  buyerEmail: string;
  eventTitle: string;
  event?: TicketEmailEventInput;
  tickets: TicketEmailTicketInput[];
  summary?: {
    subtotalCents: number;
    discountCents: number;
    totalCents: number;
    currency: string;
    couponCode?: string | null;
  };
  accessUrl?: string;
  accountCreated?: boolean;
};

export type PaymentReceiptNotificationInput = {
  buyerEmail: string;
  buyerName?: string | null;
  organizerName: string;
  organizerSupportEmail?: string | null;
  eventTitle: string;
  paymentReference: string;
  orderReference?: string | null;
  paidAt: Date;
  amountCents: number;
  currency: string;
  paymentMethodLabel?: string | null;
  orderConfirmationUrl?: string;
  ticketsPending?: boolean;
  installmentNote?: string | null;
};

export type TicketWhatsAppNotificationInput = {
  phone: string;
  buyerName: string;
  eventTitle: string;
  tickets: { id: string; qrNonce: string; qrSignature: string }[];
  orderId?: string;
  includeQrImage?: boolean;
};

export type TicketDeliverySmsInput = {
  phone: string;
  eventTitle: string;
  deepLink: string;
  buyerName?: string;
  ticketCount?: number;
};

export type InstallmentDueReminderNotificationInput = {
  buyerEmail: string;
  buyerName?: string | null;
  eventTitle: string;
  amountCents: number;
  currency: string;
  dueAt: Date;
  sequence: number;
  isOverdue: boolean;
  orderId: string;
  orderUrl: string;
};

export type NotificationListItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  category: 'orders' | 'hosting' | 'system';
  channel: string;
  status: string;
  link?: string;
  isRead: boolean;
};

export type DispatchBatchResult = {
  processed: number;
  sent: number;
  failed: number;
  retried: number;
};

class UnconfiguredChannelError extends Error {
  constructor(channel: NotifyChannel) {
    super(`${channel} adapter not configured`);
    this.name = 'UnconfiguredChannelError';
  }
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly maxRetries: number;
  private readonly batchSize: number;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly emailService: EmailService,
    private readonly usersService: UsersService,
    private readonly smsAdapter: AfricasTalkingSmsAdapter,
    private readonly whatsAppAdapter: TwilioWhatsAppAdapter,
    private readonly configService: ConfigService,
  ) {
    this.maxRetries = Number(
      this.configService.get<string>('NOTIFICATION_MAX_RETRIES', '3'),
    );
    this.batchSize = Number(
      this.configService.get<string>('NOTIFICATION_DISPATCH_BATCH_SIZE', '25'),
    );
  }

  private payloadOf(entity: Notification): NotificationPayload {
    if (!entity.payload || typeof entity.payload !== 'object') return {};
    return entity.payload as NotificationPayload;
  }

  private isReadForUser(entity: Notification, userId: string): boolean {
    const payload = this.payloadOf(entity);
    const readByUserIds = Array.isArray(payload.readByUserIds)
      ? payload.readByUserIds.filter((v): v is string => typeof v === 'string')
      : [];
    if (readByUserIds.includes(userId)) return true;

    const readAtByUserId = payload.readAtByUserId;
    if (
      readAtByUserId &&
      typeof readAtByUserId === 'object' &&
      typeof (readAtByUserId as Record<string, unknown>)[userId] === 'string'
    ) {
      return true;
    }
    return false;
  }

  private toListItem(
    entity: Notification,
    userId: string,
  ): NotificationListItem {
    const payload = this.payloadOf(entity);
    const title =
      (typeof payload.title === 'string' ? payload.title : undefined) ??
      (typeof payload.subject === 'string' ? payload.subject : undefined) ??
      entity.template ??
      'Notification';
    const body =
      (typeof payload.body === 'string' ? payload.body : undefined) ??
      (typeof payload.message === 'string' ? payload.message : undefined) ??
      `Delivery update via ${entity.channel.toLowerCase()}.`;
    const link = typeof payload.link === 'string' ? payload.link : undefined;

    return {
      id: entity.id,
      title,
      body,
      createdAt: entity.createdAt.toISOString(),
      category: this.resolveCategory(entity, payload, title, body, link),
      channel: entity.channel,
      status: entity.status,
      link,
      isRead: this.isReadForUser(entity, userId),
    };
  }

  async enqueueNotification(
    input: EnqueueNotificationInput,
  ): Promise<Notification> {
    return this.notificationRepository.save(
      this.notificationRepository.create({
        channel: input.channel,
        template: input.template,
        to: input.to.trim(),
        payload: input.payload,
        status: NotifyStatus.PENDING,
        retryCount: 0,
      }),
    );
  }

  async enqueueTicketEmail(
    input: TicketEmailNotificationInput,
  ): Promise<Notification | null> {
    if (!(await this.usersService.shouldSendOrdersEmail(input.buyerEmail))) {
      this.logger.log(
        `Skipping ticket email to ${input.buyerEmail} (ordersEmail preference off)`,
      );
      return null;
    }
    return this.enqueueNotification({
      channel: NotifyChannel.EMAIL,
      to: input.buyerEmail,
      template: 'ticket_email',
      payload: this.serializeTicketEmailPayload(input),
    });
  }

  async dispatchTicketEmail(
    input: TicketEmailNotificationInput,
  ): Promise<Notification | null> {
    const notification = await this.enqueueTicketEmail(input);
    if (!notification) return null;
    await this.processNotification(notification.id);
    return (
      (await this.notificationRepository.findOne({
        where: { id: notification.id },
      })) ?? notification
    );
  }

  async enqueuePaymentReceiptEmail(
    input: PaymentReceiptNotificationInput,
  ): Promise<Notification | null> {
    if (!(await this.usersService.shouldSendOrdersEmail(input.buyerEmail))) {
      this.logger.log(
        `Skipping payment receipt to ${input.buyerEmail} (ordersEmail preference off)`,
      );
      return null;
    }
    return this.enqueueNotification({
      channel: NotifyChannel.EMAIL,
      to: input.buyerEmail,
      template: 'payment_receipt',
      payload: this.serializePaymentReceiptPayload(input),
    });
  }

  async dispatchPaymentReceiptEmail(
    input: PaymentReceiptNotificationInput,
  ): Promise<Notification | null> {
    const notification = await this.enqueuePaymentReceiptEmail(input);
    if (!notification) return null;
    await this.processNotification(notification.id);
    return (
      (await this.notificationRepository.findOne({
        where: { id: notification.id },
      })) ?? notification
    );
  }

  async dispatchInstallmentDueReminder(
    input: InstallmentDueReminderNotificationInput,
  ): Promise<void> {
    const amountLabel = `${(input.amountCents / 100).toFixed(2)} ${input.currency}`;
    const dueLabel = input.dueAt.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const title = input.isOverdue
      ? 'Installment payment overdue'
      : 'Installment payment due soon';
    const body = input.isOverdue
      ? `Pay ${amountLabel} for ${input.eventTitle} — due ${dueLabel}.`
      : `${amountLabel} for ${input.eventTitle} is due ${dueLabel}.`;

    await this.createInAppNotification({
      to: input.buyerEmail,
      title,
      body,
      link: input.orderUrl,
      category: 'orders',
      template: 'installment_due_reminder',
      payload: {
        orderId: input.orderId,
        sequence: input.sequence,
        isOverdue: input.isOverdue,
      },
    });

    const notification = await this.enqueueNotification({
      channel: NotifyChannel.EMAIL,
      to: input.buyerEmail,
      template: 'installment_due_reminder',
      payload: this.serializeInstallmentDueReminderPayload(input),
    });
    await this.processNotification(notification.id);
  }

  async enqueueTicketWhatsApp(
    input: TicketWhatsAppNotificationInput,
  ): Promise<Notification | null> {
    const phone = input.phone?.trim();
    if (!phone) return null;
    if (!this.whatsAppAdapter.isConfigured()) return null;
    if (this.configService.get<string>('WHATSAPP_TICKET_DELIVERY') === 'false') {
      return null;
    }

    const siteOrigin =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    const payload = buildTicketWhatsAppPayload({
      buyerName: input.buyerName,
      eventTitle: input.eventTitle,
      siteOrigin,
      tickets: input.tickets,
      orderId: input.orderId,
      includeQrImage: input.includeQrImage,
    });

    return this.enqueueNotification({
      channel: NotifyChannel.WHATSAPP,
      to: phone,
      template: TICKET_WHATSAPP_TEMPLATE,
      payload: payload as NotificationPayload,
    });
  }

  async sendTicketDeliverySms(
    input: TicketDeliverySmsInput,
  ): Promise<Notification | null> {
    if (this.configService.get<string>('SMS_TICKET_DELIVERY') === 'false') {
      return null;
    }
    if (!this.smsAdapter.isConfigured()) {
      return null;
    }

    const phone = input.phone?.trim();
    if (!phone) return null;

    try {
      const notification = await this.enqueueNotification({
        channel: NotifyChannel.SMS,
        to: phone,
        template: 'ticket_delivery',
        payload: {
          eventTitle: input.eventTitle,
          deepLink: input.deepLink,
          buyerName: input.buyerName,
          ticketCount: input.ticketCount,
        },
      });
      await this.processNotification(notification.id);
      return (
        (await this.notificationRepository.findOne({
          where: { id: notification.id },
        })) ?? notification
      );
    } catch (error) {
      this.logger.warn(
        `Ticket delivery SMS failed for ${phone}: ${String(error)}`,
      );
      return null;
    }
  }

  async enqueueAndDispatch(
    input: EnqueueNotificationInput,
  ): Promise<Notification> {
    const notification = await this.enqueueNotification(input);
    await this.processNotification(notification.id);
    return (
      (await this.notificationRepository.findOne({
        where: { id: notification.id },
      })) ?? notification
    );
  }

  async processPendingBatch(
    limit = this.batchSize,
  ): Promise<DispatchBatchResult> {
    const pending = await this.notificationRepository.find({
      where: { status: NotifyStatus.PENDING },
      order: { createdAt: 'ASC' },
      take: limit,
    });

    const result: DispatchBatchResult = {
      processed: 0,
      sent: 0,
      failed: 0,
      retried: 0,
    };

    for (const notification of pending) {
      const outcome = await this.processNotification(notification.id);
      result.processed += 1;
      if (outcome === 'sent') result.sent += 1;
      if (outcome === 'failed') result.failed += 1;
      if (outcome === 'retry') result.retried += 1;
    }

    return result;
  }

  async processNotification(
    notificationId: string,
  ): Promise<'sent' | 'failed' | 'retry' | 'skipped'> {
    const entity = await this.notificationRepository.findOne({
      where: { id: notificationId },
    });
    if (!entity || entity.status !== NotifyStatus.PENDING) {
      return 'skipped';
    }

    try {
      await this.dispatch(entity);
      entity.status = NotifyStatus.SENT;
      entity.error = undefined;
      await this.notificationRepository.save(entity);
      return 'sent';
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      const permanent = error instanceof UnconfiguredChannelError;

      if (permanent || entity.retryCount + 1 >= this.maxRetries) {
        entity.status = NotifyStatus.FAILED;
        entity.retryCount += 1;
        entity.error = message;
        await this.notificationRepository.save(entity);
        this.logger.error(
          `Notification ${entity.id} failed permanently (${entity.channel}/${entity.template ?? 'default'}): ${message}`,
        );
        return 'failed';
      }

      entity.retryCount += 1;
      entity.error = message;
      await this.notificationRepository.save(entity);
      this.logger.warn(
        `Notification ${entity.id} failed (attempt ${entity.retryCount}/${this.maxRetries}), will retry: ${message}`,
      );
      return 'retry';
    }
  }

  private async dispatch(entity: Notification): Promise<void> {
    switch (entity.channel) {
      case NotifyChannel.EMAIL:
        await this.dispatchEmail(entity);
        return;
      case NotifyChannel.PUSH:
        await this.dispatchPush();
        return;
      case NotifyChannel.SMS:
        await this.dispatchSms(entity);
        return;
      case NotifyChannel.WHATSAPP:
        await this.dispatchWhatsApp(entity);
        return;
      default:
        throw new Error(`Unsupported notification channel: ${entity.channel}`);
    }
  }

  private async dispatchEmail(entity: Notification): Promise<void> {
    const template = entity.template ?? 'generic_email';
    const payload = this.payloadOf(entity);

    switch (template) {
      case 'ticket_email':
      case 'ticket_delivery':
        await this.emailService.sendTicketEmail(
          this.deserializeTicketEmailPayload(payload),
        );
        return;
      case 'payment_receipt':
        await this.emailService.sendPaymentReceiptEmail(
          this.deserializePaymentReceiptPayload(payload),
        );
        return;
      case 'installment_due_reminder':
        await this.emailService.sendInstallmentDueReminderEmail(
          this.deserializeInstallmentDueReminderPayload(payload),
        );
        return;
      default:
        throw new Error(`Unsupported email template: ${template}`);
    }
  }

  private async dispatchPush(): Promise<void> {
    // In-app notifications are persisted in the row payload; delivery is marking SENT.
  }

  private async dispatchSms(entity: Notification): Promise<void> {
    if (!this.smsAdapter.isConfigured()) {
      throw new UnconfiguredChannelError(NotifyChannel.SMS);
    }

    const template = entity.template ?? 'generic';
    const payload = this.payloadOf(entity);

    switch (template) {
      case 'ticket_delivery': {
        const eventTitle = this.requireString(payload, 'eventTitle');
        const deepLink = this.requireString(payload, 'deepLink');
        const appName = this.configService.get<string>('APP_NAME', 'All AXS');
        const buyerName =
          typeof payload.buyerName === 'string' ? payload.buyerName.trim() : '';
        const ticketCount =
          typeof payload.ticketCount === 'number' && payload.ticketCount > 0
            ? payload.ticketCount
            : 1;
        const greeting = buyerName ? `Hi ${buyerName}, ` : '';
        const ticketLabel = ticketCount === 1 ? 'ticket' : 'tickets';
        const message = `${greeting}${appName}: Your ${ticketLabel} for ${eventTitle} are ready. View: ${deepLink}`;
        await this.smsAdapter.send({ to: entity.to, message });
        return;
      }
      case 'generic': {
        const message = this.requireString(payload, 'message');
        await this.smsAdapter.send({ to: entity.to, message });
        return;
      }
      default:
        throw new Error(`Unsupported SMS template: ${template}`);
    }
  }

  private async dispatchWhatsApp(entity: Notification): Promise<void> {
    if (!this.whatsAppAdapter.isConfigured()) {
      throw new UnconfiguredChannelError(NotifyChannel.WHATSAPP);
    }

    const template = entity.template ?? TICKET_WHATSAPP_TEMPLATE;
    const payload = this.payloadOf(entity) as TicketWhatsAppPayload;

    if (template !== TICKET_WHATSAPP_TEMPLATE) {
      throw new Error(`Unsupported WhatsApp template: ${template}`);
    }
    if (
      !payload.eventTitle ||
      !Array.isArray(payload.ticketLinks) ||
      !payload.ticketLinks.length
    ) {
      throw new Error('Invalid ticket WhatsApp payload');
    }

    await this.whatsAppAdapter.sendTicketMessage({
      toPhone: entity.to,
      template,
      payload,
    });
  }

  private requireString(payload: NotificationPayload, key: string): string {
    const value = payload[key];
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`Missing notification payload field: ${key}`);
    }
    return value.trim();
  }

  private serializeTicketEmailPayload(
    input: TicketEmailNotificationInput,
  ): NotificationPayload {
    return {
      buyerName: input.buyerName,
      buyerEmail: input.buyerEmail,
      eventTitle: input.eventTitle,
      event: input.event
        ? {
            ...input.event,
            startAt: input.event.startAt?.toISOString(),
            endAt: input.event.endAt?.toISOString(),
          }
        : undefined,
      tickets: input.tickets.map((ticket) => ({
        ...ticket,
        issuedAt: ticket.issuedAt.toISOString(),
      })),
      summary: input.summary,
      accessUrl: input.accessUrl,
      accountCreated: input.accountCreated,
    };
  }

  private deserializeTicketEmailPayload(
    payload: NotificationPayload,
  ): Parameters<EmailService['sendTicketEmail']>[0] {
    const ticketsRaw = Array.isArray(payload.tickets) ? payload.tickets : [];
    const eventRaw =
      payload.event && typeof payload.event === 'object'
        ? (payload.event as Record<string, unknown>)
        : undefined;

    return {
      buyerName:
        typeof payload.buyerName === 'string' ? payload.buyerName : '',
      buyerEmail:
        typeof payload.buyerEmail === 'string'
          ? payload.buyerEmail
          : typeof payload.to === 'string'
            ? payload.to
            : '',
      eventTitle:
        typeof payload.eventTitle === 'string' ? payload.eventTitle : 'Event',
      event: eventRaw
        ? {
            title:
              typeof eventRaw.title === 'string' ? eventRaw.title : 'Event',
            slug: typeof eventRaw.slug === 'string' ? eventRaw.slug : undefined,
            startAt:
              typeof eventRaw.startAt === 'string'
                ? new Date(eventRaw.startAt)
                : undefined,
            endAt:
              typeof eventRaw.endAt === 'string'
                ? new Date(eventRaw.endAt)
                : undefined,
            venue:
              typeof eventRaw.venue === 'string'
                ? eventRaw.venue
                : eventRaw.venue === null
                  ? null
                  : undefined,
            city:
              typeof eventRaw.city === 'string'
                ? eventRaw.city
                : eventRaw.city === null
                  ? null
                  : undefined,
            country:
              typeof eventRaw.country === 'string'
                ? eventRaw.country
                : eventRaw.country === null
                  ? null
                  : undefined,
            type: eventRaw.type as TicketEmailEventInput['type'],
            organizerName:
              typeof eventRaw.organizerName === 'string'
                ? eventRaw.organizerName
                : eventRaw.organizerName === null
                  ? null
                  : undefined,
          }
        : undefined,
      tickets: ticketsRaw.map((ticket) => {
        const row = ticket as Record<string, unknown>;
        return {
          id: String(row.id ?? ''),
          tierName: String(row.tierName ?? 'Ticket'),
          qrNonce: String(row.qrNonce ?? ''),
          qrSignature: String(row.qrSignature ?? ''),
          issuedAt:
            typeof row.issuedAt === 'string'
              ? new Date(row.issuedAt)
              : row.issuedAt instanceof Date
                ? row.issuedAt
                : new Date(),
        };
      }),
      summary:
        payload.summary && typeof payload.summary === 'object'
          ? (payload.summary as {
              subtotalCents: number;
              discountCents: number;
              totalCents: number;
              currency: string;
              couponCode?: string | null;
            })
          : undefined,
      accessUrl:
        typeof payload.accessUrl === 'string' ? payload.accessUrl : undefined,
      accountCreated:
        typeof payload.accountCreated === 'boolean'
          ? payload.accountCreated
          : undefined,
    };
  }

  private serializePaymentReceiptPayload(
    input: PaymentReceiptNotificationInput,
  ): NotificationPayload {
    return {
      buyerEmail: input.buyerEmail,
      buyerName: input.buyerName ?? null,
      organizerName: input.organizerName,
      organizerSupportEmail: input.organizerSupportEmail ?? null,
      eventTitle: input.eventTitle,
      paymentReference: input.paymentReference,
      orderReference: input.orderReference ?? null,
      paidAt: input.paidAt.toISOString(),
      amountCents: input.amountCents,
      currency: input.currency,
      paymentMethodLabel: input.paymentMethodLabel ?? null,
      orderConfirmationUrl: input.orderConfirmationUrl ?? null,
      ticketsPending: input.ticketsPending ?? false,
      installmentNote: input.installmentNote ?? null,
    };
  }

  private deserializePaymentReceiptPayload(
    payload: NotificationPayload,
  ): Parameters<EmailService['sendPaymentReceiptEmail']>[0] {
    return {
      buyerEmail:
        typeof payload.buyerEmail === 'string'
          ? payload.buyerEmail
          : typeof payload.to === 'string'
            ? payload.to
            : '',
      buyerName:
        typeof payload.buyerName === 'string' ? payload.buyerName : null,
      organizerName:
        typeof payload.organizerName === 'string'
          ? payload.organizerName
          : 'Organizer',
      organizerSupportEmail:
        typeof payload.organizerSupportEmail === 'string'
          ? payload.organizerSupportEmail
          : null,
      eventTitle:
        typeof payload.eventTitle === 'string' ? payload.eventTitle : 'Event',
      paymentReference:
        typeof payload.paymentReference === 'string'
          ? payload.paymentReference
          : '',
      orderReference:
        typeof payload.orderReference === 'string'
          ? payload.orderReference
          : null,
      paidAt:
        typeof payload.paidAt === 'string'
          ? new Date(payload.paidAt)
          : new Date(),
      amountCents:
        typeof payload.amountCents === 'number' ? payload.amountCents : 0,
      currency:
        typeof payload.currency === 'string' ? payload.currency : 'KES',
      paymentMethodLabel:
        typeof payload.paymentMethodLabel === 'string'
          ? payload.paymentMethodLabel
          : null,
      orderConfirmationUrl:
        typeof payload.orderConfirmationUrl === 'string'
          ? payload.orderConfirmationUrl
          : undefined,
      ticketsPending:
        typeof payload.ticketsPending === 'boolean'
          ? payload.ticketsPending
          : false,
      installmentNote:
        typeof payload.installmentNote === 'string'
          ? payload.installmentNote
          : null,
    };
  }

  private serializeInstallmentDueReminderPayload(
    input: InstallmentDueReminderNotificationInput,
  ): NotificationPayload {
    return {
      buyerEmail: input.buyerEmail,
      buyerName: input.buyerName ?? null,
      eventTitle: input.eventTitle,
      amountCents: input.amountCents,
      currency: input.currency,
      dueAt: input.dueAt.toISOString(),
      sequence: input.sequence,
      isOverdue: input.isOverdue,
      orderId: input.orderId,
      orderUrl: input.orderUrl,
    };
  }

  private deserializeInstallmentDueReminderPayload(
    payload: NotificationPayload,
  ): Parameters<EmailService['sendInstallmentDueReminderEmail']>[0] {
    return {
      buyerEmail:
        typeof payload.buyerEmail === 'string'
          ? payload.buyerEmail
          : typeof payload.to === 'string'
            ? payload.to
            : '',
      buyerName:
        typeof payload.buyerName === 'string' ? payload.buyerName : null,
      eventTitle:
        typeof payload.eventTitle === 'string' ? payload.eventTitle : 'Event',
      amountCents:
        typeof payload.amountCents === 'number' ? payload.amountCents : 0,
      currency:
        typeof payload.currency === 'string' ? payload.currency : 'KES',
      dueAt:
        typeof payload.dueAt === 'string'
          ? new Date(payload.dueAt)
          : new Date(),
      sequence: typeof payload.sequence === 'number' ? payload.sequence : 1,
      isOverdue:
        typeof payload.isOverdue === 'boolean' ? payload.isOverdue : false,
      orderUrl:
        typeof payload.orderUrl === 'string' ? payload.orderUrl : '',
    };
  }

  async createInAppNotification(
    input: CreateInAppNotificationInput,
  ): Promise<Notification> {
    const payload: NotificationPayload = {
      ...input.payload,
      title: input.title,
      body: input.body,
      category: input.category ?? 'system',
    };

    if (input.link) {
      payload.link = input.link;
    }

    return this.notificationRepository.save(
      this.notificationRepository.create({
        channel: NotifyChannel.PUSH,
        template: input.template,
        to: input.to,
        payload,
        status: NotifyStatus.SENT,
      }),
    );
  }

  private resolveCategory(
    entity: Notification,
    payload: NotificationPayload,
    title: string,
    body: string,
    link?: string,
  ): 'orders' | 'hosting' | 'system' {
    const payloadCategory = payload.category;
    if (
      payloadCategory === 'orders' ||
      payloadCategory === 'hosting' ||
      payloadCategory === 'system'
    ) {
      return payloadCategory;
    }

    const haystack =
      `${entity.template ?? ''} ${title} ${body} ${link ?? ''}`.toLowerCase();
    if (
      haystack.includes('order') ||
      haystack.includes('ticket') ||
      haystack.includes('checkout')
    ) {
      return 'orders';
    }
    if (
      haystack.includes('organizer') ||
      haystack.includes('host') ||
      haystack.includes('/organizer')
    ) {
      return 'hosting';
    }
    return 'system';
  }

  async listForUser(
    user: CurrentUser,
    requestedLimit?: number,
    requestedOffset?: number,
  ): Promise<{
    notifications: NotificationListItem[];
    unreadCount: number;
    total: number;
    limit: number;
    offset: number;
  }> {
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(Number(requestedLimit), 25))
      : 8;
    const offset = Number.isFinite(requestedOffset)
      ? Math.max(0, Number(requestedOffset))
      : 0;

    const [rows, totalRows] = await Promise.all([
      this.notificationRepository
        .createQueryBuilder('n')
        .where('LOWER(n.to) = LOWER(:email)', { email: user.email })
        .orderBy('n.createdAt', 'DESC')
        .offset(offset)
        .limit(limit)
        .getMany(),
      this.notificationRepository
        .createQueryBuilder('n')
        .where('LOWER(n.to) = LOWER(:email)', { email: user.email })
        .getMany(),
    ]);

    const notifications = rows.map((row) => this.toListItem(row, user.id));
    const unreadCount = totalRows.reduce(
      (acc, row) => acc + (this.isReadForUser(row, user.id) ? 0 : 1),
      0,
    );

    return {
      notifications,
      unreadCount,
      total: totalRows.length,
      limit,
      offset,
    };
  }

  async markReadForUser(
    notificationId: string,
    user: CurrentUser,
  ): Promise<{ notification: NotificationListItem }> {
    const entity = await this.notificationRepository
      .createQueryBuilder('n')
      .where('n.id = :id', { id: notificationId })
      .andWhere('LOWER(n.to) = LOWER(:email)', { email: user.email })
      .getOne();

    if (!entity) {
      throw new NotFoundException('Notification not found');
    }

    const payload = this.payloadOf(entity);
    const existingReadByUserIds = Array.isArray(payload.readByUserIds)
      ? payload.readByUserIds.filter((v): v is string => typeof v === 'string')
      : [];
    const readByUserIds = Array.from(
      new Set([...existingReadByUserIds, user.id]),
    );
    const existingReadAtByUserId =
      payload.readAtByUserId && typeof payload.readAtByUserId === 'object'
        ? (payload.readAtByUserId as Record<string, string>)
        : {};

    entity.payload = {
      ...payload,
      readByUserIds,
      readAtByUserId: {
        ...existingReadAtByUserId,
        [user.id]: new Date().toISOString(),
      },
    };
    const saved = await this.notificationRepository.save(entity);

    return { notification: this.toListItem(saved, user.id) };
  }

  async markAllReadForUser(user: CurrentUser): Promise<{ updated: number }> {
    const rows = await this.notificationRepository
      .createQueryBuilder('n')
      .where('LOWER(n.to) = LOWER(:email)', { email: user.email })
      .orderBy('n.createdAt', 'DESC')
      .getMany();

    const now = new Date().toISOString();
    let updated = 0;
    for (const entity of rows) {
      if (this.isReadForUser(entity, user.id)) continue;
      const payload = this.payloadOf(entity);
      const existingReadByUserIds = Array.isArray(payload.readByUserIds)
        ? payload.readByUserIds.filter(
            (v): v is string => typeof v === 'string',
          )
        : [];
      const readByUserIds = Array.from(
        new Set([...existingReadByUserIds, user.id]),
      );
      const existingReadAtByUserId =
        payload.readAtByUserId && typeof payload.readAtByUserId === 'object'
          ? (payload.readAtByUserId as Record<string, string>)
          : {};
      entity.payload = {
        ...payload,
        readByUserIds,
        readAtByUserId: {
          ...existingReadAtByUserId,
          [user.id]: now,
        },
      };
      updated += 1;
    }

    if (updated > 0) {
      await this.notificationRepository.save(rows);
    }

    return { updated };
  }
}
