import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { Ticket } from './ticket.entity';
import { Payment } from './payment.entity';
import { PaymentPlan } from './payment-plan.entity';
import { PaymentInstallment } from './payment-installment.entity';
import { PaymentPlansService } from './payment-plans.service';
import { PaymentProgressHelper } from './payment-progress.helper';
import { CheckIn } from './checkin.entity';
import { Notification } from './notification.entity';
import { WebhookEvent } from './webhook-event.entity';
import { TicketType } from 'src/events/entities/ticket-type.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      Ticket,
      Payment,
      PaymentPlan,
      PaymentInstallment,
      TicketType,
      CheckIn,
      Notification,
      WebhookEvent,
    ]),
  ],
  providers: [PaymentPlansService, PaymentProgressHelper],
  exports: [TypeOrmModule, PaymentPlansService, PaymentProgressHelper],
})
export class DomainModule {}
