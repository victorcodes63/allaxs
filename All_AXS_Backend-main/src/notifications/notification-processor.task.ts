import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationProcessorTask {
  private readonly logger = new Logger(NotificationProcessorTask.name);
  private processing = false;

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async drainPendingNotifications(): Promise<void> {
    const enabled =
      this.configService.get<string>(
        'NOTIFICATION_DISPATCH_ENABLED',
        'true',
      ) === 'true';
    if (!enabled || this.processing) return;

    this.processing = true;
    try {
      const result = await this.notificationsService.processPendingBatch();
      if (result.processed > 0) {
        this.logger.log(
          `Processed ${result.processed} notification(s): ${result.sent} sent, ${result.failed} failed, ${result.retried} retrying`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Notification processor cron failed: ${String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.processing = false;
    }
  }
}
