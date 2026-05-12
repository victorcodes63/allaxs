import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../domain/notification.entity';
import { NotifyChannel, NotifyStatus } from '../domain/enums';
import type { CurrentUser } from '../auth/decorators/current-user.decorator';

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

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

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
