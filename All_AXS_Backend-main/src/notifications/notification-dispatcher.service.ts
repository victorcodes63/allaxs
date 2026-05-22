import { Injectable } from '@nestjs/common';
import {
  NotificationsService,
  type EnqueueNotificationInput,
  type TicketDeliverySmsInput,
  type TicketEmailNotificationInput,
} from './notifications.service';
import { Notification } from '../domain/notification.entity';

@Injectable()
export class NotificationDispatcherService {
  constructor(private readonly notificationsService: NotificationsService) {}

  async enqueue(input: EnqueueNotificationInput): Promise<Notification | null> {
    const to = input.to.trim();
    if (!to) return null;

    if (input.processInline === false) {
      return this.notificationsService.enqueueNotification({
        channel: input.channel,
        to,
        template: input.template,
        payload: input.payload,
      });
    }

    return this.notificationsService.enqueueAndDispatch({
      channel: input.channel,
      to,
      template: input.template,
      payload: input.payload,
    });
  }

  enqueueTicketEmail(
    input: TicketEmailNotificationInput,
  ): Promise<Notification | null> {
    return this.notificationsService.dispatchTicketEmail(input);
  }

  sendTicketDeliverySms(
    input: TicketDeliverySmsInput,
  ): Promise<Notification | null> {
    return this.notificationsService.sendTicketDeliverySms(input);
  }
}
