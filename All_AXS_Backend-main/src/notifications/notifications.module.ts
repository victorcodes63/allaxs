import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from '../domain/notification.entity';
import { PaymentInstallment } from '../domain/payment-installment.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationProcessorTask } from './notification-processor.task';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { InstallmentReminderService } from './installment-reminder.service';
import { InstallmentReminderTask } from './installment-reminder.task';
import { AfricasTalkingSmsAdapter } from './adapters/sms-africastalking';
import { TwilioWhatsAppAdapter } from './adapters/twilio-whatsapp.adapter';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, PaymentInstallment]),
    AuthModule,
    UsersModule,
    PushModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationProcessorTask,
    NotificationDispatcherService,
    InstallmentReminderService,
    InstallmentReminderTask,
    AfricasTalkingSmsAdapter,
    TwilioWhatsAppAdapter,
  ],
  exports: [
    NotificationsService,
    NotificationDispatcherService,
    InstallmentReminderService,
    InstallmentReminderTask,
  ],
})
export class NotificationsModule {}
