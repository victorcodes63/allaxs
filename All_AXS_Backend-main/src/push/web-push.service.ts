import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import webpush from 'web-push';
import { WebPushSubscription } from './entities/web-push-subscription.entity';
import { User } from 'src/users/entities/user.entity';
import { resolvePlatformSupportEmail } from '../common/site-contact';

export type WebPushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

@Injectable()
export class WebPushService implements OnModuleInit {
  private readonly logger = new Logger(WebPushService.name);
  private enabled = false;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(WebPushSubscription)
    private readonly subscriptionRepository: Repository<WebPushSubscription>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  onModuleInit(): void {
    const publicKey = this.config.get<string>('WEB_PUSH_VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('WEB_PUSH_VAPID_PRIVATE_KEY');
    const subject =
      this.config.get<string>('WEB_PUSH_VAPID_SUBJECT') ||
      `mailto:${resolvePlatformSupportEmail()}`;

    if (!publicKey || !privateKey) {
      this.logger.warn(
        'Web Push disabled: set WEB_PUSH_VAPID_PUBLIC_KEY and WEB_PUSH_VAPID_PRIVATE_KEY',
      );
      return;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.enabled = true;
  }

  getPublicKey(): string | null {
    return this.config.get<string>('WEB_PUSH_VAPID_PUBLIC_KEY') ?? null;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async subscribe(
    userId: string,
    input: {
      endpoint: string;
      p256dh: string;
      auth: string;
      userAgent?: string;
    },
  ): Promise<void> {
    const existing = await this.subscriptionRepository.findOne({
      where: { endpoint: input.endpoint },
    });

    if (existing) {
      existing.userId = userId;
      existing.p256dh = input.p256dh;
      existing.auth = input.auth;
      existing.userAgent = input.userAgent ?? null;
      await this.subscriptionRepository.save(existing);
      return;
    }

    await this.subscriptionRepository.save(
      this.subscriptionRepository.create({
        userId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
      }),
    );
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    const row = await this.subscriptionRepository.findOne({
      where: { endpoint, userId },
    });
    if (!row) {
      throw new NotFoundException('Push subscription not found');
    }
    await this.subscriptionRepository.remove(row);
  }

  async unsubscribeAllForUser(userId: string): Promise<void> {
    await this.subscriptionRepository.delete({ userId });
  }

  /**
   * Best-effort browser push for a user email (matches in-app notification `to`).
   */
  async notifyUserEmail(
    email: string,
    payload: WebPushPayload,
  ): Promise<void> {
    if (!this.enabled) return;

    const user = await this.userRepository.findOne({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user) return;

    const subs = await this.subscriptionRepository.find({
      where: { userId: user.id },
    });
    if (subs.length === 0) return;

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? '/notifications',
      tag: payload.tag ?? 'allaxs-notification',
    });

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            body,
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await this.subscriptionRepository.remove(sub);
          } else {
            this.logger.warn(
              `Web push failed for ${sub.id}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }),
    );
  }
}
