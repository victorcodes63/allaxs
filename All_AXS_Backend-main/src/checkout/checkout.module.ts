import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CheckoutController } from './checkout.controller';
import { PaystackWebhookController } from './paystack-webhook.controller';
import { CheckoutService } from './checkout.service';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { Order } from '../domain/order.entity';
import { OrderItem } from '../domain/order-item.entity';
import { Ticket } from '../domain/ticket.entity';
import { Payment } from '../domain/payment.entity';
import { Event } from '../events/entities/event.entity';
import { TicketType } from '../events/entities/ticket-type.entity';
import { DomainModule } from '../domain/domain.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      Ticket,
      Payment,
      Event,
      TicketType,
    ]),
    AuthModule,
    DomainModule,
    EventsModule,
  ],
  controllers: [CheckoutController, PaystackWebhookController, TicketsController],
  providers: [CheckoutService, TicketsService],
})
export class CheckoutModule {}
