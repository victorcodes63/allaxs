import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from '../domain/notification.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationProcessorTask } from './notification-processor.task';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { AfricasTalkingSmsAdapter } from './adapters/sms-africastalking';
import { TwilioWhatsAppAdapter } from './adapters/twilio-whatsapp.adapter';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Notification]), AuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationProcessorTask,
    NotificationDispatcherService,
    AfricasTalkingSmsAdapter,
    TwilioWhatsAppAdapter,
  ],
  exports: [NotificationsService, NotificationDispatcherService],
})
export class NotificationsModule {}
