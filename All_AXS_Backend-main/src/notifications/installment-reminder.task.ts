import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  InstallmentReminderService,
  type InstallmentReminderRunResult,
} from './installment-reminder.service';

@Injectable()
export class InstallmentReminderTask {
  private readonly logger = new Logger(InstallmentReminderTask.name);

  constructor(
    private readonly installmentReminderService: InstallmentReminderService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleDailyReminders(): Promise<void> {
    this.logger.log('Running installment due reminder task...');
    try {
      await this.installmentReminderService.processDueReminders();
    } catch (error) {
      this.logger.error('Installment reminder task failed', error);
    }
  }

  async triggerReminders(): Promise<InstallmentReminderRunResult> {
    this.logger.log('Manual installment reminder run triggered');
    return this.installmentReminderService.processDueReminders();
  }
}
